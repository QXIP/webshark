import {
  hasWasmFsOpfs,
  ingestCapture,
  mountOpfsIfPossible,
  uploadViaMalloc
} from './wasmfs-load';

describe('wasmfs-load', () => {
  it('detects WasmFS OPFS backends and mounts when present', () => {
    expect(hasWasmFsOpfs({})).toBeFalse();
    const lib = {
      FS: {
        filesystems: { OPFS: { name: 'OPFS' } },
        mkdir: jasmine.createSpy('mkdir'),
        mount: jasmine.createSpy('mount')
      }
    };
    expect(hasWasmFsOpfs(lib)).toBeTrue();
    expect(mountOpfsIfPossible(lib)).toBe('/opfs');
    expect(lib.FS.mount).toHaveBeenCalled();
  });

  it('uploads through _malloc instead of FS.writeFile', () => {
    const heap = new Uint8Array(16);
    const lib = {
      HEAPU8: { buffer: heap.buffer },
      _malloc: jasmine.createSpy('_malloc').and.returnValue(0),
      upload: jasmine.createSpy('upload').and.returnValue('/uploads/a.pcap')
    };
    const path = uploadViaMalloc(lib, 'a.pcap', new Uint8Array([9, 8, 7]));
    expect(path).toBe('/uploads/a.pcap');
    expect(lib._malloc).toHaveBeenCalledWith(3);
    expect(lib.upload).toHaveBeenCalledWith('a.pcap', 0, 3);
    expect(Array.from(heap.slice(0, 3))).toEqual([9, 8, 7]);
  });

  it('ingests a fetch Response via malloc when OPFS is missing', async () => {
    const heap = new Uint8Array(8);
    const lib = {
      HEAPU8: { buffer: heap.buffer },
      _malloc: () => 0,
      upload: (_n: string, _p: number, _l: number) => '/uploads/voip.pcapng',
      FS: {}
    };
    spyOn(globalThis, 'fetch' as any).and.returnValue(Promise.resolve({
      ok: true,
      body: null,
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer)
    }));
    const out = await ingestCapture(lib, 'voip.pcapng', { url: '/webshark/captures/voip.pcapng' });
    expect(['malloc', 'opfs-malloc']).toContain(out.via);
    expect(out.path).toBe('/uploads/voip.pcapng');
  });
});
