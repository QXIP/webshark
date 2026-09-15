import { bytesFromCaptureSource } from './capture-bytes';

describe('bytesFromCaptureSource', () => {
  it('copies a Uint8Array into a standalone ArrayBuffer', async () => {
    const src = new Uint8Array([1, 2, 3, 4]);
    const buf = await bytesFromCaptureSource(src);
    expect(new Uint8Array(buf)).toEqual(src);
    new Uint8Array(buf)[0] = 9;
    expect(src[0]).toBe(1);
  });

  it('reads a Blob/File', async () => {
    const file = new File([new Uint8Array([10, 20])], 'a.pcap');
    const buf = await bytesFromCaptureSource(file);
    expect(Array.from(new Uint8Array(buf))).toEqual([10, 20]);
  });
});
