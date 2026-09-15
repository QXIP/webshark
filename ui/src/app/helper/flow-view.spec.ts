import { flowArrowBox, flowColorKey, flowLaneCenter, packetFlowFromFrames } from './flow-view';

describe('flow-view', () => {
  it('places an arrow between two host lanes', () => {
    expect(flowLaneCenter(0, 2)).toBe(25);
    expect(flowLaneCenter(1, 2)).toBe(75);
    const box = flowArrowBox([0, 1], 2);
    expect(box.left).toBe(25);
    expect(box.width).toBe(50);
    expect(box.reverse).toBeFalse();
    expect(flowArrowBox([1, 0], 2).reverse).toBeTrue();
  });

  it('stringifies color keys without requiring an array', () => {
    expect(flowColorKey(12)).toBe('12');
    expect(flowColorKey([1, 2])).toBe('1,2');
  });

  it('builds a packet flow graph from list rows', () => {
    const flow = packetFlowFromFrames([
      { c: ['1', '0.10', '10.0.0.1', '10.0.0.2', 'SIP', '400', 'INVITE'] },
      { c: ['2', '0.20', '10.0.0.2', '10.0.0.1', 'SIP', '200', '200 OK'] }
    ]);
    expect(flow.nodes).toEqual(['10.0.0.1', '10.0.0.2']);
    expect(flow.flows[0].n).toEqual([0, 1]);
    expect(flow.flows[0].c).toContain('INVITE');
    expect(flow.flows[0].pn).toBe('1');
    expect(flow.flows[1].n).toEqual([1, 0]);
  });
});
