export function displayFilterProto(proto = 'ip'): string {
  const p = String(proto || '').toLowerCase();
  if (p === 'ipv4' || p === 'ip') {
    return 'ip';
  }
  if (p === 'ipv6') {
    return 'ipv6';
  }
  if (p === 'ethernet' || p === 'eth') {
    return 'eth';
  }
  return p || 'ip';
}

function hasPort(value: any): boolean {
  return value != null && value !== '' && value !== 0 && value !== '0';
}

export function conversationDisplayFilter(conv: any, proto = 'ip'): string {
  if (!conv) {
    return '';
  }
  const p = displayFilterProto(proto);
  if (conv.host && !conv.saddr) {
    if (hasPort(conv.port)) {
      return `${p}.addr eq ${conv.host} and ${p}.port eq ${conv.port}`;
    }
    return `${p}.addr eq ${conv.host}`;
  }
  const saddr = conv.saddr || conv.src || conv.ip || '';
  const daddr = conv.daddr || conv.dst || '';
  const sport = conv.sport;
  const dport = conv.dport;
  if (saddr && daddr && hasPort(sport) && hasPort(dport)) {
    return `(${p}.addr eq ${saddr} and ${p}.addr eq ${daddr}) and (${p}.port eq ${sport} and ${p}.port eq ${dport})`;
  }
  if (saddr && daddr) {
    return `${p}.addr eq ${saddr} and ${p}.addr eq ${daddr}`;
  }
  return '';
}

export function expertSeverityFilter(severity: string): string {
  if (!severity) {
    return 'expert';
  }
  return `expert.severity == ${severity}`;
}

export function exportObjectToken(tapName: string, row: number): string {
  return `eo:${tapName}:${row}`;
}

export function followFromFrame(fol: Array<[string, string]> | undefined, prefer?: string): { proto: string; filter: string } | null {
  const pairs = (fol || []).map(asFollowPair).filter((p): p is { proto: string; filter: string } => !!p);
  if (!pairs.length) {
    return null;
  }
  if (prefer) {
    const hit = pairs.find((item) => item.proto.toLowerCase() === prefer.toLowerCase());
    if (hit) {
      return hit;
    }
  }
  const withStream = pairs.find((item) => /\.stream\b/i.test(item.filter));
  return withStream || pairs[0];
}

function asFollowPair(item: any): { proto: string; filter: string } | null {
  if (!item) {
    return null;
  }
  if (Array.isArray(item)) {
    const proto = String(item[0] || '').trim();
    const filter = String(item[1] || '').trim();
    if (proto && filter) {
      return { proto, filter };
    }
    return null;
  }
  const proto = String(item.proto || item[0] || '').trim();
  const filter = String(item.filter || item[1] || '').trim();
  if (proto && filter) {
    return { proto, filter };
  }
  return null;
}

export function normalizeFollowProto(proto: string): string {
  const p = String(proto || '').trim().toUpperCase();
  if (p === 'TCP' || p === 'UDP' || p === 'TLS' || p === 'HTTP' || p === 'HTTP2' || p === 'QUIC' || p === 'SIP') {
    return p === 'HTTP2' ? 'HTTP2' : p;
  }
  if (p === 'SIP') {
    return 'SIP';
  }
  return p || 'TCP';
}

export function followHintFromTree(tree: any[]): { proto: string; filter: string } | null {
  let found: { proto: string; filter: string } | null = null;
  const walk = (nodes: any[]) => {
    for (const node of nodes || []) {
      const filter = String(node?.f || node?.filter || '');
      const label = String(node?.l || node?.label || '');
      const streamField = filter.match(/^(tcp|udp|tls)\.stream$/i);
      const streamLabel = label.match(/\b(TCP|UDP|TLS)\b.*Stream index:\s*(\d+)/i);
      const eq = filter.match(/^(tcp|udp|tls)\.stream\s*(?:eq|==)\s*(\d+)/i);
      if (eq) {
        found = { proto: normalizeFollowProto(eq[1]), filter: `${eq[1].toLowerCase()}.stream eq ${eq[2]}` };
        return;
      }
      if (streamField) {
        const idx = label.match(/(\d+)/);
        if (idx) {
          found = { proto: normalizeFollowProto(streamField[1]), filter: `${streamField[1].toLowerCase()}.stream eq ${idx[1]}` };
          return;
        }
      }
      if (streamLabel) {
        found = { proto: normalizeFollowProto(streamLabel[1]), filter: `${streamLabel[1].toLowerCase()}.stream eq ${streamLabel[2]}` };
        return;
      }
      walk(node?.n || node?.tree || []);
      if (found) {
        return;
      }
    }
  };
  walk(tree || []);
  return found;
}

export function completeFieldNames(result: any): string[] {
  if (!result) {
    return [];
  }
  if (Array.isArray(result.field)) {
    return result.field.map((item: any) => item.f || item.name || String(item));
  }
  if (Array.isArray(result)) {
    return result.map((item: any) => item.f || item.name || String(item));
  }
  return [];
}

export function iographSeries(result: any): number[] {
  const items = result?.iograph?.[0]?.items || result?.items || [];
  return items.map((n: any) => Number(n) || 0);
}

function asList(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

/** Normalize sharkd `info` so Statistics menus can render without a capture or on error JSON. */
export function tapInfoLists(info: any): {
  stats: any[];
  nstat: any[];
  convs: any[];
  endpts: any[];
  seqa: any[];
  taps: any[];
  eo: any[];
  srt: any[];
  rtd: any[];
} {
  if (!info || info.err || info.error || info.errstr) {
    return { stats: [], nstat: [], convs: [], endpts: [], seqa: [], taps: [], eo: [], srt: [], rtd: [] };
  }
  return {
    stats: asList(info.stats),
    nstat: asList(info.nstat),
    convs: asList(info.convs),
    endpts: asList(info.endpts),
    seqa: asList(info.seqa),
    taps: asList(info.taps),
    eo: asList(info.eo),
    srt: asList(info.srt),
    rtd: asList(info.rtd)
  };
}
