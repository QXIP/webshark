if (!self.crossOriginIsolated) {
  console.log('ffmpeg: SharedArrayBuffer unavailable (needs HTTPS or localhost COOP/COEP). RTP playback may be limited.');
} else {
  console.log('ffmpeg::Ready!');
}

const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpegCorePath = (typeof document !== 'undefined' && document.baseURI)
  ? new URL('ffmpeg/ffmpeg-core.js', document.baseURI).href
  : './ffmpeg/ffmpeg-core.js';
const ffmpeg = createFFmpeg({
  log: false,
  corePath: ffmpegCorePath,
  progress: ({ ratio }) => {
    const el = typeof document !== 'undefined' && document.getElementById('message');
    if (el) {
      el.innerHTML = `Complete: ${(ratio * 100.0).toFixed(2)}%`;
    }
  },
});

const defaults = {
	"bin":    "ffmpeg",
	"global": "-hide_banner",

	// inputs
	"file": "-re -i {input}",
	"http": "-fflags nobuffer -flags low_delay -i {input}",
	"rtsp": "-fflags nobuffer -flags low_delay -timeout 5000000 -user_agent go2rtc/ffmpeg -rtsp_flags prefer_tcp -i {input}",

	"rtsp/udp": "-fflags nobuffer -flags low_delay -timeout 5000000 -user_agent go2rtc/ffmpeg -i {input}",

	// output
	"output":       "-user_agent ffmpeg/go2rtc -rtsp_transport tcp -f rtsp {output}",
	"output/mjpeg": "-f mjpeg -",

	// `-preset superfast` - we can't use ultrafast because it doesn't support `-profile main -level 4.1`
	// `-tune zerolatency` - for minimal latency
	// `-profile high -level 4.1` - most used streaming profile
	// `-pix_fmt:v yuv420p` - important for Telegram
	"h264":  "-c:v libx264 -g 50 -profile:v high -level:v 4.1 -preset:v superfast -tune:v zerolatency -pix_fmt:v yuv420p",
	"h265":  "-c:v libx265 -g 50 -profile:v main -level:v 5.1 -preset:v superfast -tune:v zerolatency",
	"mjpeg": "-c:v mjpeg",
	//"mjpeg": "-c:v mjpeg -force_duplicated_matrix:v 1 -huffman:v 0 -pix_fmt:v yuvj420p",

	// https://ffmpeg.org/ffmpeg-codecs.html#libopus-1
	// https://github.com/pion/webrtc/issues/1514
	// https://ffmpeg.org/ffmpeg-resampler.html
	// `-async 1` or `-min_comp 0` - force frame_size=960, important for WebRTC audio quality
	"opus":       "-c:a libopus -application:a lowdelay -frame_duration 20 -min_comp 0",
	"pcmu":       "-c:a pcm_mulaw -ar:a 8000 -ac:a 1",
	"pcmu/16000": "-c:a pcm_mulaw -ar:a 16000 -ac:a 1",
	"pcmu/48000": "-c:a pcm_mulaw -ar:a 48000 -ac:a 1",
	"pcma":       "-c:a pcm_alaw -ar:a 8000 -ac:a 1",
	"pcma/16000": "-c:a pcm_alaw -ar:a 16000 -ac:a 1",
	"pcma/48000": "-c:a pcm_alaw -ar:a 48000 -ac:a 1",
	"aac":        "-c:a aac", // keep sample rate and channels
	"aac/16000":  "-c:a aac -ar:a 16000 -ac:a 1",
	"mp3":        "-c:a libmp3lame -q:a 8",
	"pcm":        "-c:a pcm_s16be -ar:a 8000 -ac:a 1",
	"pcm/16000":  "-c:a pcm_s16be -ar:a 16000 -ac:a 1",
	"pcm/48000":  "-c:a pcm_s16be -ar:a 48000 -ac:a 1",
	"pcml":       "-c:a pcm_s16le -ar:a 8000 -ac:a 1",
	"pcml/44100": "-c:a pcm_s16le -ar:a 44100 -ac:a 1",

	// hardware Intel and AMD on Linux
	// better not to set `-async_depth:v 1` like for QSV, because framedrops
	// `-bf 0` - disable B-frames is very important
	"h264/vaapi":  "-c:v h264_vaapi -g 50 -bf 0 -profile:v high -level:v 4.1 -sei:v 0",
	"h265/vaapi":  "-c:v hevc_vaapi -g 50 -bf 0 -profile:v high -level:v 5.1 -sei:v 0",
	"mjpeg/vaapi": "-c:v mjpeg_vaapi",

	// hardware Raspberry
	"h264/v4l2m2m": "-c:v h264_v4l2m2m -g 50 -bf 0",
	"h265/v4l2m2m": "-c:v hevc_v4l2m2m -g 50 -bf 0",

	// hardware NVidia on Linux and Windows
	// preset=p2 - faster, tune=ll - low latency
	"h264/cuda": "-c:v h264_nvenc -g 50 -bf 0 -profile:v high -level:v auto -preset:v p2 -tune:v ll",
	"h265/cuda": "-c:v hevc_nvenc -g 50 -bf 0 -profile:v high -level:v auto",

	// hardware Intel on Windows
	"h264/dxva2":  "-c:v h264_qsv -g 50 -bf 0 -profile:v high -level:v 4.1 -async_depth:v 1",
	"h265/dxva2":  "-c:v hevc_qsv -g 50 -bf 0 -profile:v high -level:v 5.1 -async_depth:v 1",
	"mjpeg/dxva2": "-c:v mjpeg_qsv -profile:v high -level:v 5.1",

	// hardware macOS
	"h264/videotoolbox": "-c:v h264_videotoolbox -g 50 -bf 0 -profile:v high -level:v 4.1",
	"h265/videotoolbox": "-c:v hevc_videotoolbox -g 50 -bf 0 -profile:v high -level:v 5.1",
}


const transcode = async (blobData, codec, output) => {
  const inputName = "rtp-payload.bin";
  const outputName = output || "audio.mp3";
    if (!ffmpeg.isLoaded()) {
      if (typeof SharedArrayBuffer === "undefined") {
        throw new Error("SharedArrayBuffer is unavailable. Serve over HTTPS or http://localhost with COOP/COEP.");
      }
      await ffmpeg.load();
    }

  const rate = codec === "g722" ? "16000" : "8000";
  const wavName = String(outputName).replace(/\.[^.]+$/, "") + ".wav";
  console.log("Start transcoding", codec, wavName, rate);
  try { ffmpeg.FS("unlink", inputName); } catch (e) {}
  try { ffmpeg.FS("unlink", wavName); } catch (e) {}
  ffmpeg.FS("writeFile", inputName, await fetchFile(blobData));
  const command = [
    "-f", codec || "alaw",
    "-ar", rate,
    "-ac", "1",
    "-i", inputName,
    "-f", "wav",
    "-acodec", "pcm_s16le",
    "-ar", rate,
    "-ac", "1",
    wavName,
  ];

  await ffmpeg.run(...command);
  console.log("Complete transcoding");
  let data;
  try {
    data = ffmpeg.FS("readFile", wavName);
  } catch (e) {
    throw new Error("ffmpeg produced no WAV for " + codec);
  }
  try { ffmpeg.FS("unlink", inputName); } catch (e) {}
  try { ffmpeg.FS("unlink", wavName); } catch (e) {}
  const pcm = data && (typeof data.slice === "function" ? data.slice() : new Uint8Array(data));
  if (!pcm || pcm.byteLength < 44) {
    throw new Error("ffmpeg produced no PCM for " + codec);
  }
  return URL.createObjectURL(new Blob([pcm], { type: "audio/wav" }));
};
globalThis.transcode = transcode;
