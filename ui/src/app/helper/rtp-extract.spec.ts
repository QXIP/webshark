import {
  blobForSsrc,
  blobForStream,
  getTranscode,
  infoHasSsrc,
  padRtpAudio,
  parseCapturePackets,
  parseCapturePacketsTimed,
  rtpPacketsForStream,
  rtpPayloadForStream,
  rtpPayloadFromUdp,
  rtpPayloadsBySsrc,
  sessionStartForClips,
  stitchRtpPayloads,
  udpPayloadFromFrame
} from './rtp-extract';

function u8(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

describe('rtp-extract', () => {
  it('matches SSRC with or without 0x', () => {
    expect(infoHasSsrc('PT=PCMA SSRC=0xd2bd4e3e', 'd2bd4e3e')).toBe(true);
    expect(infoHasSsrc('PT=PCMA SSRC=0xd2bd4e3e', '0xD2BD4E3E')).toBe(true);
    expect(infoHasSsrc('PT=PCMA SSRC=d2bd4e3e', 'd2bd4e3e')).toBe(true);
    expect(infoHasSsrc('PT=PCMA SSRC=0xaaaa', 'd2bd4e3e')).toBe(false);
  });

  it('parses little-endian pcap packets', () => {
    const header = u8(
      0xd4, 0xc3, 0xb2, 0xa1, 0x02, 0x00, 0x04, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xff, 0xff, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00
    );
    const pktHdr = u8(
      0, 0, 0, 0, 0, 0, 0, 0,
      4, 0, 0, 0,
      4, 0, 0, 0
    );
    const body = u8(0xaa, 0xbb, 0xcc, 0xdd);
    const file = new Uint8Array(header.length + pktHdr.length + body.length);
    file.set(header, 0);
    file.set(pktHdr, header.length);
    file.set(body, header.length + pktHdr.length);
    const packets = parseCapturePackets(file);
    expect(packets.length).toBe(1);
    expect(Array.from(packets[0])).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);
    const timed = parseCapturePacketsTimed(file);
    expect(timed[0].ts).toBe(0);
  });

  it('reads pcap timestamps as seconds', () => {
    const header = u8(
      0xd4, 0xc3, 0xb2, 0xa1, 0x02, 0x00, 0x04, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xff, 0xff, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00
    );
    const pktHdr = u8(
      1, 0, 0, 0,
      0xe8, 0x03, 0x00, 0x00,
      4, 0, 0, 0,
      4, 0, 0, 0
    );
    const body = u8(0xaa, 0xbb, 0xcc, 0xdd);
    const file = new Uint8Array(header.length + pktHdr.length + body.length);
    file.set(header, 0);
    file.set(pktHdr, header.length);
    file.set(body, header.length + pktHdr.length);
    expect(parseCapturePacketsTimed(file)[0].ts).toBeCloseTo(1.001, 5);
  });

  it('inserts codec silence for RTP gaps and start delay', () => {
    const stitched = stitchRtpPayloads([
      { ts: 1, payload: u8(0x11) },
      { ts: 2, payload: u8(0x22) }
    ], 'alaw');
    expect(stitched?.startTime).toBe(1);
    expect(stitched!.bytes[0]).toBe(0x11);
    expect(stitched!.bytes[stitched!.bytes.length - 1]).toBe(0x22);
    expect(stitched!.bytes.length).toBeGreaterThan(7000);
    expect(stitched!.bytes[100]).toBe(0xd5);
    const padded = padRtpAudio(stitched!, 0.5, 'alaw');
    expect(padded.length).toBeGreaterThan(stitched!.bytes.length);
    expect(padded[0]).toBe(0xd5);
    expect(sessionStartForClips([{ startTime: 2 }, { startTime: 0.5 }])).toBe(0.5);
  });

  it('extracts RTP payload from Ethernet IPv4 UDP', () => {
    const eth = [
      0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0x08, 0x00
    ];
    const ip = [
      0x45, 0, 0, 42, 0, 0, 0, 0, 64, 17, 0, 0,
      10, 0, 0, 1, 10, 0, 0, 2
    ];
    const udp = [0x1f, 0x40, 0x1f, 0x41, 0, 22, 0, 0];
    const rtp = [
      0x80, 0x08, 0, 1,
      0, 0, 0, 0,
      0xd2, 0xbd, 0x4e, 0x3e,
      0x11, 0x22
    ];
    const frame = u8(...eth, ...ip, ...udp, ...rtp);
    const payload = udpPayloadFromFrame(frame);
    expect(payload).not.toBeNull();
    const rtpParsed = rtpPayloadFromUdp(payload!);
    expect(rtpParsed?.ssrc).toBe('d2bd4e3e');
    expect(rtpParsed?.seq).toBe(1);
    expect(rtpParsed?.timestamp).toBe(0);
    expect(rtpParsed?.marker).toBeFalse();
    expect(rtpParsed?.pt).toBe(8);
    expect(Array.from(rtpParsed!.payload)).toEqual([0x11, 0x22]);
  });

  it('groups RTP payloads by SSRC from a pcap', () => {
    const eth = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0x08, 0x00];
    const ip = [
      0x45, 0, 0, 41, 0, 0, 0, 0, 64, 17, 0, 0,
      10, 0, 0, 1, 10, 0, 0, 2
    ];
    const udp = [0x1f, 0x40, 0x1f, 0x41, 0, 21, 0, 0];
    const rtpA = [0x80, 0x08, 0, 1, 0, 0, 0, 0, 0xd2, 0xbd, 0x4e, 0x3e, 0xaa];
    const rtpB = [0x80, 0x08, 0, 2, 0, 0, 0, 0, 0xd2, 0xbd, 0x4e, 0x3e, 0xbb];
    const frameA = u8(...eth, ...ip, ...udp, ...rtpA);
    const frameB = u8(...eth, ...ip, ...udp, ...rtpB);
    const pktHdr = (len: number) => u8(
      0, 0, 0, 0, 0, 0, 0, 0,
      len, 0, 0, 0,
      len, 0, 0, 0
    );
    const header = u8(
      0xd4, 0xc3, 0xb2, 0xa1, 0x02, 0x00, 0x04, 0x00,
      0, 0, 0, 0, 0, 0, 0, 0,
      0xff, 0xff, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00
    );
    const file = new Uint8Array(24 + 16 + frameA.length + 16 + frameB.length);
    let o = 0;
    file.set(header, o); o += 24;
    file.set(pktHdr(frameA.length), o); o += 16;
    file.set(frameA, o); o += frameA.length;
    file.set(pktHdr(frameB.length), o); o += 16;
    file.set(frameB, o);
    const grouped = rtpPayloadsBySsrc(file);
    expect(Array.from(grouped.get('d2bd4e3e')!)).toEqual([0xaa, 0xbb]);
    const blob = blobForSsrc(grouped, '0xD2BD4E3E');
    expect(blob).not.toBeNull();
    expect(blob?.size).toBe(2);
  });

  it('keeps forwarded copies of the same SSRC on separate 5-tuples', () => {
    const eth = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0x08, 0x00];
    const ip = (srcLast: number, dstLast: number) => [
      0x45, 0, 0, 41, 0, 0, 0, 0, 64, 17, 0, 0,
      10, 0, 0, srcLast, 10, 0, 0, dstLast
    ];
    const udp = (src: number, dst: number) => [src >> 8, src & 0xff, dst >> 8, dst & 0xff, 0, 21, 0, 0];
    const rtp = [0x80, 0x08, 0, 1, 0, 0, 0, 0, 0xd2, 0xbd, 0x4e, 0x3e, 0xaa];
    const rtpB = [0x80, 0x08, 0, 2, 0, 0, 0, 0, 0xd2, 0xbd, 0x4e, 0x3e, 0xbb];
    const frameA = u8(...eth, ...ip(1, 2), ...udp(8000, 40376), ...rtp);
    const frameB = u8(...eth, ...ip(3, 4), ...udp(4800, 40378), ...rtpB);
    const pktHdr = (len: number) => u8(0, 0, 0, 0, 0, 0, 0, 0, len, 0, 0, 0, len, 0, 0, 0);
    const header = u8(
      0xd4, 0xc3, 0xb2, 0xa1, 0x02, 0x00, 0x04, 0x00,
      0, 0, 0, 0, 0, 0, 0, 0,
      0xff, 0xff, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00
    );
    const file = new Uint8Array(24 + 16 + frameA.length + 16 + frameB.length);
    let o = 0;
    file.set(header, o); o += 24;
    file.set(pktHdr(frameA.length), o); o += 16;
    file.set(frameA, o); o += frameA.length;
    file.set(pktHdr(frameB.length), o); o += 16;
    file.set(frameB, o);
    const one = rtpPayloadForStream(file, {
      saddr: '10.0.0.1', sport: 8000, daddr: '10.0.0.2', dport: 40376, ssrc: 'd2bd4e3e'
    });
    expect(Array.from(one!)).toEqual([0xaa]);
    const blob = blobForStream(file, {
      saddr: '10.0.0.3', sport: 4800, daddr: '10.0.0.4', dport: 40378, ssrc: '0xd2bd4e3e'
    });
    expect(blob?.size).toBe(1);
  });

  it('collects timed RTP packets for a 5-tuple including seq and marker', () => {
    const eth = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0x08, 0x00];
    const ip = [
      0x45, 0, 0, 41, 0, 0, 0, 0, 64, 17, 0, 0,
      10, 0, 0, 1, 10, 0, 0, 2
    ];
    const udp = [0x1f, 0x40, 0x1f, 0x41, 0, 21, 0, 0];
    const rtpA = [0x80, 0x08, 0, 1, 0, 0, 0, 160, 0xd2, 0xbd, 0x4e, 0x3e, 0xaa];
    const rtpB = [0x80, 0x88, 0, 2, 0, 0, 1, 64, 0xd2, 0xbd, 0x4e, 0x3e, 0xbb];
    const frameA = u8(...eth, ...ip, ...udp, ...rtpA);
    const frameB = u8(...eth, ...ip, ...udp, ...rtpB);
    const pktHdr = (sec: number, usec: number, len: number) => u8(
      sec, 0, 0, 0, usec & 0xff, (usec >> 8) & 0xff, (usec >> 16) & 0xff, (usec >> 24) & 0xff,
      len, 0, 0, 0, len, 0, 0, 0
    );
    const header = u8(
      0xd4, 0xc3, 0xb2, 0xa1, 0x02, 0x00, 0x04, 0x00,
      0, 0, 0, 0, 0, 0, 0, 0,
      0xff, 0xff, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00
    );
    const file = new Uint8Array(24 + 16 + frameA.length + 16 + frameB.length);
    let o = 0;
    file.set(header, o); o += 24;
    file.set(pktHdr(1, 0, frameA.length), o); o += 16;
    file.set(frameA, o); o += frameA.length;
    file.set(pktHdr(1, 20000, frameB.length), o); o += 16;
    file.set(frameB, o);
    const packets = rtpPacketsForStream(file, {
      saddr: '10.0.0.1', sport: 8000, daddr: '10.0.0.2', dport: 8001, ssrc: 'd2bd4e3e'
    });
    expect(packets.length).toBe(2);
    expect(packets[0].sn).toBe(1);
    expect(packets[0].rtpTs).toBe(160);
    expect(packets[0].marker).toBeFalse();
    expect(packets[1].sn).toBe(2);
    expect(packets[1].marker).toBeTrue();
    expect(packets[1].t).toBeCloseTo(1.02, 5);
  });

  it('throws when ffmpeg transcode is missing', () => {
    const prev = (globalThis as any).transcode;
    try {
      delete (globalThis as any).transcode;
      expect(() => getTranscode()).toThrowError(/transcode/);
    } finally {
      (globalThis as any).transcode = prev;
    }
  });
});
