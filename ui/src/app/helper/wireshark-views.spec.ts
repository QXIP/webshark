import {
  conversationDisplayFilter,
  expertSeverityFilter,
  exportObjectToken,
  followFromFrame,
  followHintFromTree,
  completeFieldNames,
  iographSeries,
  tapInfoLists
} from './wireshark-views';

describe('wireshark-views helpers', () => {
  it('builds a click-to-filter display filter from a conversation row', () => {
    expect(conversationDisplayFilter({
      saddr: '10.0.0.1',
      daddr: '10.0.0.2',
      sport: 5060,
      dport: 5060
    }, 'sip')).toContain('sip.addr eq 10.0.0.1');
    expect(conversationDisplayFilter({
      saddr: '10.0.0.1',
      daddr: '10.0.0.2',
      sport: '',
      dport: ''
    }, 'IPv4')).toBe('ip.addr eq 10.0.0.1 and ip.addr eq 10.0.0.2');
    expect(conversationDisplayFilter({ host: '10.0.0.1' }, 'IPv4')).toBe('ip.addr eq 10.0.0.1');
  });

  it('maps expert severity and export-object download tokens', () => {
    expect(expertSeverityFilter('error')).toBe('expert.severity == error');
    expect(exportObjectToken('http', 3)).toBe('eo:http:3');
  });

  it('picks a follow stream from frame fol data', () => {
    expect(followFromFrame([
      ['TCP', 'tcp.stream eq 1'],
      ['HTTP', 'http']
    ], 'TCP')).toEqual({ proto: 'TCP', filter: 'tcp.stream eq 1' });
    expect(followFromFrame([
      ['HTTP', 'http'],
      ['UDP', 'udp.stream eq 0']
    ])).toEqual({ proto: 'UDP', filter: 'udp.stream eq 0' });
    expect(followFromFrame(undefined)).toBeNull();
  });

  it('reads tcp/udp stream index from the protocol tree', () => {
    expect(followHintFromTree([{
      l: 'Transmission Control Protocol',
      f: 'tcp',
      n: [{ l: 'Stream index: 3', f: 'tcp.stream', n: [] }]
    }])).toEqual({ proto: 'TCP', filter: 'tcp.stream eq 3' });
    expect(followHintFromTree([{
      l: 'User Datagram Protocol',
      f: 'udp',
      n: [{ l: 'Stream index: 0', f: 'udp.stream', n: [] }]
    }])).toEqual({ proto: 'UDP', filter: 'udp.stream eq 0' });
  });

  it('normalizes complete() field names and iograph series', () => {
    expect(completeFieldNames({ field: [{ f: 'sip.Method' }, { f: 'sip.Call-ID' }] }))
      .toEqual(['sip.Method', 'sip.Call-ID']);
    expect(iographSeries({ iograph: [{ items: [1, 4, 0] }] })).toEqual([1, 4, 0]);
  });

  it('defaults missing sharkd info lists so menus do not spread undefined', () => {
    expect(tapInfoLists({ error: 'Capture file is unset!' }).convs).toEqual([]);
    expect(tapInfoLists({ err: 1, errstr: 'cannot connect' }).stats).toEqual([]);
    expect(tapInfoLists(undefined).eo).toEqual([]);
    expect(tapInfoLists({ convs: [{ name: 'IPv4', tap: 'conv:ip' }] }).convs[0].tap).toBe('conv:ip');
    expect(tapInfoLists({ endpts: [{ name: 'IPv4', tap: 'endpt:IPv4' }] }).endpts[0].tap).toBe('endpt:IPv4');
  });
});
