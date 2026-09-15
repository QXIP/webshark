import { rtpStreamToken } from './share-url';
import { tapColumnKeys, vectorToArray } from './wiregasm-adapt';
import { analyseRtpItems, rtpClockRate } from './rtp-analyse';

export function parseRtpInfo(info: string): { ssrc: string; payload: string; seq?: string } {
  const text = String(info || '');
  const ssrcMatch = text.match(/SSRC\s*=\s*(?:0x)?([0-9a-fA-F]+)/i);
  const ptMatch = text.match(/PT\s*=\s*([^,]+)/i);
  const seqMatch = text.match(/Seq\s*=\s*(\d+)/i);
  return {
    ssrc: ssrcMatch ? ssrcMatch[1].toLowerCase() : '',
    payload: ptMatch ? ptMatch[1].trim() : '',
    seq: seqMatch ? seqMatch[1] : undefined
  };
}

export function portsFromProtoTree(tree: any[]): { src: number; dst: number } {
  const out = { src: 0, dst: 0 };
  const walk = (nodes: any[]) => {
    for (const node of nodes || []) {
      const filter = String(node?.f || node?.filter || '');
      const label = String(node?.l || node?.label || '');
      const src = filter.match(/^(?:udp|tcp)\.srcport$/) || label.match(/(?:Src|Source) Port:\s*(\d+)/i);
      const dst = filter.match(/^(?:udp|tcp)\.dstport$/) || label.match(/(?:Dst|Destination) Port:\s*(\d+)/i);
      if (src && !out.src) {
        const digits = label.match(/(\d+)/);
        out.src = Number(Array.isArray(src) && src[1] ? src[1] : digits?.[1]) || 0;
      }
      if (dst && !out.dst) {
        const digits = label.match(/(\d+)/);
        out.dst = Number(Array.isArray(dst) && dst[1] ? dst[1] : digits?.[1]) || 0;
      }
      walk(node?.n || node?.tree || []);
    }
  };
  walk(tree || []);
  return out;
}

export function groupRtpStreams(frames: Array<{ c?: any[]; num?: number }>): any[] {
  const groups = new Map<string, any>();
  for (const frame of frames || []) {
    const c = frame.c || [];
    const proto = String(c[4] || '').toUpperCase();
    if (proto && proto.indexOf('RTP') === -1) {
      continue;
    }
    const parsed = parseRtpInfo(String(c[6] || ''));
    if (!parsed.ssrc) {
      continue;
    }
    const t = Number(c[1]);
    const start = Number.isFinite(t) ? t : c[1];
    const row: any = {
      saddr: String(c[2] || ''),
      sport: Number(c[7] || 0) || 0,
      daddr: String(c[3] || ''),
      dport: Number(c[8] || 0) || 0,
      ssrc: parsed.ssrc,
      payload: parsed.payload,
      pkts: 1,
      items: [] as any[]
    };
    const token = rtpStreamToken(row);
    const existing = groups.get(token);
    const item = {
      f: c[0],
      t: start,
      sn: parsed.seq,
      d: 0,
      j: 0,
      sk: 0,
      mark: 0,
      bw: 0
    };
    if (existing) {
      existing.pkts += 1;
      existing.items.push(item);
      existing.stop = item.t;
    } else {
      row.start = item.t;
      row.stop = item.t;
      row.items = [item];
      groups.set(token, row);
    }
  }
  return Array.from(groups.values()).map(finalizeRtpStream);
}

function finalizeRtpStream(row: any): any {
  const analysed = analyseRtpItems(row.items || [], rtpClockRate(undefined, row.payload));
  row.items = analysed.items;
  row.lost = analysed.stats.lost;
  row.expected = analysed.stats.expected;
  row.max_delta = analysed.stats.maxDelta;
  row.max_jitter = analysed.stats.maxJitter;
  row.mean_jitter = analysed.stats.meanJitter;
  row.max_skew = analysed.stats.maxSkew;
  row.seq_err = analysed.stats.seqErrs;
  return row;
}

export function publicRtpStreams(streams: any[]): any[] {
  return (streams || []).map((stream) => {
    const { items, ...rest } = stream || {};
    return rest;
  });
}

export function rtpStreamColumns(stream: any): string[] {
  return tapColumnKeys(stream);
}

export async function enrichRtpPorts(
  streams: any[],
  getFrame: (n: number) => Promise<any>
): Promise<any[]> {
  await Promise.all((streams || []).map(async (stream) => {
    if ((stream.sport && stream.dport) || !stream.items?.[0]?.f) {
      return;
    }
    const frame = await getFrame(Number(stream.items[0].f));
    const ports = portsFromProtoTree(frame?.tree || []);
    if (ports.src) {
      stream.sport = ports.src;
    }
    if (ports.dst) {
      stream.dport = ports.dst;
    }
  }));
  return streams;
}

export function rtpAnalyseFromStream(stream: any, tap: string): any {
  if (!stream) {
    return { taps: [{ tap, type: 'rtp-analyse', ssrc: '', items: [] }] };
  }
  return {
    taps: [{
      tap,
      type: 'rtp-analyse',
      ssrc: stream.ssrc,
      items: vectorToArray(stream.items)
    }]
  };
}

export function rtpStreamsTap(frames: Array<{ c?: any[] }>): any {
  return rtpStreamsTapFromGroups(groupRtpStreams(frames));
}

export function rtpStreamsTapFromGroups(streams: any[]): any {
  return {
    taps: [{
      tap: 'rtp-streams',
      type: 'rtp-streams',
      streams: publicRtpStreams(streams)
    }]
  };
}

export function findReverseRtp(streams: any[], row: any): any | null {
  if (!row) {
    return null;
  }
  const list = streams || [];
  const exact = list.find((s) =>
    s !== row &&
    s.saddr === row.daddr &&
    s.daddr === row.saddr &&
    Number(s.sport) === Number(row.dport) &&
    Number(s.dport) === Number(row.sport)
  );
  if (exact) {
    return exact;
  }
  return list.find((s) =>
    s !== row &&
    s.saddr === row.daddr &&
    s.daddr === row.saddr
  ) || null;
}
