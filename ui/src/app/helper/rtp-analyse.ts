export interface RtpAnalyseInput {
  f?: number;
  t: number;
  sn?: number;
  rtpTs?: number;
  marker?: boolean | number;
  payloadLen?: number;
  pt?: number;
}

export interface RtpAnalyseItem {
  f: number;
  t: number;
  sn: number;
  d: number;
  j: number;
  sk: number;
  bw: number;
  mark: number;
  s: string;
}

export interface RtpAnalyseStats {
  packets: number;
  expected: number;
  lost: number;
  lostPct: number;
  seqErrs: number;
  maxDelta: number;
  minDelta: number;
  maxJitter: number;
  meanJitter: number;
  maxSkew: number;
  duration: number;
  clockRate: number;
}

export interface RtpAnalyseResult {
  items: RtpAnalyseItem[];
  stats: RtpAnalyseStats;
}

const IP_UDP_RTP_OVERHEAD = 20 + 8 + 12;

export function rtpClockRate(pt?: number, payload?: string): number {
  const p = String(payload || '').toLowerCase();
  if (p.includes('l16') && p.includes('48')) {
    return 48000;
  }
  if (p.includes('l16') || pt === 11) {
    return 44100;
  }
  return 8000;
}

export function roundMs(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.round(n * 1000) / 1000;
}

function u16sub(a: number, b: number): number {
  return (a - b) & 0xffff;
}

function u32sub(a: number, b: number): number {
  return (a - b) >>> 0;
}

function assumedRtpTs(sn: number, clockRate: number): number {
  const ptime = 0.02;
  return (sn * Math.round(clockRate * ptime)) >>> 0;
}

export function analyseRtpPackets(packets: RtpAnalyseInput[], clockRate = 8000): RtpAnalyseResult {
  const clock = clockRate > 0 ? clockRate : 8000;
  const list = (packets || []).filter((p) => p && Number.isFinite(Number(p.t)));
  const empty: RtpAnalyseStats = {
    packets: 0,
    expected: 0,
    lost: 0,
    lostPct: 0,
    seqErrs: 0,
    maxDelta: 0,
    minDelta: 0,
    maxJitter: 0,
    meanJitter: 0,
    maxSkew: 0,
    duration: 0,
    clockRate: clock
  };
  if (!list.length) {
    return { items: [], stats: empty };
  }

  const items: RtpAnalyseItem[] = [];
  let jitter = 0;
  let prevDiff = 0;
  let prevT = 0;
  let prevSn = 0;
  let firstT = 0;
  let firstRtp = 0;
  let totalBytes = 0;
  let lost = 0;
  let seqErrs = 0;
  let maxDelta = 0;
  let minDelta = Infinity;
  let maxJitter = 0;
  let sumJitter = 0;
  let jitterCount = 0;
  let maxSkew = 0;

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const t = Number(p.t);
    const sn = Number.isFinite(Number(p.sn)) ? Number(p.sn) : i;
    const rtpTs = Number.isFinite(Number(p.rtpTs))
      ? Number(p.rtpTs) >>> 0
      : assumedRtpTs(sn, clock);
    const payloadLen = Number(p.payloadLen) || 0;
    const mark = p.marker ? 1 : 0;
    const frame = Number.isFinite(Number(p.f)) && Number(p.f) > 0 ? Number(p.f) : i + 1;
    const statuses: string[] = [];

    if (i === 0) {
      firstT = t;
      firstRtp = rtpTs;
      prevT = t;
      prevSn = sn;
      prevDiff = 0;
      totalBytes = payloadLen + IP_UDP_RTP_OVERHEAD;
      items.push({
        f: frame,
        t,
        sn,
        d: 0,
        j: 0,
        sk: 0,
        bw: 0,
        mark,
        s: 'OK'
      });
      continue;
    }

    const deltaMs = (t - prevT) * 1000;
    const seqDelta = u16sub(sn, prevSn);
    if (seqDelta === 0) {
      statuses.push('Duplicate');
      seqErrs += 1;
    } else if (seqDelta !== 1) {
      statuses.push('Wrong sequence nr.');
      seqErrs += 1;
      if (seqDelta > 1 && seqDelta < 0x8000) {
        lost += seqDelta - 1;
      }
    }

    const arrival = t - firstT;
    const nominal = u32sub(rtpTs, firstRtp) / clock;
    const diff = arrival - nominal;
    const dTransit = Math.abs(diff - prevDiff);
    jitter = jitter + (dTransit - jitter) / 16;
    prevDiff = diff;
    totalBytes += payloadLen + IP_UDP_RTP_OVERHEAD;
    const jitterMs = jitter * 1000;
    const skewMs = diff * 1000;
    const bw = arrival > 0 ? (totalBytes * 8) / arrival / 1000 : 0;

    items.push({
      f: frame,
      t,
      sn,
      d: roundMs(deltaMs),
      j: roundMs(jitterMs),
      sk: roundMs(skewMs),
      bw: roundMs(bw),
      mark,
      s: statuses.length ? statuses.join(', ') : 'OK'
    });

    maxDelta = Math.max(maxDelta, deltaMs);
    minDelta = Math.min(minDelta, deltaMs);
    maxJitter = Math.max(maxJitter, jitterMs);
    maxSkew = Math.max(maxSkew, Math.abs(skewMs));
    sumJitter += jitterMs;
    jitterCount += 1;
    prevT = t;
    prevSn = sn;
  }

  const duration = Number(list[list.length - 1].t) - firstT;
  const received = list.length;
  const expected = received + lost;
  return {
    items,
    stats: {
      packets: received,
      expected,
      lost,
      lostPct: expected > 0 ? roundMs((lost / expected) * 100) : 0,
      seqErrs,
      maxDelta: roundMs(maxDelta),
      minDelta: minDelta === Infinity ? 0 : roundMs(minDelta),
      maxJitter: roundMs(maxJitter),
      meanJitter: jitterCount ? roundMs(sumJitter / jitterCount) : 0,
      maxSkew: roundMs(maxSkew),
      duration: roundMs(duration),
      clockRate: clock
    }
  };
}

export function analyseRtpItems(items: Array<{ f?: number; t?: number; sn?: string | number; mark?: number }>, clockRate = 8000): RtpAnalyseResult {
  return analyseRtpPackets((items || []).map((it, i) => ({
    f: Number(it?.f) || i + 1,
    t: Number(it?.t),
    sn: Number(it?.sn),
    marker: !!it?.mark
  })), clockRate);
}
