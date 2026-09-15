import { buildClassicPcap, filteredPcapFilename, pcapTimestamp } from './pcap-export';

describe('pcap-export', () => {
  it('splits packet time into sec/usec', () => {
    expect(pcapTimestamp(1.5)).toEqual({ sec: 1, usec: 500000 });
    expect(pcapTimestamp('0.000001')).toEqual({ sec: 0, usec: 1 });
    expect(pcapTimestamp('nope')).toEqual({ sec: 0, usec: 0 });
  });

  it('names filtered vs original exports', () => {
    expect(filteredPcapFilename('SIP_CALL_RTP_G711.pcapng', 'sip')).toBe('SIP_CALL_RTP_G711-filtered.pcap');
    expect(filteredPcapFilename('/captures/voip.pcap', '')).toBe('voip.pcap');
  });

  it('writes a classic pcap with one packet', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const pcap = buildClassicPcap([{ t: 1.5, bytes }]);
    const view = new DataView(pcap.buffer);
    expect(view.getUint32(0, true)).toBe(0xa1b2c3d4);
    expect(view.getUint16(4, true)).toBe(2);
    expect(view.getUint32(20, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(1);
    expect(view.getUint32(28, true)).toBe(500000);
    expect(view.getUint32(32, true)).toBe(4);
    expect(Array.from(pcap.slice(40))).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });
});
