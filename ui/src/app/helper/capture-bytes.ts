export async function bytesFromCaptureSource(source: Blob | Uint8Array | ArrayBuffer): Promise<ArrayBuffer> {
  if (source instanceof ArrayBuffer) {
    return source;
  }
  if (ArrayBuffer.isView(source)) {
    const view = source as Uint8Array;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  return source.arrayBuffer();
}
