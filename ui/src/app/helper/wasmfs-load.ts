function safeName(name: string): string {
  return String(name || 'capture.pcap').replace(/^\/+/, '').split('/').pop() || 'capture.pcap';
}

export function hasWasmFsOpfs(lib: any): boolean {
  const fs = lib?.FS;
  return !!(fs?.filesystems?.OPFS || fs?.filesystems?.WASMFS);
}

export function mountOpfsIfPossible(lib: any, mountPoint = '/opfs'): string | null {
  const fs = lib?.FS;
  const backend = fs?.filesystems?.OPFS || fs?.filesystems?.WASMFS;
  if (!backend || typeof fs.mount !== 'function') {
    return null;
  }
  try {
    fs.mkdir(mountPoint);
  } catch (_) { /* exists */ }
  try {
    fs.mount(backend, { autoPersist: true, root: 'webshark-captures' }, mountPoint);
    return mountPoint;
  } catch (_) {
    return null;
  }
}

export async function writeOpfsCapture(name: string, source: Response | Uint8Array | ArrayBuffer): Promise<File | null> {
  try {
    const storage = (globalThis as any).navigator?.storage;
    if (!storage || typeof storage.getDirectory !== 'function') {
      return null;
    }
    const root = await storage.getDirectory();
    const dir = await root.getDirectoryHandle('webshark-captures', { create: true });
    const fh = await dir.getFileHandle(safeName(name), { create: true });
    const writable = await fh.createWritable();
    try {
      if (source instanceof Uint8Array) {
        await writable.write(source);
        await writable.close();
      } else if (source instanceof ArrayBuffer) {
        await writable.write(new Uint8Array(source));
        await writable.close();
      } else if (source.body) {
        await source.body.pipeTo(writable);
      } else {
        await writable.write(new Uint8Array(await source.arrayBuffer()));
        await writable.close();
      }
    } catch (err) {
      try { await writable.abort(); } catch (_) { /* ignore */ }
      throw err;
    }
    return fh.getFile();
  } catch (_) {
    return null;
  }
}

function wasmFree(lib: any, ptr: number): void {
  if (typeof lib?._free === 'function') {
    lib._free(ptr);
    return;
  }
  const freeFn = lib?.asm?.free || lib?.asm?._free;
  if (typeof freeFn === 'function') {
    freeFn(ptr);
  }
}

/** One copy: JS/OPFS bytes → WASM heap, then Wiregasm upload (MEMFS). Avoids FS.writeFile from a second JS buffer. */
export function uploadViaMalloc(lib: any, name: string, bytes: Uint8Array): string {
  if (!lib || typeof lib._malloc !== 'function' || typeof lib.upload !== 'function') {
    throw new Error('Wiregasm lib does not export _malloc/upload');
  }
  const n = bytes.byteLength;
  const ptr = lib._malloc(n);
  try {
    const heap = new Uint8Array(lib.HEAPU8.buffer, ptr, n);
    heap.set(bytes);
    return lib.upload(safeName(name), ptr, n);
  } finally {
    wasmFree(lib, ptr);
  }
}

export async function streamFileToUpload(lib: any, name: string, file: File): Promise<string> {
  if (!lib || typeof lib._malloc !== 'function' || typeof lib.upload !== 'function') {
    throw new Error('Wiregasm lib does not export _malloc/upload');
  }
  const n = file.size;
  const ptr = lib._malloc(n);
  try {
    const heap = new Uint8Array(lib.HEAPU8.buffer, ptr, n);
    let offset = 0;
    const reader = file.stream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      heap.set(value, offset);
      offset += value.byteLength;
    }
    return lib.upload(safeName(name), ptr, n);
  } finally {
    wasmFree(lib, ptr);
  }
}

export async function ingestCapture(
  lib: any,
  name: string,
  source: { url?: string; data?: Uint8Array | ArrayBuffer }
): Promise<{ path: string; via: 'wasmfs-opfs' | 'opfs-malloc' | 'malloc' }> {
  const fileName = safeName(name);
  if (source.url) {
    const res = await fetch(source.url);
    if (!res.ok) {
      throw new Error(`failed to fetch capture: ${res.status}`);
    }
    const cloned = typeof res.clone === 'function' ? res.clone() : null;
    const opfsFile = await writeOpfsCapture(fileName, res);
    const mounted = mountOpfsIfPossible(lib);
    if (mounted && opfsFile) {
      return { path: `${mounted}/${fileName}`, via: 'wasmfs-opfs' };
    }
    if (opfsFile) {
      const path = await streamFileToUpload(lib, fileName, opfsFile);
      return { path, via: 'opfs-malloc' };
    }
    const bufSrc = cloned || res;
    const buf = new Uint8Array(await bufSrc.arrayBuffer());
    return { path: uploadViaMalloc(lib, fileName, buf), via: 'malloc' };
  }
  const bytes = source.data instanceof Uint8Array
    ? source.data
    : new Uint8Array(source.data || []);
  await writeOpfsCapture(fileName, bytes);
  const mounted = mountOpfsIfPossible(lib);
  if (mounted) {
    return { path: `${mounted}/${fileName}`, via: 'wasmfs-opfs' };
  }
  return { path: uploadViaMalloc(lib, fileName, bytes), via: 'malloc' };
}
