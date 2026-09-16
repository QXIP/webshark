import { hash } from '@app/helper/functions';
import { AfterViewInit, ChangeDetectorRef, Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { flowArrowBox, flowColorKey } from '@app/helper/flow-view';
import { formatFlowTime } from '@app/helper/voip-calls';
import { WebSharkDataService } from '@app/services/web-shark-data.service';

@Component({
    selector: 'tap-flow',
    templateUrl: './tap-flow.component.html',
    styleUrls: ['./tap-flow.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class TapFlowComponent implements OnInit, AfterViewInit {
  hosts: string[] = [];
  flowItems: any[] = [];
  selectedIndex: number = -1;

  @Input() set data(val: any) {
    this.hosts = val?.nodes || [];
    this.flowItems = val?.flows || [];
    this.cdr.detectChanges();
  }

  constructor(
    private cdr: ChangeDetectorRef,
    private webSharkDataService: WebSharkDataService
  ) { }

  ngOnInit() {
    this.cdr.detectChanges();
  }
  ngAfterViewInit() {
    this.cdr.detectChanges();
  }
  formatTime(value: any) {
    return formatFlowTime(value);
  }
  arrowBox(item: any) {
    return flowArrowBox(item?.n || [0, 1], this.hosts.length || 1);
  }
  arrowColor(item: any) {
    return `#${hash(flowColorKey(item?.pn ?? item?.c), 6)}`;
  }
  setSelected(index: number) {
    this.selectedIndex = index;
    const frame = Number(this.flowItems[index]?.pn);
    if (Number.isFinite(frame) && frame > 0) {
      this.webSharkDataService.selectFrame(frame);
    }
    this.cdr.detectChanges();
  }
  getSelected(index: number) {
    return this.selectedIndex === index;
  }
}
