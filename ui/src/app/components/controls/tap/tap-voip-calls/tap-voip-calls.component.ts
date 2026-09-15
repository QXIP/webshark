import { Component, Input, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { ModalResizableService } from '../../modal-resizable/modal-resizable.service';
import { sipFlowFromCall } from '@app/helper/voip-calls';

@Component({
  selector: 'tap-voip-calls',
  templateUrl: './tap-voip-calls.component.html',
  styleUrls: ['./tap-voip-calls.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TapVoipCallsComponent implements OnInit {
  calls: any[] = [];
  activeId = '';
  flowData: any = null;
  errorMessage = '';

  @Input() set data(val: any) {
    this.calls = val?.calls || [];
    this.flowData = null;
  }

  constructor(
    private webSharkDataService: WebSharkDataService,
    private modalResizableService: ModalResizableService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.cdr.detectChanges();
  }

  get selected() {
    return (this.calls || []).filter((c) => c.__selected);
  }

  get selectedCount() {
    return this.selected.length;
  }

  onCheck() {
    this.cdr.detectChanges();
  }

  formatTime(value: any): string {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return value == null ? '' : String(value);
    }
    return n.toFixed(3);
  }

  rowClick(call: any) {
    if (!call) {
      return;
    }
    this.calls.forEach((c) => c.__selected = c === call);
    this.activeId = call.id;
    this.cdr.detectChanges();
  }

  playStreams() {
    const tokens = this.selected.flatMap((c) => c.rtpTokens || []);
    if (!tokens.length) {
      this.errorMessage = 'No RTP streams on the selected call(s)';
      this.cdr.detectChanges();
      return;
    }
    this.errorMessage = '';
    this.webSharkDataService.setPendingRtpPlay(tokens);
    this.modalResizableService.open({ link: 'rtp-streams', name: 'RTP Player' });
    this.cdr.detectChanges();
  }

  flowSequence() {
    const call = this.selected[0] || this.calls.find((c) => c.id === this.activeId);
    if (!call) {
      this.errorMessage = 'Select a call first';
      this.cdr.detectChanges();
      return;
    }
    const full = this.webSharkDataService.getVoipCall(call.id) || call;
    this.flowData = sipFlowFromCall(full);
    this.activeId = call.id;
    if (!this.flowData.flows?.length) {
      this.errorMessage = 'No SIP signaling to plot for this call';
      this.flowData = null;
    } else {
      this.errorMessage = '';
    }
    this.cdr.detectChanges();
  }

  closeFlow() {
    this.flowData = null;
    this.cdr.detectChanges();
  }
}
