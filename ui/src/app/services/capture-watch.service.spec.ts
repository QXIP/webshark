import { CaptureWatchService } from './capture-watch.service';
import { NgZone } from '@angular/core';

class FakeEventSource {
  listeners: { [k: string]: Function[] } = {};
  url: string;
  onerror: ((ev?: any) => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
  }
  addEventListener(type: string, fn: Function) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(fn);
  }
  removeEventListener(type: string, fn: Function) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }
  emit(type: string, data: any) {
    (this.listeners[type] || []).forEach((fn) => fn({ data: JSON.stringify(data) }));
  }
  close() {
    this.closed = true;
  }
}

describe('CaptureWatchService', () => {
  it('emits capture-changed payloads from SSE', (done) => {
    const fake = new FakeEventSource('/webshark/watch?capture=voip.pcapng');
    const svc = new CaptureWatchService(new NgZone({ enableLongStackTrace: false }));
    svc.watch('voip.pcapng', () => fake as any).subscribe((ev) => {
      expect(fake.url).toContain('capture=voip.pcapng');
      expect(ev.size).toBe(2048);
      expect(ev.kind).toBe('append');
      done();
    });
    fake.emit('capture-changed', { size: 2048, mtime: 1, kind: 'append' });
  });
});
