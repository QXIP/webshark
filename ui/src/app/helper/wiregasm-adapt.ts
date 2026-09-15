export function captureFileUrl(name: string): string {
  const base = String(name || '').replace(/^\/+/, '');
  return `/webshark/captures/${encodeURIComponent(base)}`;
}

export function vectorToArray<T = any>(vec: any): T[] {
  if (!vec) {
    return [];
  }
  if (Array.isArray(vec)) {
    return vec;
  }
  if (typeof vec.size === 'function' && typeof vec.get === 'function') {
    const out: T[] = [];
    const n = vec.size();
    for (let i = 0; i < n; i++) {
      out.push(vec.get(i));
    }
    return out;
  }
  return [];
}

export function colorToCss(value: number | string | undefined): string | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.replace(/^#/, '');
  }
  return (value >>> 0).toString(16).padStart(6, '0');
}

export function frameMetaToRow(meta: any): { c: any[]; num: number; bg?: string; fg?: string } {
  const columns = vectorToArray(meta?.columns);
  const num = Number(meta?.number ?? columns[0] ?? 0);
  const c = columns.length ? columns.map((v) => (v == null ? '' : String(v))) : [String(num)];
  return {
    c,
    num,
    bg: colorToCss(meta?.bg),
    fg: colorToCss(meta?.fg)
  };
}

export function framesToSharkd(result: any): any[] {
  if (Array.isArray(result)) {
    return result.map((row) => row.c ? row : frameMetaToRow(row));
  }
  return vectorToArray(result?.frames).map((meta) => frameMetaToRow(meta));
}

export function protoTreeToSharkd(node: any): any {
  if (!node) {
    return node;
  }
  const children = vectorToArray(node.tree || node.n).map((child) => protoTreeToSharkd(child));
  const start = node.start ?? node.h?.[0] ?? 0;
  const length = node.length ?? node.h?.[1] ?? 0;
  return {
    l: node.l || node.label || '',
    f: node.f || node.filter || '',
    h: [start, length],
    n: children.length ? children : undefined
  };
}

export function frameToSharkd(frame: any): any {
  if (!frame) {
    return { bytes: '', tree: [], fol: [] };
  }
  const sources = vectorToArray(frame.data_sources);
  const first = sources[0] as any;
  const follow = vectorToArray(frame.follow).map((pair: any) => {
    const cells = vectorToArray(pair);
    return [cells[0], cells[1]];
  });
  return {
    bytes: first?.data || frame.bytes || '',
    tree: vectorToArray(frame.tree).map((n) => protoTreeToSharkd(n)),
    fol: follow,
    comments: vectorToArray(frame.comments)
  };
}

function maybeDecodePayload(data: any): string {
  if (data == null || typeof data === 'object') {
    return '';
  }
  const s = String(data);
  if (!s) {
    return '';
  }
  if (s.length % 4 === 0 && s.length >= 8 && /^[A-Za-z0-9+/]+={0,2}$/.test(s) && !/\s/.test(s)) {
    try {
      return atob(s);
    } catch {
      return s;
    }
  }
  return s;
}

export function followToSharkd(follow: any): any {
  if (!follow) {
    return follow;
  }
  const payloads = vectorToArray(follow.payloads || follow.payload).map((p: any) => {
    if (typeof p === 'string') {
      return { n: undefined, d: maybeDecodePayload(p), s: 0 };
    }
    return {
      n: p?.number ?? p?.n,
      d: maybeDecodePayload(p?.data ?? p?.d ?? ''),
      s: p?.server ?? p?.s
    };
  });
  return {
    shost: follow.shost,
    sport: follow.sport,
    sbytes: follow.sbytes,
    chost: follow.chost,
    dhost: follow.dhost || follow.chost,
    cport: follow.cport,
    dport: follow.dport || follow.cport,
    cbytes: follow.cbytes,
    payload: payloads,
    payloads
  };
}

function convRow(c: any): any {
  return {
    saddr: c?.saddr || '',
    daddr: c?.daddr || '',
    sport: c?.sport ?? '',
    dport: c?.dport ?? '',
    txf: Number(c?.txf || 0),
    txb: Number(c?.txb || 0),
    rxf: Number(c?.rxf || 0),
    rxb: Number(c?.rxb || 0),
    start: c?.start,
    stop: c?.stop,
    filter: c?.filter || ''
  };
}

function hostRow(h: any): any {
  return {
    host: h?.host || h?.saddr || '',
    port: h?.port ?? '',
    txf: Number(h?.txf || 0),
    txb: Number(h?.txb || 0),
    rxf: Number(h?.rxf || 0),
    rxb: Number(h?.rxb || 0),
    filter: h?.filter || ''
  };
}

function eoRow(o: any): any {
  return {
    hostname: o?.hostname || '',
    pkt: o?.pkt,
    type: o?.type || '',
    filename: o?.filename || o?.name || '',
    _download: o?._download || '',
    len: Number(o?.len || 0)
  };
}

export function tapToSharkd(result: any): any {
  if (!result) {
    return { taps: [] };
  }
  const taps = vectorToArray(result.taps).map((tap: any) => {
    const type = tap?.type || '';
    return {
      tap: tap?.tap || '',
      type,
      proto: tap?.proto || '',
      geoip: !!tap?.geoip,
      convs: vectorToArray(tap?.convs).map(convRow),
      hosts: vectorToArray(tap?.hosts).map(hostRow),
      objects: vectorToArray(tap?.objects).map(eoRow),
      streams: vectorToArray(tap?.streams),
      items: vectorToArray(tap?.items)
    };
  });
  return { error: result.error || '', taps };
}

export function tapDisplayRows(tap: any): any[] {
  if (!tap) {
    return [];
  }
  if (Array.isArray(tap)) {
    return tap;
  }
  const type = String(tap.type || '');
  if (type === 'endpt') {
    return vectorToArray(tap.hosts);
  }
  if (type === 'eo') {
    return vectorToArray(tap.objects);
  }
  if (type === 'rtp-streams') {
    return vectorToArray(tap.streams);
  }
  if (type === 'rtp-analyse' || type === 'expert') {
    return vectorToArray(tap.items);
  }
  if (type === 'conv') {
    return vectorToArray(tap.convs);
  }
  const preferred = ['convs', 'hosts', 'objects', 'streams', 'items'];
  for (const key of preferred) {
    const rows = vectorToArray(tap[key]);
    if (rows.length) {
      return rows;
    }
  }
  return [];
}

export function tapTableTitle(tap: any): string {
  if (!tap || Array.isArray(tap)) {
    return '';
  }
  const bits = [tap.proto, tap.type, tap.tap].filter((v) => v != null && v !== '' && typeof v !== 'object');
  return bits.join(' · ');
}

export function tapColumnKeys(row: any): string[] {
  if (!row || typeof row !== 'object') {
    return [];
  }
  return Object.keys(row).filter((key) => {
    if (key.startsWith('_') || key === 'items' || key === '__selected') {
      return false;
    }
    const value = row[key];
    return value == null || typeof value !== 'object';
  });
}

export function tapCellValue(value: any): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    return Array.isArray(value) ? String(value.length) : '';
  }
  return String(value);
}

export function iographToSharkd(result: any): any {
  const graphs = vectorToArray(result?.iograph).map((g: any) => ({
    items: vectorToArray(g?.items).map((n: any) => Number(n) || 0)
  }));
  return { error: result?.error || '', iograph: graphs };
}

export function completeToSharkd(result: any): any {
  const fields = vectorToArray(result?.fields || result?.field).map((f: any) => ({
    f: f.f || f.field || f.name || String(f),
    n: f.n || f.name || f.field || ''
  }));
  return { field: fields };
}

export function checkToSharkd(result: any): any {
  const ok = result?.ok !== false && !result?.err;
  const error = result?.error || result?.errstr || '';
  return { ok, error, err: ok ? 0 : 1, errstr: error };
}

const PROTO_TAPS = ['Ethernet', 'IPv4', 'IPv6', 'TCP', 'UDP', 'SIP'];

export function staticTapInfo(): any {
  return {
    version: 'wiregasm',
    convs: PROTO_TAPS.map((name) => ({ name, tap: `conv:${name}` })),
    endpts: PROTO_TAPS.map((name) => ({ name, tap: `endpt:${name}` })),
    nstat: [],
    stats: [],
    seqa: [],
    taps: [
      { name: 'Expert Info', tap: 'expert' }
    ],
    eo: [
      { name: 'HTTP', tap: 'eo:http' },
      { name: 'TFTP', tap: 'eo:tftp' },
      { name: 'SMB', tap: 'eo:smb' }
    ],
    srt: [],
    rtd: []
  };
}
