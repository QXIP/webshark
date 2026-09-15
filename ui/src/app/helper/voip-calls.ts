import { findReverseRtp } from './rtp-from-frames';
import { rtpStreamToken } from './share-url';

function frameTime(c: any[]): number {
  const n = Number(c?.[1]);
  if (Number.isFinite(n)) {
    return n;
  }
  const parsed = Date.parse(String(c?.[1] || ''));
  return Number.isFinite(parsed) ? parsed / 1000 : 0;
}

function pairKey(a: string, b: string): string {
  return [a || '', b || ''].sort().join('|');
}

function sipUri(info: string, fallback: string): string {
  const match = String(info || '').match(/sip:[^\s>;]+/i);
  return match ? match[0] : fallback;
}

function isSipRequest(info: string, method: string): boolean {
  const text = String(info || '');
  if (/\bStatus:\s*\d+/i.test(text)) {
    return false;
  }
  return new RegExp(`\\b${method}\\b`).test(text);
}

export function rtpStreamsForCall(call: any, streams: any[]): any[] {
  const list = streams || [];
  if (!call || !list.length) {
    return [];
  }
  const ips = new Set((call.ips || [call.saddr, call.daddr]).filter(Boolean));
  const start = Number(call.start) || 0;
  const stop = Number(call.stop);
  const end = Number.isFinite(stop) ? stop : Infinity;
  const inWindow = (s: any) => {
    const t0 = Number(s.start);
    if (!Number.isFinite(t0)) {
      return true;
    }
    return t0 >= start - 1 && t0 <= end + 1;
  };
  const matched = list.filter((s) => inWindow(s) && (ips.has(s.saddr) || ips.has(s.daddr)));
  if (matched.length) {
    return matched;
  }
  return list.filter(inWindow);
}

export function groupVoipCalls(frames: Array<{ c?: any[] }>, rtpStreams: any[] = []): any[] {
  const calls: any[] = [];
  const byPair = new Map<string, any>();
  for (const frame of frames || []) {
    const c = frame.c || [];
    const proto = String(c[4] || '').toUpperCase();
    if (proto && proto.indexOf('SIP') === -1) {
      continue;
    }
    const info = String(c[6] || '');
    const saddr = String(c[2] || '');
    const daddr = String(c[3] || '');
    const t = frameTime(c);
    const pair = pairKey(saddr, daddr);
    const invite = isSipRequest(info, 'INVITE');
    const bye = /\bBYE\b/.test(info);
    let call = byPair.get(pair);
    if (invite && (!call || call.state === 'COMPLETED' || t - Number(call.stop) > 2)) {
      call = {
        id: `call-${calls.length + 1}`,
        start: t,
        stop: t,
        initial: saddr,
        from: saddr,
        to: sipUri(info, daddr),
        proto: 'SIP',
        packets: 0,
        state: 'IN_PROGRESS',
        saddr,
        daddr,
        ips: [saddr, daddr].filter(Boolean),
        items: []
      };
      calls.push(call);
      byPair.set(pair, call);
    }
    if (!call) {
      call = {
        id: `call-${calls.length + 1}`,
        start: t,
        stop: t,
        initial: saddr,
        from: saddr,
        to: daddr,
        proto: proto || 'SIP',
        packets: 0,
        state: 'IN_PROGRESS',
        saddr,
        daddr,
        ips: [saddr, daddr].filter(Boolean),
        items: []
      };
      calls.push(call);
      byPair.set(pair, call);
    }
    call.packets += 1;
    call.stop = t;
    if (saddr && !call.ips.includes(saddr)) {
      call.ips.push(saddr);
    }
    if (daddr && !call.ips.includes(daddr)) {
      call.ips.push(daddr);
    }
    call.items.push({ f: c[0], t, saddr, daddr, c: info });
    if (bye) {
      call.state = 'COMPLETED';
    } else if (/\bStatus:\s*200\b/i.test(info)) {
      call.state = 'IN_CALL';
    }
  }
  if (!calls.length && rtpStreams.length) {
    return rtpFallbackCalls(rtpStreams);
  }
  return calls.map((call) => attachRtp(call, rtpStreams));
}

function rtpFallbackCalls(rtpStreams: any[]): any[] {
  const used = new Set<any>();
  const calls: any[] = [];
  for (const stream of rtpStreams) {
    if (used.has(stream)) {
      continue;
    }
    const reverse = findReverseRtp(rtpStreams, stream);
    const group = reverse ? [stream, reverse] : [stream];
    group.forEach((s) => used.add(s));
    const start = Math.min(...group.map((s) => Number(s.start) || 0));
    const stop = Math.max(...group.map((s) => Number(s.stop) || 0));
    const call = {
      id: `call-${calls.length + 1}`,
      start,
      stop,
      initial: stream.saddr,
      from: stream.saddr,
      to: stream.daddr,
      proto: 'RTP',
      packets: group.reduce((n, s) => n + (Number(s.pkts) || 0), 0),
      state: 'IN_CALL',
      saddr: stream.saddr,
      daddr: stream.daddr,
      ips: group.flatMap((s) => [s.saddr, s.daddr]).filter(Boolean),
      items: []
    };
    calls.push(attachRtp(call, group));
  }
  return calls;
}

function attachRtp(call: any, rtpStreams: any[]): any {
  const rtp = rtpStreamsForCall(call, rtpStreams);
  call.rtpTokens = rtp.map((s) => rtpStreamToken(s));
  call.comments = rtp.length ? `${rtp.length} RTP stream(s)` : '';
  return call;
}

export function publicVoipCalls(calls: any[]): any[] {
  return (calls || []).map((call) => {
    const { ips, saddr, daddr, rtpTokens, ...rest } = call || {};
    return {
      ...rest,
      rtpTokens: rtpTokens || [],
      comments: call.comments || '',
      items: call.items || []
    };
  });
}

export function formatFlowTime(value: any): string {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return value == null ? '' : String(value);
  }
  return n.toFixed(6);
}

export function sipFlowFromCall(call: any): { nodes: string[]; flows: any[] } {
  const nodes: string[] = [];
  const indexOf = (ip: string) => {
    const name = String(ip || '');
    let i = nodes.indexOf(name);
    if (i < 0) {
      nodes.push(name);
      i = nodes.length - 1;
    }
    return i;
  };
  const flows = (call?.items || []).map((item: any) => {
    const from = indexOf(item.saddr);
    const to = indexOf(item.daddr);
    return {
      t: formatFlowTime(item.t),
      n: [from, to],
      c: String(item.c || ''),
      pn: item.f
    };
  }).filter((row: any) => row.c && row.n[0] !== row.n[1]);
  return { nodes, flows };
}

export function voipCallsTap(calls: any[]): any {
  return {
    taps: [{
      tap: 'voip-calls',
      type: 'voip-calls',
      calls: publicVoipCalls(calls)
    }]
  };
}
