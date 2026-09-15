import { findReverseRtp, groupRtpStreams } from './rtp-from-frames';
import { groupVoipCalls, rtpStreamsForCall, sipFlowFromCall, voipCallsTap } from './voip-calls';

describe('voip-calls', () => {
  const sipFrames = [
    { c: ['1', '0.10', '10.0.0.1', '10.0.0.2', 'SIP', '400', 'Request: INVITE sip:bob@10.0.0.2'] },
    { c: ['2', '0.20', '10.0.0.2', '10.0.0.1', 'SIP', '200', 'Status: 200 OK'] },
    { c: ['3', '1.50', '10.0.0.1', '10.0.0.2', 'SIP', '180', 'Request: BYE sip:bob@10.0.0.2'] },
    { c: ['4', '8.00', '10.0.0.3', '10.0.0.4', 'SIP', '400', 'Request: INVITE sip:carol@10.0.0.4'] }
  ];
  const rtpFrames = [
    { c: ['10', '0.40', '10.0.0.1', '10.0.0.2', 'RTP', '172', 'PT=ITU-T G.711 PCMA, SSRC=0xaaaa', '8000', '40376'] },
    { c: ['11', '0.41', '10.0.0.2', '10.0.0.1', 'RTP', '172', 'PT=ITU-T G.711 PCMA, SSRC=0xbbbb', '40376', '8000'] },
    { c: ['12', '8.20', '10.0.0.3', '10.0.0.4', 'RTP', '172', 'PT=ITU-T G.722, SSRC=0xcccc', '5004', '5006'] }
  ];

  it('groups SIP dialogs and later INVITEs as separate calls', () => {
    const rtp = groupRtpStreams(rtpFrames);
    const calls = groupVoipCalls(sipFrames, rtp);
    expect(calls.length).toBe(2);
    expect(calls[0].from).toBe('10.0.0.1');
    expect(calls[0].to).toContain('sip:bob');
    expect(calls[0].state).toBe('COMPLETED');
    expect(calls[0].rtpTokens.length).toBe(2);
    expect(calls[1].rtpTokens.length).toBe(1);
    expect(voipCallsTap(calls).taps[0].type).toBe('voip-calls');
    expect(voipCallsTap(calls).taps[0].calls[0].items.length).toBe(3);
  });

  it('builds a SIP ladder from a call', () => {
    const [call] = groupVoipCalls(sipFrames, []);
    const flow = sipFlowFromCall(call);
    expect(flow.nodes).toEqual(['10.0.0.1', '10.0.0.2']);
    expect(flow.flows[0].n).toEqual([0, 1]);
    expect(flow.flows[1].n).toEqual([1, 0]);
    expect(flow.flows[0].c).toContain('INVITE');
    expect(flow.flows[0].t).toBe('0.100000');
  });

  it('pairs reverse RTP 5-tuples', () => {
    const rtp = groupRtpStreams(rtpFrames);
    expect(findReverseRtp(rtp, rtp[0])).toBe(rtp[1]);
    expect(rtpStreamsForCall({ start: 0.1, stop: 2, ips: ['10.0.0.1', '10.0.0.2'] }, rtp).length).toBe(2);
  });

  it('falls back to RTP pairs when the capture has no SIP', () => {
    const rtp = groupRtpStreams(rtpFrames);
    const calls = groupVoipCalls([], rtp);
    expect(calls.length).toBe(2);
    expect(calls[0].proto).toBe('RTP');
    expect(calls[0].rtpTokens.length).toBe(2);
  });
});
