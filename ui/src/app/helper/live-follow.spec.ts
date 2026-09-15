import { captureChangeKind, isNearBottom, framesSkip, filterNewFrames, mapFrameRow, packetListRow, packetFrameId, frameTreeFromSharkd, isFrameList, sharkdErrorMessage } from './live-follow';

describe('live-follow', () => {
  it('classifies grow vs truncate', () => {
    expect(captureChangeKind(-1, 100)).toBe('init');
    expect(captureChangeKind(100, 180)).toBe('append');
    expect(captureChangeKind(180, 20)).toBe('full');
    expect(captureChangeKind(100, 100)).toBe('none');
  });

  it('keeps tail-follow only when near the bottom', () => {
    expect(isNearBottom(1000, 880, 100)).toBeTrue();
    expect(isNearBottom(1000, 0, 100)).toBeFalse();
  });

  it('skips already loaded frames and maps packet-list rows', () => {
    expect(framesSkip(25)).toBe(25);
    const extra = filterNewFrames([1, 2], [
      { c: [2, 't', 'a'] },
      { c: [3, 't', 'b'] }
    ]);
    expect(extra.length).toBe(1);
    expect(mapFrameRow({ c: ['4', '0.1', '10.0.0.1', '10.0.0.2', 'SIP', '320', 'INVITE'], bg: 'fff', fg: '000' }))
      .toEqual({
        id: '4',
        time: '0.1',
        source: '10.0.0.1',
        description: '10.0.0.2',
        protocol: 'SIP',
        length: '320',
        info: 'INVITE',
        bg: 'fff',
        fg: '000'
      });
  });

  it('reads a packet-list row from dblclick payloads without row.item', () => {
    const row = { id: '12', protocol: 'SIP', info: 'INVITE' };
    expect(packetListRow({ row })).toBe(row);
    expect(packetListRow({ row: { item: row } })).toBe(row);
    expect(packetListRow({})).toBeNull();
    expect(packetListRow(null)).toBeNull();
    expect(packetFrameId(row)).toBe(12);
    expect(packetFrameId({})).toBe(0);
    expect(frameTreeFromSharkd([{ l: 'Frame', f: 'frame', h: [0, 2], n: [{ l: 'SIP', f: 'sip' }] }])).toEqual([
      { name: 'Frame', description: 'frame', highlight: [0, 2], children: [{ name: 'SIP', description: 'sip', highlight: undefined, children: undefined }] }
    ]);
  });

  it('detects sharkd error payloads instead of treating them as frames', () => {
    expect(isFrameList([{ c: ['1'] }])).toBeTrue();
    expect(isFrameList({ err: 1, errstr: 'cannot connect to sharkd' })).toBeFalse();
    expect(sharkdErrorMessage({ err: 1, errstr: 'cannot connect to sharkd using socket: /x' }))
      .toContain('cannot connect to sharkd');
    expect(sharkdErrorMessage({ error: 'Capture file is unset!' })).toBe('Capture file is unset!');
  });
});
