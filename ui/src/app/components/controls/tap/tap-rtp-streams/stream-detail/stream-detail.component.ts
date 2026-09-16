import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { hash } from '@app/helper/functions';
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/plugins/timeline';
import { TypeOfChart } from '@app/components/controls/flexible-chart/flexible-chart.component';
import { rtpStreamColumns } from '@app/helper/rtp-from-frames';

@Component({
    selector: 'stream-detail',
    templateUrl: './stream-detail.component.html',
    styleUrls: ['./stream-detail.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class StreamDetailComponent implements AfterViewInit, OnDestroy {

  onClose() {
    this.close.emit({})
  }

  lastRange: any;
  _data: any;
  columns: any;
  streams: any[] = [];
  selectedStreams: any;
  selectedColumns: any;

  optionsAudioContainer = {
    normalize: true,
    height: 96,
    waveColor: '#4a90d9',
    progressColor: '#1b5e20',
    cursorColor: '#333333',
    barWidth: 2,
    barGap: 1,
    minPxPerSec: 50,
  }
  @Input() rec: any;
  @ViewChild('waveform') waveform?: ElementRef<HTMLDivElement>;
  private playerTries = 0;

  @Input() set data(val: any) {
    this._data = val;
    this.streams = val.streams || [];
    const [stream] = this.streams || [];
    this.columns = rtpStreamColumns(stream);
  }
  @Output() close: EventEmitter<any> = new EventEmitter();
  get data(): any {
    return this._data;
  }
  typeOfChartRadio: TypeOfChart = 'bar'
  isReady = false;
  chartData: any[] = [];
  rangeChartData: any[] = [];
  columnDictionary: any = {
    bw: 'IP BW (kbps)',
    d: 'Delta',
    f: 'Packet (Time)',
    j: 'Jitter',
    mark: 'Marker',
    o: 'o',
    s: 'Status',
    sk: 'Skew (ms)',
    sn: 'Sequence',
    t: 't',
  };

  chartFilter = Object.entries(this.columnDictionary).map(([key, val]: any) => ({
    title: val,
    index: key,
    color: '#' + hash(key, 3),
    value: true
  }))
  columnsDictionary: any = Object.values(this.columnDictionary);
  constructor(
    private cdr: ChangeDetectorRef
  ) { }
  get titleId() {
    const tap = this.rec?.rowData?.taps?.[0] || {};
    const raw = String(tap.tap || '').replace(/^rtp-analyse:/, '');
    const parts = raw.split('_');
    const ssrc = tap.ssrc || parts[4] || '';
    if (parts.length >= 5) {
      return `${ssrc} - ${parts[0]}:${parts[1]} -> ${parts[2]}:${parts[3]}`;
    }
    return ssrc || 'RTP stream';
  }
  getPlayer(rec: any, container: HTMLElement) {
    if (!rec || rec.player) {
      return rec;
    }
    if (rec.noData || !rec.mp3) {
      rec.noData = true;
      return rec;
    }
    try {
      const player = WaveSurfer.create({
        ...this.optionsAudioContainer,
        container,
        url: rec.mp3,
        plugins: [TimelinePlugin.create({
          height: 16,
          timeInterval: 0.5,
          primaryLabelInterval: 1,
        })]
      });
      player.on('ready', () => {
        this.cdr.detectChanges();
      });
      player.on('audioprocess', () => {
        this.cdr.detectChanges();
      });
      player.on('error', (err: any) => {
        console.error('WaveSurfer error', err);
        rec.noData = true;
        this.cdr.detectChanges();
      });
      rec.player = player;
    } catch (err) {
      console.error(err, rec);
      rec.noData = true;
    }
    return rec;
  }
  private attachPlayer() {
    if (!this.rec?.mp3 || this.rec.noData || this.rec.player) {
      return;
    }
    const el = this.waveform?.nativeElement;
    if (!el || el.clientWidth < 8) {
      if (this.playerTries++ < 40) {
        requestAnimationFrame(() => this.attachPlayer());
      }
      return;
    }
    this.getPlayer(this.rec, el);
    this.cdr.detectChanges();
  }
  ngAfterViewInit() {
    this.isReady = true;
    this.setRecActive();
    requestAnimationFrame(() => this.attachPlayer());
  }
  ngOnDestroy() {
    try {
      this.rec?.player?.destroy();
    } catch (err) {}
  }

  setRecActive() {
    let playerElement = this.rec;
    const [tap]: any = playerElement?.rowData?.taps || [];
    this.selectedStreams = tap?.items || [];
    this.selectedColumns = ["bw", "d", "f", "j", "mark", "o", "s", "sk", "sn", "t"];
    this.chartData = this.getChartData();
    this.onRange([0, 0]);
    this.cdr.detectChanges();
  }
  playItemClick(event: any) {
    console.log({ event });
  }
  onZoomAudio(event: any, player: any) {
    if (!player) {
      return;
    }
    if (!player._myZoom) {
      player._myZoom = 1;
    }
    player._myZoom += event.wheelDelta / 12
    player._myZoom = Math.max(1, player._myZoom);
    player.zoom(player._myZoom);
    this.cdr.detectChanges();
  }
  onRange([a, b]: any) {
    const start = Math.min(a, b);
    const end = Math.max(a, b);

    this.lastRange = { start, end };
    this.rangeChartData = [];

    this.chartData.forEach(item => {
      const out = Object.assign({}, item);
      if (start >= 0 && end >= 0 && start != end) {
        out.data = out.data.slice(start, end);
      } else {
        out.data = out.data;
      }
      this.rangeChartData.push(out)
    })
  }
  getChartData() {
    const outData: any[] = [];
    this.selectedColumns.forEach((column: string) => {
      if (this.chartFilter.find(i => i.index == column)?.value) {
        const d = {
          color: '#' + hash(column, 3),
          name: this.columnDictionary[column],
          data: this.selectedStreams.map((stream: any) => stream[column])
        };
        outData.push(d)
      }
    })
    return outData;
  }
  onFilterChart() {
    this.chartData = this.getChartData();
    if (this.lastRange) {
      const { start, end } = this.lastRange;
      this.onRange([start, end]);
    } else {
      this.onRange([]);
    }
    this.cdr.detectChanges();
  }
}
