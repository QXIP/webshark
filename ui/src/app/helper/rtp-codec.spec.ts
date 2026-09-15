import { codecAllowsBitstreamPad, ffmpegCodecForPayload, ffmpegSampleRate, rtpBytesPerSecond, rtpSilenceByte } from './rtp-codec';

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

  it('maps G.722 by name and G.729 instead of defaulting to G.722', () => {
    expect(ffmpegCodecForPayload('g722')).toBe('g722');
    expect(ffmpegCodecForPayload('ITU-T G.729')).toBe('g729');
    expect(ffmpegCodecForPayload('unknown')).toBe('alaw');
  });

  it('maps static payload types', () => {
    expect(ffmpegCodecForPayload('', 0)).toBe('mulaw');
    expect(ffmpegCodecForPayload('', 8)).toBe('alaw');
    expect(ffmpegCodecForPayload('', 9)).toBe('g722');
    expect(ffmpegCodecForPayload('', 18)).toBe('g729');
    expect(ffmpegCodecForPayload('18')).toBe('g729');
    expect(ffmpegCodecForPayload('telephone-event', 101)).toBe('');
  });

  it('uses 8 kHz for G.711 and 16 kHz for G.722', () => {
    expect(ffmpegSampleRate('alaw')).toBe(8000);
    expect(ffmpegSampleRate('mulaw')).toBe(8000);
    expect(ffmpegSampleRate('g722')).toBe(16000);
  });

  it('uses encoded byte rate for silence padding', () => {
    expect(rtpBytesPerSecond('alaw')).toBe(8000);
    expect(rtpBytesPerSecond('g722')).toBe(8000);
    expect(rtpBytesPerSecond('g729')).toBe(1000);
    expect(codecAllowsBitstreamPad('alaw')).toBeTrue();
    expect(codecAllowsBitstreamPad('g729')).toBeFalse();
  });

  it('uses codec-typical silence bytes', () => {
    expect(rtpSilenceByte('alaw')).toBe(0xd5);
    expect(rtpSilenceByte('mulaw')).toBe(0xff);
    expect(rtpSilenceByte('g722')).toBe(0x00);
  });
});
