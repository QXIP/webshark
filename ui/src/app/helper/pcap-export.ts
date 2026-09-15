import { bytesFromFrameDump } from './follow-extract';

export function pcapTimestamp(time: any): { sec: number; usec: number } {
  const n = Number(time);
  if (!Number.isFinite(n) || n < 0) {
    return { sec: 0, usec: 0 };
  }
  const sec = Math.floor(n);
  let usec = Math.round((n - sec) * 1e6);
  if (usec >= 1000000) {
    return { sec: sec + 1, usec: 0 };
  }
  return { sec, usec };
}

export function filteredPcapFilename(capture: string, filter: string): string {
  const base = String(capture || 'capture').split(/[/\\]/).pop() || 'capture';
  const stem = base.replace(/\.(pcapng|pcap|cap)$/i, '') || 'capture';
  return filter ? `${stem}-filtered.pcap` : `${stem}.pcap`;
}

export function buildClassicPcap(
  packets: Array<{ t?: number; bytes?: Uint8Array | string }>,
  linktype = 1
): Uint8Array {
  const rows = (packets || [])
    .map((p) => ({
      t: Number(p.t) || 0,
      bytes: p.bytes instanceof Uint8Array ? p.bytes : bytesFromFrameDump(p.bytes)
    }))
    .filter((p) => p.bytes.byteLength > 0);
  const snaplen = 262144;
  let payload = 0;
  for (const row of rows) {
    payload += 16 + Math.min(row.bytes.byteLength, snaplen);
  }
  const out = new Uint8Array(24 + payload);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0xa1b2c3d4, true);
  view.setUint16(4, 2, true);
  view.setUint16(6, 4, true);
  view.setInt32(8, 0, true);
  view.setUint32(12, 0, true);
  view.setUint32(16, snaplen, true);
  view.setUint32(20, linktype >>> 0, true);
  let offset = 24;
  for (const row of rows) {
    const { sec, usec } = pcapTimestamp(row.t);
    const incl = Math.min(row.bytes.byteLength, snaplen);
    view.setUint32(offset, sec, true);
    view.setUint32(offset + 4, usec, true);
    view.setUint32(offset + 8, incl, true);
    view.setUint32(offset + 12, row.bytes.byteLength, true);
    out.set(row.bytes.subarray(0, incl), offset + 16);
    offset += 16 + incl;
  }
  return out;
}

export function triggerBrowserDownload(data: Blob | Uint8Array, filename: string, mime = 'application/vnd.tcpdump.pcap') {
  if (typeof document === 'undefined') {
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
