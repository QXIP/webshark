import { ffmpegCodecForPayload, ffmpegSampleRate, rtpBytesPerSecond, rtpSilenceByte } from './rtp-codec';

describe('ffmpegCodecForPayload', () => {
  it('maps PCMA / G.711A to alaw', () => {
    expect(ffmpegCodecForPayload('PCMA')).toBe('alaw');
    expect(ffmpegCodecForPayload('g711A')).toBe('alaw');
    expect(ffmpegCodecForPayload('ITU-T G.711 PCMA')).toBe('alaw');
  });

  it('maps PCMU / G.711U to mulaw', () => {
    expect(ffmpegCodecForPayload('PCMU')).toBe('mulaw');
    expect(ffmpegCodecForPayload('g711u')).toBe('mulaw');
  });

  it('maps G.722 and unknown payloads to g722', () => {
    expect(ffmpegCodecForPayload('g722')).toBe('g722');
    expect(ffmpegCodecForPayload('unknown')).toBe('g722');
  });

  it('uses 8 kHz for G.711 and 16 kHz for G.722', () => {
    expect(ffmpegSampleRate('alaw')).toBe(8000);
    expect(ffmpegSampleRate('mulaw')).toBe(8000);
    expect(ffmpegSampleRate('g722')).toBe(16000);
  });

  it('uses encoded byte rate for silence padding', () => {
    expect(rtpBytesPerSecond('alaw')).toBe(8000);
    expect(rtpBytesPerSecond('g722')).toBe(8000);
  });

  it('uses codec-typical silence bytes', () => {
    expect(rtpSilenceByte('alaw')).toBe(0xd5);
    expect(rtpSilenceByte('mulaw')).toBe(0xff);
    expect(rtpSilenceByte('g722')).toBe(0x00);
  });
});
