import { rtpRelativeTime, rtpSsrcLabel, rtpStreamLabel, rtpStreamTabLabel, rtpWaveColor } from './rtp-player';

describe('rtp-player', () => {
  it('cycles waveform colors', () => {
    expect(rtpWaveColor(0)).toBe('#c4a35a');
    expect(rtpWaveColor(1)).toBe('#6b6b6b');
    expect(rtpWaveColor(6)).toBe('#c4a35a');
  });

  it('formats a stream label', () => {
    expect(rtpStreamLabel({
      saddr: '10.0.0.1', sport: 8000, daddr: '10.0.0.2', dport: 40376, ssrc: 'd2bd4e3e'
    })).toBe('10.0.0.1:8000 → 10.0.0.2:40376  d2bd4e3e');
  });

  it('uses short Forward/Reverse tab labels', () => {
    expect(rtpSsrcLabel('d2bd4e3e')).toBe('0xd2bd4e3e');
    expect(rtpStreamTabLabel(0, 'd2bd4e3e')).toBe('Forward 0xd2bd4e3e');
    expect(rtpStreamTabLabel(1, '58f33dea')).toBe('Reverse 0x58f33dea');
  });

  it('shows packet time relative to the first packet', () => {
    expect(rtpRelativeTime(1105725491.445, 1105725491.445)).toBe('0.000');
    expect(rtpRelativeTime(1105725491.483, 1105725491.445)).toBe('0.038');
  });
});
