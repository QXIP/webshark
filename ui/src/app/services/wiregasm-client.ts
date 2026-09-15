import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import {
  completeToSharkd,
  followToSharkd,
  frameToSharkd,
  framesToSharkd,
  iographToSharkd,
  tapToSharkd,
  checkToSharkd
} from '@app/helper/wiregasm-adapt';

export interface WiregasmBackend {
  call(type: string, payload?: any): Promise<any>;
}

export const WIREGASM_BACKEND = new InjectionToken<WiregasmBackend>('WIREGASM_BACKEND');

function workerUrl(): string {
  if (typeof document === 'undefined') {
    return '/webshark/assets/wiregasm/session-worker.js';
  }
  const base = document.querySelector('base')?.getAttribute('href') || '/webshark/';
  const root = base.endsWith('/') ? base : base + '/';
  return `${root}assets/wiregasm/session-worker.js`;
}

@Injectable({
  providedIn: 'root'
})
export class WiregasmClient {
  private worker?: Worker;
  private seq = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private backend?: WiregasmBackend;
  private chain: Promise<void> = Promise.resolve();

  constructor(@Optional() @Inject(WIREGASM_BACKEND) backend?: WiregasmBackend) {
    this.backend = backend || undefined;
    if (!this.backend && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(workerUrl());
        this.worker.onmessage = (ev: MessageEvent) => {
          const { id, ok, result, error } = ev.data || {};
          const waiter = this.pending.get(id);
          if (!waiter) {
            return;
          }
          this.pending.delete(id);
          if (ok) {
            waiter.resolve(result);
          } else {
            waiter.reject({ err: 1, errstr: error || 'wiregasm error' });
          }
        };
        this.worker.onerror = (err) => {
          this.pending.forEach((w) => w.reject({ err: 1, errstr: err.message || 'worker error' }));
          this.pending.clear();
        };
      } catch (_) {
        this.worker = undefined;
      }
    }
  }

  call(type: string, payload?: any): Promise<any> {
    if (this.backend) {
      return this.backend.call(type, payload);
    }
    if (!this.worker) {
      return Promise.reject({ err: 1, errstr: 'Wiregasm worker is unavailable' });
    }
    const run = () => {
      const id = ++this.seq;
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        this.worker!.postMessage({ id, type, payload });
      });
    };
    const next = this.chain.then(run, run);
    this.chain = next.then(() => undefined, () => undefined);
    return next;
  }

  load(name: string, data?: Uint8Array | { url?: string; data?: Uint8Array | ArrayBuffer }): Promise<any> {
    if (data instanceof Uint8Array) {
      return this.call('load', { name, data });
    }
    return this.call('load', { name, ...(data || {}) });
  }

  async frames(filter = '', skip = 0, limit = 0): Promise<any[]> {
    return framesToSharkd(await this.call('frames', { filter, skip, limit }));
  }

  async frame(number: number): Promise<any> {
    return frameToSharkd(await this.call('frame', { number }));
  }

  async tap(taps: Record<string, string>): Promise<any> {
    return tapToSharkd(await this.call('tap', taps));
  }

  async follow(follow: string, filter: string): Promise<any> {
    return followToSharkd(await this.call('follow', { follow, filter }));
  }

  async iograph(input: Record<string, string | number>): Promise<any> {
    return iographToSharkd(await this.call('iograph', input));
  }

  async complete(field: string): Promise<any> {
    return completeToSharkd(await this.call('complete', { field }));
  }

  async check(filter: string): Promise<any> {
    return checkToSharkd(await this.call('check', { filter }));
  }

  download(token: string): Promise<any> {
    return this.call('download', { token });
  }

  exportPcap(filter = ''): Promise<any> {
    return this.call('exportPcap', { filter });
  }

  readCapture(): Promise<{ name?: string; data?: Uint8Array }> {
    return this.call('readCapture');
  }

  rtpDump(stream: { ssrc?: string | number; saddr?: string; sport?: number; daddr?: string; dport?: number }): Promise<any> {
    const ssrc = typeof stream?.ssrc === 'number'
      ? stream.ssrc.toString(16)
      : String(stream?.ssrc || '').replace(/^0x/i, '');
    return this.call('rtpDump', {
      ssrc,
      saddr: stream?.saddr || '',
      sport: Number(stream?.sport) || 0,
      daddr: stream?.daddr || '',
      dport: Number(stream?.dport) || 0
    });
  }
}
