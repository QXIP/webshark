export function copyToArrayBuffer(source: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (source instanceof ArrayBuffer) {
    return source;
  }
  const copy = new Uint8Array(source.byteLength);
  copy.set(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
  return copy.buffer;
}

export async function bytesFromCaptureSource(source: Blob | Uint8Array | ArrayBuffer): Promise<ArrayBuffer> {
  if (source instanceof ArrayBuffer) {
    return source;
  }
  if (ArrayBuffer.isView(source)) {
    return copyToArrayBuffer(source);
  }
  return source.arrayBuffer();
}
