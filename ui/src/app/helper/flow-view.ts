import { formatFlowTime } from './voip-calls';

export function flowLaneCenter(index: number, count: number): number {
  const n = Math.max(1, count);
  return ((Number(index) + 0.5) / n) * 100;
}

export function flowArrowBox(pair: number[], count: number): { left: number; width: number; reverse: boolean } {
  const a = Number(pair?.[0]) || 0;
  const b = Number(pair?.[1]) || 0;
  const c0 = flowLaneCenter(a, count);
  const c1 = flowLaneCenter(b, count);
  const width = Math.abs(c1 - c0);
  return {
    left: Math.min(c0, c1),
    width: width < 8 ? 8 : width,
    reverse: a > b
  };
}

export function flowColorKey(value: any): string {
  if (Array.isArray(value)) {
    return value.map(String).join(',');
  }
  return String(value ?? '');
}

export function packetFlowFromFrames(
  frames: Array<{ c?: any[] }>,
  limit = 400
): { nodes: string[]; flows: any[] } {
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
  const flows: any[] = [];
  for (const frame of (frames || []).slice(0, limit)) {
    const c = frame.c || [];
    const saddr = String(c[2] || '');
    const daddr = String(c[3] || '');
    if (!saddr || !daddr || saddr === daddr) {
      continue;
    }
    const proto = String(c[4] || '');
    const info = String(c[6] || '');
    flows.push({
      t: formatFlowTime(c[1]),
      n: [indexOf(saddr), indexOf(daddr)],
      c: info ? `${proto} · ${info}` : proto,
      pn: c[0]
    });
  }
  return { nodes, flows };
}
