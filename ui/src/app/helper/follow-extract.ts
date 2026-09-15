import { udpDatagramFromFrame } from './rtp-extract';

export function bytesFromFrameDump(raw: any): Uint8Array {
  if (raw instanceof Uint8Array) {
    return raw;
  }
  const s = String(raw || '').replace(/\s+/g, '');
  if (!s) {
    return new Uint8Array();
  }
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  try {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

function latin1(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

export function followChunksFromFrames(
  frames: Array<{ bytes?: any; c?: any[]; num?: number }>
): { shost: string; sport: number; dhost: string; dport: number; payload: Array<{ n: number; d: string; s: number }> } {
  const payload: Array<{ n: number; d: string; s: number }> = [];
  let shost = '';
  let sport = 0;
  let dhost = '';
  let dport = 0;
  for (const frame of frames || []) {
    const bytes = bytesFromFrameDump(frame.bytes);
    const udp = udpDatagramFromFrame(bytes);
    if (!udp || !udp.payload.byteLength) {
      continue;
    }
    const n = Number(frame.num ?? frame.c?.[0]) || payload.length + 1;
    if (!shost) {
      shost = udp.saddr;
      sport = udp.sport;
      dhost = udp.daddr;
      dport = udp.dport;
    }
    const server = udp.saddr === dhost && udp.sport === dport ? 1 : 0;
    payload.push({ n, d: latin1(udp.payload), s: server });
  }
  return { shost, sport, dhost, dport, payload };
}
