import {
  captureFileUrl,
  colorToCss,
  completeToSharkd,
  followToSharkd,
  frameMetaToRow,
  frameToSharkd,
  framesToSharkd,
  protoTreeToSharkd,
  staticTapInfo,
  tapCellValue,
  tapColumnKeys,
  tapDisplayRows,
  tapToSharkd,
  vectorToArray
} from './wiregasm-adapt';
import { groupRtpStreams, parseRtpInfo, portsFromProtoTree, publicRtpStreams, rtpStreamsTap } from './rtp-from-frames';

describe('wiregasm-adapt', () => {
  it('maps FrameMeta columns to sharkd packet-list rows', () => {
    const row = frameMetaToRow({
      number: 1,
      bg: 0xdaeeff,
      fg: 0x12272e,
      columns: ['1', '0.000000', '10.0.0.1', '10.0.0.2', 'SIP', '740', 'INVITE']
    });
    expect(row.num).toBe(1);
    expect(row.c[4]).toBe('SIP');
    expect(row.bg).toBe('daeeff');
    expect(colorToCss(0xff)).toBe('0000ff');
  });

  it('flattens Vector-like frames and trees', () => {
    const frames = framesToSharkd({
      frames: {
        size: () => 1,
        get: () => ({ number: 2, columns: ['2', '0.1', 'a', 'b', 'UDP', '40', 'x'] })
      }
    });
    expect(frames[0].c[0]).toBe('2');
    const tree = protoTreeToSharkd({
      label: 'Frame',
      filter: 'frame',
      start: 0,
      length: 10,
      tree: [{ label: 'Child', filter: 'frame.len', start: 0, length: 2, tree: [] }]
    });
    expect(tree.l).toBe('Frame');
    expect(tree.n[0].f).toBe('frame.len');
  });

  it('maps frame details including follow pairs and bytes', () => {
    const sharkd = frameToSharkd({
      data_sources: [{ name: 'Frame', data: 'abcd' }],
      tree: [{ label: 'SIP', filter: 'sip', start: 0, length: 4, tree: [] }],
      follow: [['UDP', 'udp.stream eq 0']]
    });
    expect(sharkd.bytes).toBe('abcd');
    expect(sharkd.fol[0][0]).toBe('UDP');
    expect(sharkd.tree[0].l).toBe('SIP');
  });

  it('maps follow payloads and complete fields', () => {
    const follow = followToSharkd({
      shost: '10.0.0.1',
      sport: '5060',
      chost: '10.0.0.2',
      cport: '5060',
      payloads: [{ number: 1, data: 'INVITE', server: 0 }]
    });
    expect(follow.dhost).toBe('10.0.0.2');
    expect(follow.payload[0].d).toBe('INVITE');
    expect(completeToSharkd({ fields: [{ field: 'sip.Method', name: 'Method' }] }).field[0].f).toBe('sip.Method');
  });

  it('flattens tap rows to scalar sharkd fields and picks display rows', () => {
    const tap = tapToSharkd({
      taps: [{
        proto: 'IPv4',
        type: 'conv',
        convs: [{ saddr: '10.0.0.1', daddr: '10.0.0.2', txf: 3, conv_id: -1, items: [{ x: 1 }] }],
        hosts: [{ host: '10.0.0.1', txf: 3 }]
      }]
    });
    expect(tap.taps[0].convs[0].saddr).toBe('10.0.0.1');
    expect(tap.taps[0].convs[0].conv_id).toBeUndefined();
    expect(tapDisplayRows(tap.taps[0])[0].saddr).toBe('10.0.0.1');
    expect(tapDisplayRows({ type: 'endpt', hosts: [{ host: 'a' }] })[0].host).toBe('a');
    expect(tapColumnKeys({ saddr: 'a', items: [{}], _download: 'x' })).toEqual(['saddr']);
    expect(tapCellValue([{ a: 1 }])).toBe('1');
    expect(staticTapInfo().convs.some((c: any) => c.tap === 'conv:IPv4')).toBeTrue();
    expect(staticTapInfo().endpts.some((c: any) => c.tap === 'endpt:IPv4')).toBeTrue();
    expect(staticTapInfo().taps.some((c: any) => c.tap === 'rtp-streams')).toBeFalse();
    expect(vectorToArray(undefined)).toEqual([]);
    expect(captureFileUrl('/voip.pcapng')).toBe('/webshark/captures/voip.pcapng');
  });
});

describe('rtp-from-frames', () => {
  it('groups RTP packet-list rows by SSRC and addrs', () => {
    const frames = [
      { c: ['10', '0.1', '10.0.0.1', '10.0.0.2', 'RTP', '172', 'PT=ITU-T G.711 PCMA, SSRC=0x4ce2840c, Seq=1'] },
      { c: ['11', '0.2', '10.0.0.1', '10.0.0.2', 'RTP', '172', 'PT=ITU-T G.711 PCMA, SSRC=0x4ce2840c, Seq=2'] },
      { c: ['12', '0.3', '10.0.0.2', '10.0.0.1', 'RTP', '172', 'PT=ITU-T G.711 PCMA, SSRC=0xaabbccdd, Seq=1'] }
    ];
    expect(parseRtpInfo(frames[0].c[6]).ssrc).toBe('4ce2840c');
    const streams = groupRtpStreams(frames);
    expect(streams.length).toBe(2);
    expect(streams[0].pkts).toBe(2);
    expect(streams[0].start).toBe(0.1);
    expect(streams[0].stop).toBe(0.2);
    expect(streams[0].lost).toBe(0);
    expect(streams[0].items[1].d).toBeCloseTo(100, 0);
    expect(rtpStreamsTap(frames).taps[0].streams[0].lost).toBe(0);
    expect(rtpStreamsTap(frames).taps[0].streams[0].items).toBeUndefined();
    expect(publicRtpStreams(streams)[0].items).toBeUndefined();
    expect(portsFromProtoTree([{
      l: 'User Datagram Protocol, Src Port: 5004, Dst Port: 5005',
      f: 'udp',
      n: [
        { l: 'Source Port: 5004', f: 'udp.srcport', n: [] },
        { l: 'Destination Port: 5005', f: 'udp.dstport', n: [] }
      ]
    }])).toEqual({ src: 5004, dst: 5005 });
  });
});
