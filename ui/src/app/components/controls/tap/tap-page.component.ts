import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { Component, Input } from '@angular/core';
import { conversationDisplayFilter, expertSeverityFilter, exportObjectToken } from '@app/helper/wireshark-views';
import { packetFlowFromFrames } from '@app/helper/flow-view';
import { frameTreeFromSharkd } from '@app/helper/live-follow';

@Component({
  selector: 'tap-page',
  templateUrl: './tap-page.component.html',
  styleUrls: ['./tap-page.component.scss']
})
export class TapPageComponent {
  public loading = false;
  public title: string = '';
  public jsonData: any = null;
  public type: string = '';
  public tapLink: string = '';

  @Input() set taplink(link: string) {
    this.loading = true;
    this.tapLink = link;
    this.initData(link);
  }
  constructor(
    private webSharkDataService: WebSharkDataService
  ) { }

  async initData(link: string) {
    this.loading = true;
    try {
      if (link === 'iograph') {
        this.type = 'iograph';
        this.title = 'I/O Graph';
        this.jsonData = await this.webSharkDataService.getIograph();
        return;
      }
      if (link === 'flow' || link.startsWith('flow:')) {
        this.type = 'flow';
        this.title = 'Flow Graph';
        const extra = link.startsWith('flow:') ? decodeURIComponent(link.slice(5)) : '';
        const filter = extra || this.webSharkDataService.getLastFollow()?.filter || this.webSharkDataService.getFilter() || '';
        const frames = await this.webSharkDataService.framesWithFilter(filter, 400);
        this.jsonData = packetFlowFromFrames(frames);
        this.title = filter ? `Flow Graph [${filter}]` : 'Flow Graph';
        return;
      }
      if (link.startsWith('frame:')) {
        this.type = 'frame';
        const frameId = Number(link.slice(6));
        this.title = Number.isFinite(frameId) ? `Packet ${frameId}` : 'Packet';
        const frameData = await this.webSharkDataService.getFrameData(frameId);
        this.jsonData = {
          tree: frameTreeFromSharkd(frameData?.tree),
          bytes: frameData?.bytes || ''
        };
        return;
      }
      if (link === 'follow' || link.startsWith('follow')) {
        this.type = 'follow';
        this.title = 'Follow Stream';
        try {
          const hint = await this.webSharkDataService.resolveFollow(link);
          this.title = `Follow ${hint.proto}`;
          this.jsonData = { ...await this.webSharkDataService.followStream(hint.proto, hint.filter), filter: hint.filter };
        } catch (err: any) {
          this.jsonData = { error: err?.errstr || err?.message || 'follow failed', payload: [] };
        }
        return;
      }
      const data = await this.webSharkDataService.getTapJson(link);
      const [tapData] = data?.taps || [];
      this.jsonData = tapData || { error: data?.error || 'No tap data' };
      const { name, proto, type } = tapData || {};
      this.title = (name || proto || this.tapLink || '') + (type ? ` [${type}]` : '');
      this.type = type || '';
    } catch (err: any) {
      this.jsonData = { error: err?.errstr || err?.message || 'tap failed' };
      this.type = '';
      this.title = this.tapLink || 'Tap';
    } finally {
      this.loading = false;
    }
  }

  onRowClick(row: any) {
    if (this.type === 'conv' || this.type === 'endpt') {
      const proto = this.jsonData?.proto || 'ip';
      const filter = conversationDisplayFilter(row, proto);
      if (filter) {
        this.webSharkDataService.setFilter(filter);
      }
    }
    if (this.type === 'expert') {
      const severity = row?.s || row?.severity;
      if (severity) {
        this.webSharkDataService.setFilter(expertSeverityFilter(severity));
      }
    }
  }

  downloadObject(item: any, index: number) {
    const tap = (this.tapLink || '').replace(/^eo:/, '') || this.jsonData?.proto || 'http';
    const token = item?._download || exportObjectToken(tap, index);
    this.webSharkDataService.downloadToken(token).then((url) => {
      window.open(url, '_blank');
    });
  }

}
