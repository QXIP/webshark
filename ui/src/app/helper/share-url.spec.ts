import { parseViewState, serializeViewState, rtpStreamToken, iframeEmbedSnippet, applyViewStateToUrl } from './share-url';

describe('share-url', () => {
  it('round-trips capture, frame, filter, view and stream', () => {
    const search = serializeViewState({
      capture: 'voip.pcapng',
      frame: 12,
      filter: 'sip',
      view: 'rtp',
      stream: '10.0.0.1_5004_10.0.0.2_5006_4c7a'
    });
    expect(search).toContain('capture=voip.pcapng');
    expect(parseViewState(search)).toEqual({
      capture: 'voip.pcapng',
      frame: 12,
      filter: 'sip',
      view: 'rtp',
      stream: '10.0.0.1_5004_10.0.0.2_5006_4c7a'
    });
  });

  it('treats embed=1 as kiosk embed mode', () => {
    expect(parseViewState('?embed=1&capture=a.pcap').embed).toBeTrue();
    expect(serializeViewState({ capture: 'a.pcap', embed: true })).toBe('?capture=a.pcap&embed=1');
  });

  it('builds a shareable RTP stream token', () => {
    const rtp = {
      saddr: '10.0.0.1',
      sport: 5004,
      daddr: '10.0.0.2',
      dport: 5006,
      ssrc: 1289913356
    };
    expect(rtpStreamToken(rtp)).toBe(`10.0.0.1_5004_10.0.0.2_5006_${(1289913356).toString(16)}`);
    expect(rtpStreamToken({ ...rtp, ssrc: '4ce2840c' })).toBe('10.0.0.1_5004_10.0.0.2_5006_4ce2840c');
  });

  it('updates only the query string so the SPA does not reload', () => {
    const hist = { replaceState: jasmine.createSpy('replaceState') };
    applyViewStateToUrl({ capture: 'a.pcap' }, { pathname: '/webshark/' }, hist as any);
    expect(hist.replaceState).toHaveBeenCalledWith(null, '', '/webshark/?capture=a.pcap');
  });
});
