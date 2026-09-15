import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { ModalResizableService } from '../modal-resizable/modal-resizable.service';
import { AlertService } from '../alert/alert.service';
import { tapInfoLists } from '@app/helper/wireshark-views';

@Component({
  selector: 'app-menu-stat',
  templateUrl: './menu-stat.component.html',
  styleUrls: ['./menu-stat.component.scss']
})
export class MenuStatComponent implements OnInit {
  convs: any[] = [];
  endpts: any[] = [];
  exportObjects: any[] = [];
  hasCapture = false;
  hasFilter = false;
  exporting = false;
  @ViewChild('fileOpen') fileOpen?: ElementRef<HTMLInputElement>;

  constructor(
    private webSharkDataService: WebSharkDataService,
    private modalResizableService: ModalResizableService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    await this.initMenu();
    this.webSharkDataService.updates.subscribe((ev: any) => {
      if (ev?.cm === 'frame' || ev?.cm === 'view' || ev?.cm === 'filter') {
        this.hasFilter = !!this.webSharkDataService.getFilter();
        this.cdr.detectChanges();
        return;
      }
      this.initMenu();
    });
  }
  public onMenuClick(link: string, name: string) {
    this.modalResizableService.open({ link, name });
    this.cdr.detectChanges();
  }

  openLocalCapture() {
    setTimeout(() => this.fileOpen?.nativeElement?.click(), 0);
  }

  onLocalFilePicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.webSharkDataService.openLocalCapture(file).then(
      () => this.alertService.success('Opened ' + file.name),
      () => this.alertService.error('Could not open ' + file.name)
    );
  }

  closeCapture() {
    this.webSharkDataService.closeCapture();
  }

  downloadCapture() {
    this.webSharkDataService.downloadCaptureFile();
  }

  async exportSpecifiedPackets() {
    if (this.exporting) {
      return;
    }
    this.exporting = true;
    this.cdr.detectChanges();
    try {
      const { filename, count } = await this.webSharkDataService.exportSpecifiedPackets();
      this.alertService.success(`Exported ${count} packet${count === 1 ? '' : 's'} to ${filename}`);
    } catch (err: any) {
      this.alertService.error(err?.errstr || err?.message || 'Export failed');
    } finally {
      this.exporting = false;
      this.cdr.detectChanges();
    }
  }

  async initMenu() {
    try {
      this.hasCapture = !!this.webSharkDataService.getCapture();
      this.hasFilter = !!this.webSharkDataService.getFilter();
      if (!this.hasCapture) {
        this.convs = [];
        this.endpts = [];
        this.exportObjects = [];
        this.cdr.detectChanges();
        return;
      }
      const { convs, endpts, eo } = tapInfoLists(await this.webSharkDataService.getInfo());
      this.convs = convs;
      this.endpts = endpts;
      this.exportObjects = (eo || []).map((item: any) => ({
        ...item,
        name: item.name
      }));
      this.cdr.detectChanges();
    } catch (err) {
      this.convs = [];
      this.endpts = [];
      this.exportObjects = [];
      this.cdr.detectChanges();
    }
  }
}
