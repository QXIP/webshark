export function ffmpegCodecForPayload(payload: string): string {
  const p = (payload || '').toLowerCase();
  if (p.includes('pcma') || p.includes('g711a') || p.includes('alaw')) {
    return 'alaw';
  }
  if (p.includes('pcmu') || p.includes('g711u') || p.includes('ulaw') || p.includes('mulaw')) {
    return 'mulaw';
  }
  if (p.includes('g722')) {
    return 'g722';
  }
  return 'g722';
}

export function ffmpegSampleRate(codec: string): number {
  return codec === 'g722' ? 16000 : 8000;
}

/** Encoded payload bytes per second (G.722 is 64 kbit/s even though PCM is 16 kHz). */
export function rtpBytesPerSecond(codec: string): number {
  return codec === 'g722' ? 8000 : ffmpegSampleRate(codec);
}

export function rtpSilenceByte(codec: string): number {
  if (codec === 'mulaw') {
    return 0xff;
  }
  if (codec === 'alaw') {
    return 0xd5;
  }
  return 0x00;
}
