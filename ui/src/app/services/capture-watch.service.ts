import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';

export interface CaptureWatchEvent {
  size: number;
  mtime: number;
  kind?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CaptureWatchService {
  constructor(private zone: NgZone) {}

  watch(capture: string, eventSourceFactory: (url: string) => EventSource = (url) => new EventSource(url)): Observable<CaptureWatchEvent> {
    return new Observable((subscriber) => {
      const url = `/webshark/watch?capture=${encodeURIComponent(capture)}`;
      const es = eventSourceFactory(url);
      const onChanged = (ev: MessageEvent) => {
        let data: CaptureWatchEvent;
        try {
          data = JSON.parse(ev.data);
        } catch {
          return;
        }
        this.zone.run(() => subscriber.next(data));
      };
      es.addEventListener('capture-changed', onChanged as EventListener);
      es.onerror = () => {
        // EventSource reconnects; keep the subscription open.
      };
      return () => {
        es.removeEventListener('capture-changed', onChanged as EventListener);
        es.close();
      };
    });
  }
}
