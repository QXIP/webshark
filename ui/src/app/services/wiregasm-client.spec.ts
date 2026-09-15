import { TestBed } from '@angular/core/testing';
import { WIREGASM_BACKEND, WiregasmClient } from './wiregasm-client';

describe('WiregasmClient', () => {
  it('delegates calls to an injected backend', async () => {
    const backend = {
      call: jasmine.createSpy('call').and.callFake((type: string, payload: any) => {
        if (type === 'frames') {
          return Promise.resolve([{ c: ['1'], num: 1 }]);
        }
        return Promise.resolve({ ok: type, payload });
      })
    };
    TestBed.configureTestingModule({
      providers: [{ provide: WIREGASM_BACKEND, useValue: backend }]
    });
    const client = TestBed.inject(WiregasmClient);
    const frames = await client.frames('sip', 0, 10);
    expect(backend.call).toHaveBeenCalledWith('frames', { filter: 'sip', skip: 0, limit: 10 });
    expect(frames[0].c[0]).toBe('1');
    await client.load('a.pcap', new Uint8Array([1, 2]));
    expect(backend.call).toHaveBeenCalledWith('load', jasmine.objectContaining({ name: 'a.pcap' }));
    await client.load('b.pcap', { url: '/webshark/captures/b.pcap' });
    expect(backend.call).toHaveBeenCalledWith('load', { name: 'b.pcap', url: '/webshark/captures/b.pcap' });
  });
});
