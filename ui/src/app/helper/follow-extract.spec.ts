import { followChunksFromFrames, bytesFromFrameDump } from './follow-extract';

function u8(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

describe('follow-extract', () => {
  it('decodes hex frame dumps', () => {
    expect(Array.from(bytesFromFrameDump('414243'))).toEqual([0x41, 0x42, 0x43]);
  });

  it('pulls SIP/UDP payloads out of Ethernet frames', () => {
    const sip = [0x49, 0x4e, 0x56, 0x49, 0x54, 0x45]; // INVITE
    const eth = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0x08, 0x00];
    const ip = [
      0x45, 0, 0, 20 + 8 + sip.length, 0, 0, 0, 0, 64, 17, 0, 0,
      10, 0, 0, 1, 10, 0, 0, 2
    ];
    const udp = [0x13, 0xc4, 0x13, 0xc5, 0, 8 + sip.length, 0, 0];
    const frame = u8(...eth, ...ip, ...udp, ...sip);
    const hex = Array.from(frame).map((b) => b.toString(16).padStart(2, '0')).join('');
    const followed = followChunksFromFrames([{ bytes: hex, num: 1 }]);
    expect(followed.shost).toBe('10.0.0.1');
    expect(followed.sport).toBe(5060);
    expect(followed.payload[0].d).toBe('INVITE');
  });
});
