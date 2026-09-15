import { analyseRtpPackets, rtpClockRate } from './rtp-analyse';

describe('rtp-analyse', () => {
  it('uses 8 kHz RTP clock for G.711 and G.722', () => {
    expect(rtpClockRate(8, 'ITU-T G.711 PCMA')).toBe(8000);
    expect(rtpClockRate(9, 'G.722')).toBe(8000);
  });

  it('computes 20 ms delta and near-zero jitter for a regular G.711 stream', () => {
    const packets = [0, 1, 2, 3].map((i) => ({
      f: 10 + i,
      t: 1 + i * 0.02,
      sn: 100 + i,
      rtpTs: 160 * i,
      payloadLen: 160,
      marker: i === 0
    }));
    const { items, stats } = analyseRtpPackets(packets, 8000);
    expect(items.length).toBe(4);
    expect(items[0].s).toBe('OK');
    expect(items[0].mark).toBe(1);
    expect(items[1].d).toBeCloseTo(20, 3);
    expect(items[1].j).toBeCloseTo(0, 3);
    expect(items[1].s).toBe('OK');
    expect(stats.packets).toBe(4);
    expect(stats.lost).toBe(0);
    expect(stats.maxDelta).toBeCloseTo(20, 3);
    expect(stats.maxJitter).toBeCloseTo(0, 3);
    expect(stats.duration).toBeCloseTo(0.06, 3);
  });

  it('counts sequence gaps as lost packets', () => {
    const { items, stats } = analyseRtpPackets([
      { f: 1, t: 0, sn: 1, rtpTs: 0, payloadLen: 160 },
      { f: 2, t: 0.04, sn: 3, rtpTs: 320, payloadLen: 160 }
    ], 8000);
    expect(stats.lost).toBe(1);
    expect(stats.expected).toBe(3);
    expect(items[1].s).toContain('Wrong sequence nr.');
  });

  it('tracks RFC 3550 jitter when a packet arrives late', () => {
    const { items, stats } = analyseRtpPackets([
      { f: 1, t: 0, sn: 1, rtpTs: 0, payloadLen: 160 },
      { f: 2, t: 0.02, sn: 2, rtpTs: 160, payloadLen: 160 },
      { f: 3, t: 0.06, sn: 3, rtpTs: 320, payloadLen: 160 }
    ], 8000);
    expect(items[2].d).toBeCloseTo(40, 3);
    expect(items[2].j).toBeGreaterThan(1);
    expect(stats.maxJitter).toBeGreaterThan(1);
    expect(stats.maxDelta).toBeCloseTo(40, 3);
  });

  it('handles 16-bit sequence wrap', () => {
    const { stats, items } = analyseRtpPackets([
      { f: 1, t: 0, sn: 65535, rtpTs: 0, payloadLen: 160 },
      { f: 2, t: 0.02, sn: 0, rtpTs: 160, payloadLen: 160 }
    ], 8000);
    expect(stats.lost).toBe(0);
    expect(items[1].s).toBe('OK');
    expect(items[1].d).toBeCloseTo(20, 3);
  });
});
