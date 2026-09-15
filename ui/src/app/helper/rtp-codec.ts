const PT_CODEC: Record<number, string> = {
  0: 'mulaw',
  3: 'gsm',
  4: 'g723_1',
  8: 'alaw',
  9: 'g722',
  18: 'g729'
};

const SKIP_PT = new Set([13, 72, 73, 74, 75, 76]);

export function ffmpegCodecForPayload(payload: string, pt?: number, sampleLen?: number): string {
  const p = (payload || '').toLowerCase();
  if (p.includes('telephone-event') || p.includes('comfort') || p.includes('cn/')) {
    return '';
  }
  if (p.includes('pcma') || p.includes('g711a') || p.includes('alaw')) {
    return 'alaw';
  }
  if (p.includes('pcmu') || p.includes('g711u') || p.includes('ulaw') || p.includes('mulaw')) {
    return 'mulaw';
  }
  if (p.includes('g722') || p.includes('g.722')) {
    return 'g722';
  }
  if (p.includes('g729') || p.includes('g.729')) {
    return 'g729';
  }
  if (p.includes('g723') || p.includes('g.723')) {
    return 'g723_1';
  }
  if (p.includes('gsm')) {
    return 'gsm';
  }
  const namedPt = Number(p);
  if (p !== '' && Number.isFinite(namedPt) && PT_CODEC[namedPt]) {
    return PT_CODEC[namedPt];
  }
  const n = Number(pt);
  if (Number.isFinite(n)) {
    if (SKIP_PT.has(n)) {
      return '';
    }
    if (PT_CODEC[n]) {
      return PT_CODEC[n];
    }
  }
  const len = Number(sampleLen) || 0;
  if (len === 160 || len === 80) {
    return 'alaw';
  }
  if (len === 20 || len === 10) {
    return 'g729';
  }
  if (len === 24 || len === 40) {
    return 'g723_1';
  }
  return 'alaw';
}

export function ffmpegSampleRate(codec: string): number {
  return codec === 'g722' ? 16000 : 8000;
}

/** Encoded payload bytes per second (G.722 is 64 kbit/s even though PCM is 16 kHz). */
export function rtpBytesPerSecond(codec: string): number {
  if (codec === 'g722') {
    return 8000;
  }
  if (codec === 'g729') {
    return 1000;
  }
  if (codec === 'g723_1') {
    return 800;
  }
  if (codec === 'gsm') {
    return 1625;
  }
  return ffmpegSampleRate(codec);
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

/** Only G.711 can take raw comfort bytes in the bitstream ffmpeg sees. */
export function codecAllowsBitstreamPad(codec: string): boolean {
  return codec === 'alaw' || codec === 'mulaw';
}

export function ffmpegCodecFallbacks(codec: string, sampleLen?: number): string[] {
  const primary = codec || ffmpegCodecForPayload('', undefined, sampleLen);
  const out = [primary];
  if (primary === 'alaw') {
    out.push('mulaw');
  } else if (primary === 'mulaw') {
    out.push('alaw');
  } else if (primary === 'g729') {
    out.push('g729');
  }
  return Array.from(new Set(out.filter(Boolean)));
}
