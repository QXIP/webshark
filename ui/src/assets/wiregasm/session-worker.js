/* Classic worker: load Emscripten via importScripts so webpack never bundles Node shims. */
/* global loadWiregasm */

importScripts('./wiregasm.js');

let lib = null;
let session = null;
let ready = false;

function vec(v) {
  if (!v) {
    return [];
  }
  if (Array.isArray(v)) {
    return v;
  }
  if (typeof v.size !== 'function' || typeof v.get !== 'function') {
    return [];
  }
  const out = [];
  const n = v.size();
  for (let i = 0; i < n; i++) {
    out.push(v.get(i));
  }
  return out;
}

function plainTree(node) {
  if (!node) {
    return node;
  }
  return {
    label: node.label,
    filter: node.filter,
    start: node.start,
    length: node.length,
    tree: vec(node.tree).map(plainTree)
  };
}

function safeName(name) {
  return String(name || 'capture.pcap').replace(/^\/+/, '').split('/').pop() || 'capture.pcap';
}

function hasWasmFsOpfs(module) {
  const fs = module && module.FS;
  return !!(fs && fs.filesystems && (fs.filesystems.OPFS || fs.filesystems.WASMFS));
}

function mountOpfsIfPossible(module, mountPoint) {
  mountPoint = mountPoint || '/opfs';
  const fs = module && module.FS;
  const backend = fs && fs.filesystems && (fs.filesystems.OPFS || fs.filesystems.WASMFS);
  if (!backend || typeof fs.mount !== 'function') {
    return null;
  }
  try { fs.mkdir(mountPoint); } catch (_) { /* exists */ }
  try {
    fs.mount(backend, { autoPersist: true, root: 'webshark-captures' }, mountPoint);
    return mountPoint;
  } catch (_) {
    return null;
  }
}

async function writeOpfsCapture(name, source) {
  try {
    const storage = self.navigator && self.navigator.storage;
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

function wasmFree(module, ptr) {
  if (typeof module._free === 'function') {
    module._free(ptr);
    return;
  }
  const freeFn = module.asm && (module.asm.free || module.asm._free);
  if (typeof freeFn === 'function') {
    freeFn(ptr);
  }
}

function uploadViaMalloc(module, name, bytes) {
  const n = bytes.byteLength;
  const ptr = module._malloc(n);
  try {
    const heap = new Uint8Array(module.HEAPU8.buffer, ptr, n);
    heap.set(bytes);
    return module.upload(safeName(name), ptr, n);
  } finally {
    wasmFree(module, ptr);
  }
}

async function streamFileToUpload(module, name, file) {
  const n = file.size;
  const ptr = module._malloc(n);
  try {
    const heap = new Uint8Array(module.HEAPU8.buffer, ptr, n);
    let offset = 0;
    const reader = file.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      heap.set(value, offset);
      offset += value.byteLength;
    }
    return module.upload(safeName(name), ptr, n);
  } finally {
    wasmFree(module, ptr);
  }
}

/* Stock @goodtools/wiregasm is MEMFS-only. If a future build exports FS.filesystems.OPFS/WASMFS,
 * ingest mounts OPFS and dissects in place. Otherwise: fetch → OPFS → one HEAP copy via upload. */
async function ingestCapture(module, name, source) {
  const fileName = safeName(name);
  if (source.url) {
    const res = await fetch(source.url);
    if (!res.ok) {
      throw new Error('failed to fetch capture: ' + res.status);
    }
    const cloned = typeof res.clone === 'function' ? res.clone() : null;
    const opfsFile = await writeOpfsCapture(fileName, res);
    const mounted = hasWasmFsOpfs(module) ? mountOpfsIfPossible(module) : null;
    if (mounted && opfsFile) {
      return { path: mounted + '/' + fileName, via: 'wasmfs-opfs' };
    }
    if (opfsFile) {
      return { path: await streamFileToUpload(module, fileName, opfsFile), via: 'opfs-malloc' };
    }
    const buf = new Uint8Array(await (cloned || res).arrayBuffer());
    return { path: uploadViaMalloc(module, fileName, buf), via: 'malloc' };
  }
  const bytes = source.data instanceof Uint8Array ? source.data : new Uint8Array(source.data || []);
  await writeOpfsCapture(fileName, bytes);
  const mounted = hasWasmFsOpfs(module) ? mountOpfsIfPossible(module) : null;
  if (mounted) {
    return { path: mounted + '/' + fileName, via: 'wasmfs-opfs' };
  }
  return { path: uploadViaMalloc(module, fileName, bytes), via: 'malloc' };
}

async function ensureInit() {
  if (ready) {
    return;
  }
  const base = self.location.href.replace(/[^/]+$/, '');
  lib = await loadWiregasm({
    locateFile: function (p) {
      if (p.endsWith('.data')) {
        return base + 'wiregasm.data';
      }
      if (p.endsWith('.wasm')) {
        return base + 'wiregasm.wasm';
      }
      return base + p;
    }
  });
  if (!lib.init()) {
    throw new Error('Failed to initialize Wiregasm');
  }
  ready = true;
}

function openSession(path) {
  if (session) {
    try { session.delete(); } catch (_) { /* ignore */ }
    session = null;
  }
  session = new lib.DissectSession(path);
  return session.load();
}

function requireSession() {
  if (!session) {
    throw new Error('No capture loaded');
  }
  return session;
}

async function handle(type, payload) {
  payload = payload || {};
  switch (type) {
    case 'load': {
      const ingested = await ingestCapture(lib, payload.name, payload);
      const loaded = openSession(ingested.path);
      return { code: loaded.code, error: loaded.error, summary: loaded.summary, via: ingested.via, path: ingested.path };
    }
    case 'frames': {
      const r = requireSession().getFrames(payload.filter || '', payload.skip || 0, payload.limit || 0);
      return {
        matched: r.matched,
        frames: vec(r.frames).map(function (m) {
          return { number: m.number, bg: m.bg, fg: m.fg, columns: vec(m.columns) };
        })
      };
    }
    case 'frame': {
      const f = requireSession().getFrame(payload.number);
      return {
        number: f.number,
        bytes: (vec(f.data_sources)[0] || {}).data || '',
        data_sources: vec(f.data_sources),
        tree: vec(f.tree).map(plainTree),
        follow: vec(f.follow).map(function (pair) { return vec(pair); }),
        comments: vec(f.comments)
      };
    }
    case 'tap': {
      const args = new lib.MapInput();
      Object.keys(payload).forEach(function (k) { args.set(k, payload[k]); });
      let r;
      try {
        r = requireSession().tap(args);
      } catch (err) {
        return { error: (err && err.message) || String(err), taps: [] };
      }
      return {
        error: r.error || '',
        taps: vec(r.taps).map(function (t) {
          try {
            return {
              tap: t.tap || '',
              type: t.type || '',
              proto: t.proto || '',
              geoip: !!t.geoip,
              convs: vec(t.convs).map(function (c) {
                return {
                  saddr: c.saddr || '', daddr: c.daddr || '',
                  sport: c.sport || '', dport: c.dport || '',
                  txf: c.txf, txb: c.txb, rxf: c.rxf, rxb: c.rxb,
                  start: c.start, stop: c.stop, filter: c.filter || ''
                };
              }),
              hosts: vec(t.hosts).map(function (h) {
                return {
                  host: h.host || '', port: h.port || '',
                  txf: h.txf, txb: h.txb, rxf: h.rxf, rxb: h.rxb,
                  filter: h.filter || ''
                };
              }),
              objects: vec(t.objects).map(function (o) {
                return {
                  hostname: o.hostname || '', pkt: o.pkt,
                  type: o.type || '', filename: o.filename || '',
                  _download: o._download || '', len: o.len
                };
              })
            };
          } catch (_) {
            return { tap: '', type: (t && t.type) || '', proto: (t && t.proto) || '', geoip: false, convs: [], hosts: [], objects: [] };
          }
        })
      };
    }
    case 'follow': {
      const f = requireSession().follow(payload.follow, payload.filter || '');
      return {
        shost: f.shost, sport: f.sport, sbytes: f.sbytes,
        chost: f.chost, cport: f.cport, cbytes: f.cbytes,
        payloads: vec(f.payloads).map(function (p) {
          return { number: p.number, server: p.server, data: p.data };
        })
      };
    }
    case 'iograph': {
      const args = new lib.MapInput();
      Object.keys(payload).forEach(function (k) { args.set(k, String(payload[k])); });
      const r = requireSession().iograph(args);
      return {
        error: r.error,
        iograph: vec(r.iograph).map(function (g) { return { items: vec(g.items) }; })
      };
    }
    case 'complete': {
      const r = lib.completeFilter(payload.field || payload.filter || '');
      return {
        fields: vec(r.fields).map(function (f) {
          return { field: f.field || f.name || '', type: f.type || '', name: f.name || '' };
        })
      };
    }
    case 'check': {
      const r = lib.checkFilter(payload.filter || '');
      return { ok: !!r.ok, error: r.error || '' };
    }
    case 'download': {
      const r = requireSession().download(payload.token);
      const pack = r.download || r;
      return {
        error: r.error || '',
        download: pack ? { file: pack.file, mime: pack.mime, data: pack.data } : null
      };
    }
    case 'exportPcap': {
      const filter = payload.filter || '';
      const r = requireSession().getFrames(filter, 0, 0);
      const frames = vec(r.frames);
      const packets = [];
      for (let i = 0; i < frames.length; i++) {
        const meta = frames[i];
        const f = requireSession().getFrame(meta.number);
        const src = vec(f.data_sources)[0] || {};
        const cols = vec(meta.columns);
        packets.push({
          t: parseFloat(cols[1]) || 0,
          data: src.data || ''
        });
      }
      return { matched: r.matched, packets: packets };
    }
    case 'columns':
      return vec(lib.getColumns());
    default:
      throw new Error('unknown wiregasm method: ' + type);
  }
}

let jobQueue = Promise.resolve();

self.onmessage = function (ev) {
  const data = ev.data || {};
  jobQueue = jobQueue.then(async function () {
    try {
      await ensureInit();
      const result = await handle(data.type, data.payload);
      self.postMessage({ id: data.id, ok: true, result: result });
    } catch (err) {
      self.postMessage({ id: data.id, ok: false, error: (err && err.message) || String(err) });
    }
  });
};
