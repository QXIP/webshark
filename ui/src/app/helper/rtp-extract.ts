import { codecAllowsBitstreamPad, rtpBytesPerSecond, rtpSilenceByte } from './rtp-codec';
import { copyToArrayBuffer } from './capture-bytes';

export function infoHasSsrc(info: string, ssrc: string): boolean {
  const hex = String(ssrc || '').replace(/^0x/i, '').toLowerCase();
  if (!hex) {
    return false;
  }
  const text = String(info || '').toLowerCase();
  return text.includes(`ssrc=0x${hex}`) || text.includes(`ssrc=${hex}`);
}

function readU32(view: DataView, offset: number, little: boolean): number {
  return little ? view.getUint32(offset, true) : view.getUint32(offset, false);
}

export interface TimedFrame {
  ts: number;
  bytes: Uint8Array;
}

export function parseCapturePackets(buffer: ArrayBuffer | Uint8Array): Uint8Array[] {
  return parseCapturePacketsTimed(buffer).map((p) => p.bytes);
}

export function parseCapturePacketsTimed(buffer: ArrayBuffer | Uint8Array): TimedFrame[] {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength < 24) {
    return [];
  }
  const magic = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, false);
  if (magic === 0xd4c3b2a1 || magic === 0xa1b2c3d4 || magic === 0x4d3cb2a1 || magic === 0xa1b23cd4) {
    return parsePcapTimed(bytes);
  }
  if (magic === 0x0a0d0d0a) {
    return parsePcapngTimed(bytes);
  }
  return [];
}

function parsePcapTimed(bytes: Uint8Array): TimedFrame[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, false);
  const little = magic === 0xd4c3b2a1 || magic === 0x4d3cb2a1;
  const nano = magic === 0x4d3cb2a1 || magic === 0xa1b23cd4;
  const packets: TimedFrame[] = [];
  let offset = 24;
  while (offset + 16 <= bytes.byteLength) {
    const tsSec = readU32(view, offset, little);
    const tsFrac = readU32(view, offset + 4, little);
    const incl = readU32(view, offset + 8, little);
    offset += 16;
    if (incl < 0 || offset + incl > bytes.byteLength) {
      break;
    }
    packets.push({
      ts: tsSec + tsFrac / (nano ? 1e9 : 1e6),
      bytes: bytes.subarray(offset, offset + incl)
    });
    offset += incl;
  }
  return packets;
}

function parsePcapngTimed(bytes: Uint8Array): TimedFrame[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const packets: TimedFrame[] = [];
  let offset = 0;
  let little = true;
  let resol = 1e6;
  while (offset + 12 <= bytes.byteLength) {
    const type = view.getUint32(offset, little);
    let total = view.getUint32(offset + 4, little);
    if (type === 0x0a0d0d0a) {
      total = view.getUint32(offset + 4, true);
      const bom = view.getUint32(offset + 8, true);
      little = bom === 0x1a2b3c4d;
      total = view.getUint32(offset + 4, little);
    }
    if (total < 12 || offset + total > bytes.byteLength) {
      break;
    }
    if (type === 1) {
      let opt = offset + 20;
      while (opt + 4 <= offset + total - 4) {
        const code = view.getUint16(opt, little);
        const len = view.getUint16(opt + 2, little);
        if (code === 9 && len >= 1) {
          const raw = bytes[opt + 4];
          resol = (raw & 0x80) ? Math.pow(2, raw & 0x7f) : Math.pow(10, raw);
        }
        if (code === 0) {
          break;
        }
        opt += 4 + len + ((4 - (len % 4)) % 4);
      }
    }
    if (type === 6) {
      const caplen = view.getUint32(offset + 20, little);
      const tsHigh = view.getUint32(offset + 12, little);
      const tsLow = view.getUint32(offset + 16, little);
      const start = offset + 28;
      if (start + caplen <= offset + total) {
        packets.push({
          ts: (tsHigh * 4294967296 + tsLow) / (resol || 1e6),
          bytes: bytes.subarray(start, start + caplen)
        });
      }
    } else if (type === 3) {
      const orig = view.getUint32(offset + 8, little);
      const start = offset + 12;
      if (start + orig <= offset + total) {
        packets.push({ ts: 0, bytes: bytes.subarray(start, start + orig) });
      }
    }
    offset += total;
  }
  return packets;
}

export interface RtpHeaderPayload {
  ssrc: string;
  pt: number;
  seq: number;
  timestamp: number;
  marker: boolean;
  payload: Uint8Array;
}

export interface RtpDatagram {
  saddr: string;
  sport: number;
  daddr: string;
  dport: number;
  ssrc: string;
  pt: number;
  seq: number;
  timestamp: number;
  marker: boolean;
  payload: Uint8Array;
}

function ipv4(frame: Uint8Array, offset: number): string {
  return `${frame[offset]}.${frame[offset + 1]}.${frame[offset + 2]}.${frame[offset + 3]}`;
}

function ipv6(frame: Uint8Array, offset: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 16; i += 2) {
    parts.push(((frame[offset + i] << 8) | frame[offset + i + 1]).toString(16));
  }
  return parts.join(':');
}

function udpDatagramFromIp(frame: Uint8Array, offset: number): { saddr: string; daddr: string; sport: number; dport: number; payload: Uint8Array } | null {
  if (offset + 20 > frame.byteLength) {
    return null;
  }
  const version = frame[offset] >> 4;
  let saddr = '';
  let daddr = '';
  let udpStart = 0;
  if (version === 4) {
    const ihl = (frame[offset] & 0x0f) * 4;
    if (ihl < 20 || offset + ihl + 8 > frame.byteLength) {
      return null;
    }
    if (frame[offset + 9] !== 17) {
      return null;
    }
    saddr = ipv4(frame, offset + 12);
    daddr = ipv4(frame, offset + 16);
    udpStart = offset + ihl;
  } else if (version === 6) {
    if (offset + 40 + 8 > frame.byteLength) {
      return null;
    }
    if (frame[offset + 6] !== 17) {
      return null;
    }
    saddr = ipv6(frame, offset + 8);
    daddr = ipv6(frame, offset + 24);
    udpStart = offset + 40;
  } else {
    return null;
  }
  const sport = (frame[udpStart] << 8) | frame[udpStart + 1];
  const dport = (frame[udpStart + 2] << 8) | frame[udpStart + 3];
  const ulen = (frame[udpStart + 4] << 8) | frame[udpStart + 5];
  const max = frame.byteLength - (udpStart + 8);
  const declared = ulen >= 8 ? ulen - 8 : max;
  const payLen = declared > 0 && declared <= max ? declared : max;
  return {
    saddr,
    daddr,
    sport,
    dport,
    payload: frame.subarray(udpStart + 8, udpStart + 8 + payLen)
  };
}

export function udpDatagramFromFrame(frame: Uint8Array): { saddr: string; daddr: string; sport: number; dport: number; payload: Uint8Array } | null {
  if (!frame || frame.byteLength < 28) {
    return null;
  }
  if (frame.byteLength >= 14) {
    let etherType = (frame[12] << 8) | frame[13];
    let offset = 14;
    if ((etherType === 0x8100 || etherType === 0x88a8) && frame.byteLength >= 18) {
      etherType = (frame[16] << 8) | frame[17];
      offset = 18;
      if ((etherType === 0x8100 || etherType === 0x88a8) && frame.byteLength >= 22) {
        etherType = (frame[20] << 8) | frame[21];
        offset = 22;
      }
    }
    if (etherType === 0x0800 || etherType === 0x86dd) {
      const udp = udpDatagramFromIp(frame, offset);
      if (udp) {
        return udp;
      }
    }
  }
  if (frame.byteLength >= 16) {
    const proto = (frame[14] << 8) | frame[15];
    if (proto === 0x0800 || proto === 0x86dd) {
      const udp = udpDatagramFromIp(frame, 16);
      if (udp) {
        return udp;
      }
    }
  }
  if (frame.byteLength >= 28) {
    const proto2 = (frame[0] << 8) | frame[1];
    if (proto2 === 0x0800 || proto2 === 0x86dd) {
      const udp = udpDatagramFromIp(frame, 20);
      if (udp) {
        return udp;
      }
    }
  }
  if (frame.byteLength >= 32) {
    const af = frame[0];
    if (af === 2 || af === 24) {
      const udp = udpDatagramFromIp(frame, 4);
      if (udp) {
        return udp;
      }
    }
  }
  return udpDatagramFromIp(frame, 0);
}

export function udpPayloadFromFrame(frame: Uint8Array): Uint8Array | null {
  return udpDatagramFromFrame(frame)?.payload || null;
}

export function rtpPayloadFromUdp(udp: Uint8Array): RtpHeaderPayload | null {
  if (!udp || udp.byteLength < 12) {
    return null;
  }
  if ((udp[0] >> 6) !== 2) {
    return null;
  }
  const cc = udp[0] & 0x0f;
  const hasExt = (udp[0] & 0x10) !== 0;
  let hdr = 12 + cc * 4;
  if (hasExt) {
    if (udp.byteLength < hdr + 4) {
      return null;
    }
    const extLen = ((udp[hdr + 2] << 8) | udp[hdr + 3]) * 4;
    hdr += 4 + extLen;
  }
  if (hdr > udp.byteLength) {
    return null;
  }
  let end = udp.byteLength;
  if (udp[0] & 0x20) {
    const pad = udp[udp.byteLength - 1];
    if (pad > 0 && hdr + pad <= udp.byteLength) {
      end -= pad;
    }
  }
  const ssrc = ((udp[8] << 24) | (udp[9] << 16) | (udp[10] << 8) | udp[11]) >>> 0;
  return {
    ssrc: ssrc.toString(16),
    pt: udp[1] & 0x7f,
    seq: (udp[2] << 8) | udp[3],
    timestamp: ((udp[4] << 24) | (udp[5] << 16) | (udp[6] << 8) | udp[7]) >>> 0,
    marker: (udp[1] & 0x80) !== 0,
    payload: udp.subarray(hdr, Math.max(hdr, end))
  };
}

export function parseRtpDatagram(frame: Uint8Array, requirePayload = true): RtpDatagram | null {
  const udp = udpDatagramFromFrame(frame);
  if (!udp) {
    return null;
  }
  const rtp = rtpPayloadFromUdp(udp.payload);
  if (!rtp) {
    return null;
  }
  if (requirePayload && !rtp.payload.byteLength) {
    return null;
  }
  return {
    saddr: udp.saddr,
    sport: udp.sport,
    daddr: udp.daddr,
    dport: udp.dport,
    ssrc: rtp.ssrc,
    pt: rtp.pt,
    seq: rtp.seq,
    timestamp: rtp.timestamp,
    marker: rtp.marker,
    payload: rtp.payload
  };
}

function joinPayloads(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return joined;
}

export function normRtpSsrc(ssrc: string | number | undefined): string {
  if (typeof ssrc === 'number') {
    return ssrc.toString(16).toLowerCase();
  }
  return String(ssrc || '').replace(/^0x/i, '').toLowerCase();
}

function addrMatch(a: string, b: string): boolean {
  if (!a || !b) {
    return true;
  }
  return a.toLowerCase() === b.toLowerCase();
}

export function rtpEndpointsMatch(
  a: { saddr?: string; sport?: number; daddr?: string; dport?: number; ssrc?: string | number },
  b: { saddr?: string; sport?: number; daddr?: string; dport?: number; ssrc?: string | number }
): boolean {
  if (normRtpSsrc(a.ssrc) !== normRtpSsrc(b.ssrc)) {
    return false;
  }
  const ap = Number(a.sport) || 0;
  const bp = Number(b.sport) || 0;
  const ad = Number(a.dport) || 0;
  const bd = Number(b.dport) || 0;
  if (ap && bp && ap !== bp) {
    return false;
  }
  if (ad && bd && ad !== bd) {
    return false;
  }
  if (a.saddr && b.saddr && !addrMatch(a.saddr, b.saddr)) {
    return false;
  }
  if (a.daddr && b.daddr && !addrMatch(a.daddr, b.daddr)) {
    return false;
  }
  return true;
}

export function rtpPayloadForStream(buffer: ArrayBuffer | Uint8Array, stream: { saddr?: string; sport?: number; daddr?: string; dport?: number; ssrc?: string | number }): Uint8Array | null {
  const parts: Uint8Array[] = [];
  for (const frame of parseCapturePackets(buffer)) {
    const rtp = parseRtpDatagram(frame);
    if (!rtp || !rtpEndpointsMatch(rtp, stream)) {
      continue;
    }
    parts.push(rtp.payload);
  }
  if (!parts.length) {
    return null;
  }
  return joinPayloads(parts);
}

export interface RtpTimedPayload {
  ts: number;
  payload: Uint8Array;
}

export interface RtpTimedPacket {
  f: number;
  t: number;
  sn: number;
  rtpTs: number;
  marker: boolean;
  payloadLen: number;
  pt: number;
  ssrc: string;
}

export function rtpPacketsForStream(
  buffer: ArrayBuffer | Uint8Array,
  stream: { saddr?: string; sport?: number; daddr?: string; dport?: number; ssrc?: string | number; items?: Array<{ f?: number; sn?: string | number }> }
): RtpTimedPacket[] {
  const packets: RtpTimedPacket[] = [];
  let frameNo = 0;
  for (const timed of parseCapturePacketsTimed(buffer)) {
    frameNo += 1;
    const rtp = parseRtpDatagram(timed.bytes, false);
    if (!rtp || !rtpEndpointsMatch(rtp, stream)) {
      continue;
    }
    packets.push({
      f: frameNo,
      t: timed.ts,
      sn: rtp.seq,
      rtpTs: rtp.timestamp,
      marker: rtp.marker,
      payloadLen: rtp.payload.byteLength,
      pt: rtp.pt,
      ssrc: rtp.ssrc
    });
  }
  const items = stream?.items || [];
  if (items.length === packets.length) {
    packets.forEach((p, i) => {
      const f = Number(items[i]?.f);
      if (Number.isFinite(f) && f > 0) {
        p.f = f;
      }
    });
  } else if (items.length) {
    const bySn = new Map(items.map((it) => [Number(it.sn), Number(it.f)]));
    for (const p of packets) {
      const f = bySn.get(p.sn);
      if (Number.isFinite(f) && (f as number) > 0) {
        p.f = f as number;
      }
    }
  }
  return packets;
}

export interface RtpAudioClip {
  startTime: number;
  endTime: number;
  bytes: Uint8Array;
}

const MIN_GAP_SEC = 0.02;
const MAX_GAP_SEC = 30;
const MAX_START_PAD_SEC = 120;

function silenceBytes(fill: number, count: number): Uint8Array {
  const n = Math.max(0, Math.round(count));
  const out = new Uint8Array(n);
  out.fill(fill);
  return out;
}

export function stitchRtpPayloads(packets: RtpTimedPayload[], codec: string): RtpAudioClip | null {
  if (!packets?.length) {
    return null;
  }
  const sorted = packets.slice().sort((a, b) => a.ts - b.ts);
  const rate = rtpBytesPerSecond(codec) || 8000;
  const fill = rtpSilenceByte(codec);
  const pad = codecAllowsBitstreamPad(codec);
  const parts: Uint8Array[] = [];
  let prevEnd = sorted[0].ts;
  for (const pkt of sorted) {
    const gap = pkt.ts - prevEnd;
    if (pad && gap >= MIN_GAP_SEC) {
      parts.push(silenceBytes(fill, Math.min(gap, MAX_GAP_SEC) * rate));
    }
    parts.push(pkt.payload);
    prevEnd = pkt.ts + pkt.payload.byteLength / rate;
  }
  return {
    startTime: sorted[0].ts,
    endTime: prevEnd,
    bytes: joinPayloads(parts)
  };
}

export function padRtpAudio(clip: RtpAudioClip, sessionStart: number, codec: string): Uint8Array {
  if (!codecAllowsBitstreamPad(codec)) {
    return clip.bytes;
  }
  const delay = Math.max(0, clip.startTime - sessionStart);
  if (delay < MIN_GAP_SEC) {
    return clip.bytes;
  }
  const fill = rtpSilenceByte(codec);
  const rate = rtpBytesPerSecond(codec) || 8000;
  const prefix = silenceBytes(fill, Math.min(delay, MAX_START_PAD_SEC) * rate);
  return joinPayloads([prefix, clip.bytes]);
}

export function rtpAudioForStream(
  buffer: ArrayBuffer | Uint8Array,
  stream: { saddr?: string; sport?: number; daddr?: string; dport?: number; ssrc?: string | number },
  codec: string
): RtpAudioClip | null {
  const packets: RtpTimedPayload[] = [];
  for (const frame of parseCapturePacketsTimed(buffer)) {
    const rtp = parseRtpDatagram(frame.bytes);
    if (!rtp || !rtpEndpointsMatch(rtp, stream)) {
      continue;
    }
    packets.push({ ts: frame.ts, payload: rtp.payload });
  }
  return stitchRtpPayloads(packets, codec);
}

export function blobForAlignedStream(
  buffer: ArrayBuffer | Uint8Array,
  stream: { saddr?: string; sport?: number; daddr?: string; dport?: number; ssrc?: string | number },
  codec: string,
  sessionStart: number
): Blob | null {
  const clip = rtpAudioForStream(buffer, stream, codec);
  if (!clip) {
    return null;
  }
  return blobFromPaddedClip(clip, sessionStart, codec);
}

export function blobFromPaddedClip(clip: RtpAudioClip, sessionStart: number, codec: string): Blob | null {
  const bytes = padRtpAudio(clip, sessionStart, codec);
  if (!bytes.byteLength) {
    return null;
  }
  return new Blob([copyToArrayBuffer(bytes)], { type: 'application/octet-stream' });
}

function dumpToBytes(raw: any): Uint8Array {
  if (raw instanceof Uint8Array) {
    return raw;
  }
  if (ArrayBuffer.isView(raw)) {
    const view = raw as Uint8Array;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  const s = String(raw || '').replace(/[^0-9a-fA-F]/g, '');
  if (!s || s.length % 2) {
    return new Uint8Array();
  }
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function walkProtoTree(nodes: any[], visit: (node: any) => void) {
  for (const node of nodes || []) {
    if (!node) {
      continue;
    }
    visit(node);
    walkProtoTree(node.n || node.tree || [], visit);
  }
}

export function rtpPayloadFromTree(tree: any[], bytes: Uint8Array): Uint8Array | null {
  const box = { payload: null as Uint8Array | null };
  walkProtoTree(tree || [], (node) => {
    const filter = String(node.f || node.filter || '');
    if (filter !== 'rtp.payload' && filter.indexOf('rtp.payload') !== 0) {
      return;
    }
    const start = Number(node.start ?? node.h?.[0]) || 0;
    const len = Number(node.length ?? node.h?.[1]) || 0;
    if (len > 0 && start >= 0 && start + len <= bytes.byteLength) {
      box.payload = bytes.subarray(start, start + len);
    }
  });
  const found = box.payload;
  if (!found || found.byteLength === 0) {
    return null;
  }
  return found;
}

export interface RtpDumpPacket {
  t?: number;
  ts?: number;
  bytes?: Uint8Array | string;
  payload?: Uint8Array | string | null;
  info?: string;
  saddr?: string;
  sport?: number;
  daddr?: string;
  dport?: number;
  ssrc?: string | number;
}

export function rtpAudioFromDump(
  packets: RtpDumpPacket[],
  stream: { saddr?: string; sport?: number; daddr?: string; dport?: number; ssrc?: string | number },
  codec: string
): RtpAudioClip | null {
  const timed: RtpTimedPayload[] = [];
  for (const pkt of packets || []) {
    const frameBytes = dumpToBytes(pkt.bytes);
    let payload = pkt.payload instanceof Uint8Array ? pkt.payload : dumpToBytes(pkt.payload);
    let rtp = frameBytes.byteLength ? parseRtpDatagram(frameBytes) : null;
    if ((!payload || !payload.byteLength) && rtp) {
      payload = rtp.payload;
    }
    if (!payload?.byteLength) {
      continue;
    }
    const identity = rtp || {
      saddr: pkt.saddr,
      sport: pkt.sport,
      daddr: pkt.daddr,
      dport: pkt.dport,
      ssrc: pkt.ssrc ?? stream.ssrc
    };
    if (!rtpEndpointsMatch(identity, stream)) {
      continue;
    }
    const ts = Number(pkt.ts ?? pkt.t) || 0;
    timed.push({ ts, payload });
  }
  return stitchRtpPayloads(timed, codec);
}

export function sessionStartForClips(clips: Array<{ startTime: number }>): number {
  if (!clips.length) {
    return 0;
  }
  return Math.min(...clips.map((c) => c.startTime));
}

export function blobForStream(buffer: ArrayBuffer | Uint8Array, stream: { saddr?: string; sport?: number; daddr?: string; dport?: number; ssrc?: string | number }): Blob | null {
  const bytes = rtpPayloadForStream(buffer, stream);
  if (!bytes || !bytes.byteLength) {
    return null;
  }
  return new Blob([copyToArrayBuffer(bytes)], { type: 'application/octet-stream' });
}

export function rtpPayloadsBySsrc(buffer: ArrayBuffer | Uint8Array): Map<string, Uint8Array> {
  const grouped = new Map<string, Uint8Array[]>();
  for (const frame of parseCapturePackets(buffer)) {
    const rtp = parseRtpDatagram(frame);
    if (!rtp) {
      continue;
    }
    const key = rtp.ssrc.toLowerCase();
    const list = grouped.get(key) || [];
    list.push(rtp.payload);
    grouped.set(key, list);
  }
  const out = new Map<string, Uint8Array>();
  grouped.forEach((parts, ssrc) => {
    out.set(ssrc, joinPayloads(parts));
  });
  return out;
}

export function blobForSsrc(payloads: Map<string, Uint8Array>, ssrc: string): Blob | null {
  const hex = String(ssrc || '').replace(/^0x/i, '').toLowerCase();
  const bytes = payloads.get(hex);
  if (!bytes || !bytes.byteLength) {
    return null;
  }
  return new Blob([copyToArrayBuffer(bytes)], { type: 'application/octet-stream' });
}

export function getTranscode(): (blob: Blob, codec: string, output: string) => Promise<string | undefined> {
  const fn = (globalThis as any).transcode;
  if (typeof fn !== 'function') {
    throw new Error('ffmpeg transcode() is not available');
  }
  return fn;
}
