import { ModalResizableService } from './../controls/modal-resizable/modal-resizable.service';
import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { environment } from '@environments/environment';
import { iframeEmbedSnippet, parseViewState } from '@app/helper/share-url';
import { captureFileUrl } from '@app/helper/wiregasm-adapt';

declare const transcode: Function;
@Component({
  selector: 'app-Home',
  templateUrl: './Home.component.html',
  styleUrls: ['./Home.component.scss']
})
export class HomeComponent implements OnInit {
  typeOfChart: any = 'area';
  files: any;
  isKIOSK = !!environment.kiosk;
  isEmbed = false;
  isClientOnly = !!environment.clientOnly;
  isFileOnLink: boolean = false;
  dialogs: any[] = [];
  framePosition: any = ['vertical', 'horizontal'];
  chartSeries: any[] = [];
  private openedView = '';
  constructor(
    private webSharkDataService: WebSharkDataService,
    private modalResizableService: ModalResizableService,
    private route: ActivatedRoute
  ) {
    const state = parseViewState(location.search);
    this.isEmbed = !!environment.kiosk || !!state.embed || location.pathname.indexOf('/embed') !== -1;
    this.isKIOSK = this.isKIOSK || this.isEmbed;
    this.isFileOnLink = !state.capture;
    this.files = this.isFileOnLink;
    this.modalResizableService.event.subscribe(({ open, data }) => {
      if (open) {
        this.dialogs.push(data)
      }
    });
    this.webSharkDataService.updates.subscribe((ev: any) => {
      if (ev?.cm === 'capture' && !this.webSharkDataService.getCapture()) {
        this.dialogs = [];
        this.openedView = '';
        this.chartSeries = [];
      }
    });

  }
  async ngOnInit() {
    this.webSharkDataService.updates.subscribe((ev: any) => {
      if (ev?.cm === 'loaded' || ev?.cm === 'view') {
        this.openViewFromUrl();
      }
    });
    const view = this.route.snapshot.paramMap.get('view');
    if (view) {
      this.webSharkDataService.setView(view);
    }
    await this.getFiles();
  }
  private openDialogOnce(data: { link: string; name: string }) {
    if (this.dialogs.some((d) => d.link === data.link)) {
      return;
    }
    this.modalResizableService.open(data);
  }
  private openViewFromUrl() {
    const view = this.webSharkDataService.getView();
    const capture = this.webSharkDataService.getCapture();
    if (!view || !capture || view === this.openedView) {
      return;
    }
    if (!this.webSharkDataService.isCaptureLoaded()) {
      return;
    }
    try {
      this.openedView = view;
      if (view === 'rtp') {
        const stream = this.webSharkDataService.getStream();
        if (stream) {
          this.webSharkDataService.setPendingRtpPlay([stream]);
        }
        this.openDialogOnce({ link: 'rtp-streams', name: 'RTP Streams' });
      } else if (view === 'voip') {
        this.openDialogOnce({ link: 'voip-calls', name: 'VoIP Calls' });
      } else if (view === 'flow') {
        this.openDialogOnce({ link: 'flow', name: 'Flow Graph' });
      } else if (view === 'follow') {
        const proto = this.webSharkDataService.getFollowHint() || 'TCP';
        this.openDialogOnce({ link: `follow:${proto}`, name: `Follow ${proto}` });
      } else if (view === 'iograph') {
        this.openDialogOnce({ link: 'iograph', name: 'I/O Graph' });
      } else if (view === 'expert') {
        this.openDialogOnce({ link: 'expert', name: 'Expert Info' });
      }
    } catch (err) {
      console.error(err);
    }
  }
  goHome() {
    if (this.isEmbed) {
      return;
    }
    this.dialogs = [];
    this.openedView = '';
    this.chartSeries = [];
    if (this.webSharkDataService.getCapture()) {
      this.webSharkDataService.closeCapture();
    }
  }
  copyShareLink() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
  }
  embedSnippet(): string {
    return iframeEmbedSnippet(window.location.origin, parseViewState(location.search));
  }
  onChartReady(data: any) {
    this.chartSeries = data;
  }
  async getFiles() {
    if (this.isClientOnly) {
      this.files = [];
      return;
    }
    try {
    const getFiles: Function = (dir: string) => this.webSharkDataService.getFiles(dir);
    const fileData = await getFiles();
    if (!fileData?.files) {
      this.files = [];
      return;
    }
    const mapping = (file: any, prefix: string = '/') => {
      if (file.dir === true) {
        const o: any = {
          name: file.name + ` <i></i>[..loading]</i>`,
          description: prefix,
          children: []
        }
        getFiles(file.name).then((data: any) => {
          const arrFiles: any = data.files.map((i: any) => mapping(i, file.name));
          o.name = file.name;
          o.description = prefix;
          o.children.push(...arrFiles);
          this.files = [...this.files];

        })
        return o;
      }
      file.description = prefix;
      return file;
    }
    const files = fileData.files.map((i: any) => mapping(i, ''));
    this.files = [
      ...files.filter((i: any) => i.children),
      ...files.filter((i: any) => !i.children)
    ];
    } catch {
      this.files = [];
    }
  }
  onClose(idx: number): void {
    this.dialogs = this.dialogs.filter((i, k) => k !== idx);
  }
  get captureFile() {
    return this.webSharkDataService.getCapture();
  }

  downloadCapture() {
    this.webSharkDataService.downloadCaptureFile();
  }

  downloadFile(filename: string) {
    if (!filename) {
      return;
    }
    // console.log('downloading file', filename);
    const url = captureFileUrl(filename);

    const link = document.createElement('a');
    link.setAttribute('target', '_blank');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    // link.remove();
  }

  saveToFile(data: any, filename: string, type = 'application/octet-stream') {
    const file = new Blob([data], { type: type });
    const nav: any = window.navigator as any;
    if (nav.msSaveOrOpenBlob) {
      // IE10+
      nav.msSaveOrOpenBlob(file, filename);
    } else {
      // Others
      const a = document.createElement('a'),
        url = URL.createObjectURL(file);
      a.href = url;
      a.target = '(file)';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
    }
  }

}
