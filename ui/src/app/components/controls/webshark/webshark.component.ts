import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { CaptureWatchService } from '@app/services/capture-watch.service';
import { Functions } from '@app/helper/functions';
import { framesSkip, isNearBottom, mapFrameRow, packetListRow, packetFrameId, frameTreeFromSharkd, isFrameList, sharkdErrorMessage, asFileList } from '@app/helper/live-follow';
import { completeFieldNames, followFromFrame } from '@app/helper/wireshark-views';
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  AfterViewInit,
  Output,
  EventEmitter,
  Input,
  ViewChild,
  OnInit,
  OnDestroy,
  ElementRef
} from '@angular/core';
import { HighlightService } from '@app/services/hightlight.service';
import { AlertService } from '../alert/alert.service';
import { CustomTableComponent } from '../custom-table/custom-table.component';
import { environment } from './../../../../environments/environment';
import { ModalResizableService } from '../modal-resizable/modal-resizable.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-webshark',
    templateUrl: './webshark.component.html',
    styleUrls: ['./webshark.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class WebsharkComponent implements OnInit, AfterViewInit, OnDestroy {
  textFilterGrid: string = '';
  filterChoices: string[] = [];
  _data: any;
  dataTree: any[] = [];
  destDetailsTable: any[] = [];
  detailsTable: any[] = [];
  columnsTable = ['id', 'time', 'source', 'description', 'protocol', 'length', 'info'];
  dataIndex: any[] = [];
  frameHexDataBase64: string = '';
  highlight: any;
  sizeUp: boolean = false;
  selectedHexArray: any[] = [];
  isKIOSK = !!environment.kiosk;
  liveFollowing = false;
  loadingCapture = false;
  isClientOnly = !!environment.clientOnly;
  private watchSub?: Subscription;
  private watchingCapture = '';
  private initSeq = 0;
  private selectTries = 0;
  private _fileList: any[] = [];
  @Input() set fileList(val: any) {
    this._fileList = asFileList(val);
  }
  get fileList(): any[] {
    return this._fileList;
  }
  @Input() framePosition: any = ['horizontal', 'vertical'];
  @Input() set range(val: any) {
    if (val) {
      const [from, to] = (val || []).sort((a: number, b: number) => a < b ? -1 : a > b ? 1 : 0);

      if (from === to) {
        this.detailsTable = this.destDetailsTable;
        this.cdr.detectChanges();
        return;
      }
      if ((from === 0 || from) && to) {
        this.detailsTable = this.destDetailsTable.slice(from, to);
        this.cdr.detectChanges();
      }
    }

  }
  @Output() ready: EventEmitter<any> = new EventEmitter();
  @Output() dblclick: EventEmitter<any> = new EventEmitter();

  @ViewChild('dataGridTable', { static: false }) dataGrid: any;
  @ViewChild('tableDiv', { static: false }) tableDiv?: ElementRef<HTMLElement>;

  constructor(
    private webSharkDataService: WebSharkDataService,
    private captureWatchService: CaptureWatchService,
    private highlightService: HighlightService,
    private cdr: ChangeDetectorRef,
    private alertService: AlertService,
    private modalResizableService: ModalResizableService
  ) { }

  ngAfterViewInit() {
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 100);
  }
  ngOnInit() {
    this.isKIOSK = !!environment.kiosk || this.webSharkDataService.isEmbed();
    this.textFilterGrid = this.webSharkDataService.getFilter();
    this.webSharkDataService.updates.subscribe((ev: any) => {
      if (ev?.cm === 'frame') {
        this.syncSelectedFrame();
        return;
      }
      if (ev?.cm === 'view' || ev?.cm === 'loaded') {
        return;
      }
      this.initData();
    });
    if (this.webSharkDataService.getCapture()) {
      this.initData();
    }
  }
  ngOnDestroy() {
    this.watchSub?.unsubscribe();
  }

  onClickFile(filename: string) {
    this.webSharkDataService.setCaptureFile(filename);
  }

  private async initData(reload = false) {
    if (!this.webSharkDataService.getCapture()) {
      this.watchSub?.unsubscribe();
      this.watchingCapture = '';
      this.loadingCapture = false;
      this.detailsTable = [];
      this.destDetailsTable = [];
      this.dataTree = [];
      this.frameHexDataBase64 = '';
      this.dataIndex = [];
      this.liveFollowing = false;
      this.ready.emit([]);
      this.cdr.detectChanges();
      return;
    }
    const seq = ++this.initSeq;
    this.loadingCapture = true;
    this.cdr.detectChanges();
    try {
      const data = await this.webSharkDataService.getFrames(0, 0, reload);
      if (seq !== this.initSeq) {
        return;
      }
      if (!isFrameList(data)) {
        this.loadingCapture = false;
        this.alertService.error(sharkdErrorMessage(data));
        this.cdr.detectChanges();
        return;
      }
      this.destDetailsTable = data.map((frame: any) => mapFrameRow(frame));
      this.detailsTable = this.destDetailsTable;
      this.ready.emit([{
        color: 'rgba(255,255,255, 0.8)',
        data: this.destDetailsTable.map((i: any) => i.length * 1)
      }]);
      this.loadingCapture = false;
      this.cdr.detectChanges();
      this.selectTries = 0;
      this.setDefaultSelection();
      this.startWatch();
    } catch (error: any) {
      if (seq !== this.initSeq) {
        return;
      }
      this.loadingCapture = false;
      this.alertService.error(sharkdErrorMessage(error));
      this.cdr.detectChanges();
      return;
    }

    const preferred = this.webSharkDataService.getFrame() || 1;
    await this.initFrameData(preferred);
    this.cdr.detectChanges();
  }
  private syncSelectedFrame() {
    const frame = this.webSharkDataService.getFrame();
    if (!frame) {
      return;
    }
    this.initFrameData(frame);
    const idx = this.detailsTable.findIndex((row: any) => Number(row.id) === Number(frame));
    const dataGrid: CustomTableComponent = this.dataGrid as CustomTableComponent;
    if (dataGrid && idx >= 0) {
      if (typeof dataGrid.scrollToIndex === 'function') {
        dataGrid.scrollToIndex(idx);
      } else {
        dataGrid.setSelected(idx);
      }
    }
    this.cdr.detectChanges();
  }
  setDefaultSelection() {
    const dataGrid: CustomTableComponent = this.dataGrid as CustomTableComponent;
    if (dataGrid) {
      const idx = this.preferredRowIndex();
      dataGrid.setSelected(idx);
      return;
    }
    if (this.selectTries++ < 20) {
      setTimeout(() => { this.setDefaultSelection(); }, 250);
    }
  }
  private preferredRowIndex(): number {
    const frame = this.webSharkDataService.getFrame();
    if (!frame) {
      return 0;
    }
    const idx = this.detailsTable.findIndex((row: any) => Number(row.id) === Number(frame));
    return idx >= 0 ? idx : 0;
  }
  private async initFrameData(frameId: number) {
    const frameData: any = await this.webSharkDataService.getFrameData(frameId);
    this.webSharkDataService.setLastFollow(followFromFrame(frameData?.fol));
    this.frameHexDataBase64 = frameData.bytes;
    this.dataTree = frameTreeFromSharkd(frameData?.tree);
    this.dataIndex = [];
    const indexTree = (nodes: any[]) => {
      (nodes || []).forEach((node) => {
        this.dataIndex.push(Functions.cloneObject(node));
        if (node.children) {
          indexTree(node.children);
        }
      });
    };
    indexTree(this.dataTree);
    this.ngAfterViewInit();
    this.cdr.detectChanges();
  }

  private startWatch() {
    if (this.isClientOnly) {
      return;
    }
    const cap = this.webSharkDataService.getCapture();
    if (!cap || cap === this.watchingCapture) {
      return;
    }
    this.watchSub?.unsubscribe();
    this.watchingCapture = cap;
    this.liveFollowing = false;
    this.watchSub = this.captureWatchService.watch(cap).subscribe((ev) => this.onCaptureChanged(ev));
    this.cdr.detectChanges();
  }

  private async onCaptureChanged(ev: { size: number; kind?: string }) {
    if (!ev || ev.kind === 'init' || ev.kind === 'none') {
      return;
    }
    if (ev.kind === 'full') {
      this.webSharkDataService.clearBuffer();
      await this.initData(true);
      return;
    }
    if (ev.kind === 'append') {
      const stick = this.shouldStickToBottom();
      const skip = framesSkip(this.destDetailsTable.length);
      const data = await this.webSharkDataService.getFrames(0, skip, true);
      const rows = (data || []).map((frame: any) => mapFrameRow(frame));
      this.destDetailsTable = this.destDetailsTable.concat(rows);
      this.detailsTable = this.destDetailsTable;
      this.liveFollowing = true;
      this.ready.emit([{
        color: 'rgba(255,255,255, 0.8)',
        data: this.destDetailsTable.map((i: any) => i.length * 1)
      }]);
      this.cdr.detectChanges();
      if (stick) {
        this.scrollPacketListToBottom();
      }
    }
  }

  private shouldStickToBottom(): boolean {
    const viewport = this.packetListScroll();
    if (!viewport) {
      return true;
    }
    return isNearBottom(viewport.scrollHeight, viewport.scrollTop, viewport.clientHeight);
  }

  private scrollPacketListToBottom() {
    const viewport = this.packetListScroll();
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }

  private packetListScroll(): HTMLElement | null {
    return this.tableDiv?.nativeElement?.querySelector('.table-scroll') as HTMLElement | null;
  }

  showMessage(event: any) {
    const frame = packetFrameId(packetListRow(event));
    if (frame) {
      this.initFrameData(frame);
    }
  }

  openDetails(event: any) {
    const data = packetListRow(event);
    if (!data) {
      return;
    }
    const frame = packetFrameId(data);
    if (frame) {
      this.modalResizableService.open({
        link: `frame:${frame}`,
        name: `Packet ${frame}`
      });
    }
    data.uniqueId = Functions.md5object(data);
    this.dblclick.emit({ data });
  }
  filterGrid(details: any) {
    return details;
  }
  onSelectedHex(x: any) {
    const arraySelected = this.getSelectedItems(x);
    this.selectedHexArray = arraySelected || [];
    const [selectedHex] = arraySelected.filter(i => !i.children).slice(-1) || [];
    if (selectedHex?.highlight) {
      this.highlight = selectedHex?.highlight;
      this.highlightService.set(this.highlight);
    }
    this.cdr.detectChanges();
  }

  getSelectedItems(x: number = 0) {
    return this.dataIndex.filter(i => {
      if (!i.highlight) {
        return false;
      }
      const [from, to] = i.highlight;
      return from <= x && (from + to) > x;
    });
  }
  setFilter(filter: any) {
    this.textFilterGrid = filter;
    this.webSharkDataService.setFilter(this.textFilterGrid);
  }
  onFilterEnter() {
    this.setFilter(this.textFilterGrid);
  }
  async onFilterInput(value: string) {
    this.textFilterGrid = value;
    if (!value) {
      this.filterChoices = [];
      this.cdr.detectChanges();
      return;
    }
    try {
      const result = await this.webSharkDataService.completeFilter(value);
      this.filterChoices = completeFieldNames(result);
    } catch {
      this.filterChoices = [];
    }
    this.cdr.detectChanges();
  }
  openFollow() {
    const fol = this.webSharkDataService.getLastFollow();
    const proto = fol?.proto || 'TCP';
    this.webSharkDataService.setView('follow', { follow: proto });
    this.modalResizableService.open({ link: `follow:${proto}`, name: `Follow ${proto} Stream` });
  }
  openFlowGraph() {
    const fol = this.webSharkDataService.getLastFollow();
    const filter = fol?.filter || this.webSharkDataService.getFilter() || '';
    const link = filter ? `flow:${encodeURIComponent(filter)}` : 'flow';
    this.webSharkDataService.setView('flow');
    this.modalResizableService.open({ link, name: 'Flow Graph' });
  }
  openIoGraph() {
    this.webSharkDataService.setView('iograph');
    this.modalResizableService.open({ link: 'iograph', name: 'I/O Graph' });
  }
  onSelected(event: any) {
    this.highlight = event.highlight;
    if (this.highlight) {
      const arraySelected = this.getSelectedItems(this.highlight[0]);
      this.selectedHexArray = arraySelected || [];
      this.highlightService.set(this.highlight);
      this.cdr.detectChanges();
    }
  }
}
