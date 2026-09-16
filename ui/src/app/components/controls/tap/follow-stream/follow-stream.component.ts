import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { packetFlowFromFrames } from '@app/helper/flow-view';

@Component({
    selector: 'follow-stream',
    templateUrl: './follow-stream.component.html',
    styleUrls: ['./follow-stream.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class FollowStreamComponent {
  chunks: Array<{ d: string; s: number; n?: number }> = [];
  meta = '';
  error = '';
  filter = '';
  flowData: any = null;
  flowBusy = false;

  @Input() set data(val: any) {
    this.render(val);
  }

  constructor(private webSharkDataService: WebSharkDataService) {}

  async showFlowGraph() {
    if (this.flowData) {
      this.flowData = null;
      return;
    }
    if (!this.filter) {
      this.error = 'No stream filter to graph';
      return;
    }
    this.flowBusy = true;
    try {
      const frames = await this.webSharkDataService.framesWithFilter(this.filter, 400);
      this.flowData = packetFlowFromFrames(frames);
      if (!this.flowData.flows?.length) {
        this.error = 'No packets to graph for this stream';
        this.flowData = null;
      } else {
        this.error = '';
      }
    } catch (err: any) {
      this.error = err?.errstr || err?.message || 'Could not build flow graph';
    }
    this.flowBusy = false;
  }

  selectChunk(chunk: { n?: number }) {
    const n = Number(chunk?.n);
    if (Number.isFinite(n) && n > 0) {
      this.webSharkDataService.selectFrame(n);
    }
  }

  private render(result: any) {
    this.chunks = [];
    this.meta = '';
    this.error = '';
    this.filter = '';
    this.flowData = null;
    if (!result) {
      this.error = 'No stream selected';
      return;
    }
    if (result.error) {
      this.error = String(result.error);
    }
    const follow = result.follow || result;
    this.filter = follow.filter || result.filter || '';
    const payloads = follow.payload || follow.payloads || [];
    if (Array.isArray(payloads)) {
      this.chunks = payloads.map((p: any) => {
        if (typeof p === 'string') {
          return { d: p, s: 0 };
        }
        return {
          n: p?.n ?? p?.number,
          d: String(p?.d ?? p?.data ?? ''),
          s: Number(p?.s ?? p?.server ?? 0)
        };
      }).filter((p: any) => p.d);
    } else if (typeof follow === 'string') {
      this.chunks = [{ d: follow, s: 0 }];
    }
    if (follow.shost) {
      this.meta = `${follow.shost}:${follow.sport || ''} → ${follow.dhost || follow.chost || ''}:${follow.dport || follow.cport || ''}`;
    }
    if (!this.chunks.length && !this.error) {
      this.error = 'This stream has no payload bytes to display.';
    }
  }
}
