import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { Component, Input, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { findReverseRtp } from '@app/helper/rtp-from-frames';
import { ffmpegCodecFallbacks, ffmpegCodecForPayload } from '@app/helper/rtp-codec';
import { rtpStreamToken } from '@app/helper/share-url';
import { blobFromPaddedClip, getTranscode, rtpPacketsForStream, sessionStartForClips, RtpAudioClip } from '@app/helper/rtp-extract';
import { analyseRtpItems, analyseRtpPackets, rtpClockRate, RtpAnalyseItem, RtpAnalyseStats } from '@app/helper/rtp-analyse';
import { rtpRelativeTime, rtpSsrcLabel, rtpStreamLabel, rtpStreamTabLabel, rtpWaveColor } from '@app/helper/rtp-player';

export interface RtpAnalyseView {
  token: string;
  tab: string;
  src: string;
  dst: string;
  ssrc: string;
  payload: string;
  t0: number;
  items: RtpAnalyseItem[];
  stats: RtpAnalyseStats;
}

@Component({
    selector: 'tap-rtp-streams',
    templateUrl: './tap-rtp-streams.component.html',
    styleUrls: ['./tap-rtp-streams.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class TapRtpStreamsComponent implements OnInit {
  _data: any;
  streams: any[] = [];
  activeToken = '';
  analyzeNote = '';
  analyses: RtpAnalyseView[] = [];
  analyseTab = 0;
  selectedPacket = 0;

  players: any[] = [];
  private opening = false;
  private captureBytes: ArrayBuffer | null = null;
  private blobUrlCache = new Map<string, string>();
  private lastSessionStart: number | null = null;

  @Input() set data(val: any) {
    this._data = val;
    this.streams = val.streams || [];
  }
  get data(): any {
    return this._data;
  }
  isReady = false;
  busy = false;
  errorMessage = '';
  progressMessage = ['Initialization'];

  constructor(
    private webSharkDataService: WebSharkDataService,
    private cdr: ChangeDetectorRef
  ) { }

  get captureFile() {
    return this.webSharkDataService.getCapture();
  }
  get selectedCount() {
    return (this.streams || []).filter((s) => s.__selected).length;
  }
  get selectedStreams() {
    return (this.streams || []).filter((s) => s.__selected);
  }
  get masterPlayer() {
    return this.players.find((p) => p.player)?.player;
  }
  get anyPlaying() {
    return this.players.some((p) => p.player?.isPlaying?.());
  }
  get duration() {
    return this.masterPlayer?.getDuration?.() || 0;
  }
  get currentTime() {
    return this.masterPlayer?.getCurrentTime?.() || 0;
  }
  get activeAnalysis(): RtpAnalyseView | null {
    return this.analyses[this.analyseTab] || this.analyses[0] || null;
  }
  onCheck() {
    this.cdr.detectChanges();
  }
  streamToken(row: any) {
    return rtpStreamToken(row);
  }
  waveColor(index: number) {
    return rtpWaveColor(index);
  }
  formatTime(value: any): string {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return value == null ? '' : String(value);
    }
    return n.toFixed(3);
  }
  async loadCaptureBytes(): Promise<ArrayBuffer> {
    if (this.captureBytes) {
      return this.captureBytes;
    }
    this.progressMessage.push(`Reading RTP from ${this.captureFile}`);
    this.cdr.detectChanges();
    this.captureBytes = await this.webSharkDataService.getCaptureBytes();
    return this.captureBytes;
  }
  async ngOnInit() {
    this.isReady = true;
    const tokens = this.webSharkDataService.takePendingRtpPlay();
    if (tokens?.length) {
      await this.applyPending(tokens);
    }
    this.cdr.detectChanges();
  }
  private async applyPending(tokens: string[]) {
    const wanted = new Set(tokens);
    this.streams.forEach((s) => {
      s.__selected = wanted.has(rtpStreamToken(s));
    });
    this.cdr.detectChanges();
    await this.playSelected();
  }
  onWaveReady(rec: any, player: any) {
    rec.player = player;
    this.cdr.detectChanges();
  }
  playPauseAll() {
    const live = this.players.filter((p) => p.player);
    if (!live.length) {
      return;
    }
    const master = live[0].player;
    const playing = !!master.isPlaying?.();
    const t = master.getCurrentTime?.() || 0;
    live.forEach((p) => {
      try {
        if (typeof p.player.setTime === 'function') {
          p.player.setTime(t);
        } else if (p.player.getDuration?.()) {
          p.player.seekTo(t / p.player.getDuration());
        }
        playing ? p.player.pause() : p.player.play();
      } catch (err) {
        console.error(err);
      }
    });
    this.cdr.detectChanges();
  }
  removePlayer(token: string) {
    const rec = this.players.find((p) => p.token === token);
    try {
      rec?.player?.destroy();
    } catch (err) {}
    this.players = this.players.filter((p) => p.token !== token);
    this.cdr.detectChanges();
  }
  private destroyPlayers() {
    this.players.forEach((rec) => {
      try {
        rec.player?.destroy();
      } catch (err) {}
    });
    this.players = [];
  }
  async playSelected() {
    await this.openMany(this.selectedStreams);
  }
  findReverse() {
    const row = this.streams.find((s) => s.__selected) || this.streams.find((s) => this.streamToken(s) === this.activeToken);
    if (!row) {
      this.analyzeNote = 'Select an RTP stream first';
      this.cdr.detectChanges();
      return;
    }
    const reverse = findReverseRtp(this.streams, row);
    row.__selected = true;
    if (reverse) {
      reverse.__selected = true;
      this.activeToken = this.streamToken(reverse);
      this.analyzeNote = reverse ? 'Reverse stream selected' : 'No reverse stream found';
    } else {
      this.analyzeNote = 'No reverse stream found';
    }
    this.cdr.detectChanges();
  }
  closeAnalyse() {
    this.analyses = [];
    this.analyzeNote = '';
    this.selectedPacket = 0;
    this.cdr.detectChanges();
  }
  async analyzeSelected() {
    if (!this.selectedCount) {
      const row = this.streams.find((s) => this.streamToken(s) === this.activeToken) || this.streams[0];
      if (row) {
        row.__selected = true;
      }
    }
    this.findReverse();
    const selected = this.selectedStreams;
    if (!selected.length) {
      return;
    }
    this.busy = true;
    this.errorMessage = '';
    this.analyzeNote = '';
    this.cdr.detectChanges();
    try {
      let buffer: ArrayBuffer | null = null;
      try {
        buffer = await this.loadCaptureBytes();
      } catch (err) {
        buffer = null;
      }
      const views: RtpAnalyseView[] = [];
      for (const stream of selected) {
        views.push(await this.analyseStream(stream, buffer));
      }
      this.analyses = views.map((view, index) => ({
        ...view,
        tab: rtpStreamTabLabel(index, view.ssrc)
      }));
      this.analyseTab = 0;
      this.analyzeNote = '';
    } catch (err: any) {
      console.error(err);
      this.errorMessage = err?.message || String(err);
    } finally {
      this.busy = false;
      this.cdr.detectChanges();
    }
  }
  private async analyseStream(stream: any, buffer: ArrayBuffer | null): Promise<RtpAnalyseView> {
    const clock = rtpClockRate(undefined, stream?.payload);
    let tapItems: any[] = [];
    try {
      const tap = await this.webSharkDataService.getRTPStreamTap(stream);
      tapItems = tap?.taps?.[0]?.items || [];
    } catch (err) {
      tapItems = [];
    }
    let result = tapItems.length ? analyseRtpItems(tapItems, clock) : analyseRtpPackets([], clock);
    if (buffer) {
      const packets = rtpPacketsForStream(buffer, { ...stream, items: tapItems });
      if (packets.length) {
        result = analyseRtpPackets(packets, clock);
      }
    }
    return {
      token: rtpStreamToken(stream),
      tab: '',
      src: `${stream?.saddr || ''}:${stream?.sport || 0}`,
      dst: `${stream?.daddr || ''}:${stream?.dport || 0}`,
      ssrc: rtpSsrcLabel(stream?.ssrc),
      payload: stream?.payload || '',
      t0: result.items[0]?.t ?? 0,
      items: result.items,
      stats: result.stats
    };
  }
  setAnalyseTab(index: number) {
    this.analyseTab = index;
    this.cdr.detectChanges();
  }
  relTime(item: RtpAnalyseItem, origin: number): string {
    return rtpRelativeTime(item?.t, origin);
  }
  formatBw(item: RtpAnalyseItem): string {
    const bw = Number(item?.bw);
    if (!Number.isFinite(bw) || bw <= 0 || (Number(item?.d) < 1 && bw > 1000)) {
      return '—';
    }
    return bw.toFixed(1);
  }
  statusWarn(status: string): boolean {
    const s = String(status || '');
    return s.indexOf('Wrong') !== -1 || s.indexOf('Duplicate') !== -1;
  }
  sparkPoints(items: RtpAnalyseItem[], key: 'j' | 'd'): string {
    const list = items || [];
    if (!list.length) {
      return '';
    }
    const vals = list.map((it) => Number(it[key]) || 0);
    const max = Math.max(...vals, 0.001);
    return vals.map((v, i) => {
      const x = list.length === 1 ? 0 : (i / (list.length - 1)) * 300;
      const y = 38 - (v / max) * 36;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  }
  onAnalysePacket(item: RtpAnalyseItem) {
    const frame = Number(item?.f);
    this.selectedPacket = frame;
    if (Number.isFinite(frame) && frame > 0) {
      this.webSharkDataService.selectFrame(frame);
    }
    this.cdr.detectChanges();
  }
  async rowClick({ row }: any) {
    if (!row) {
      return;
    }
    row.__selected = true;
    await this.openMany(this.selectedStreams.length ? this.selectedStreams : [row]);
  }
  private async openMany(rows: any[]) {
    if (this.opening || !rows?.length) {
      return;
    }
    this.opening = true;
    this.busy = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    try {
      const byToken = new Map<string, any>();
      for (const rec of this.players) {
        const existing = this.streams.find((s) => rtpStreamToken(s) === rec.token);
        if (existing) {
          byToken.set(rec.token, existing);
        }
      }
      for (const row of rows) {
        byToken.set(rtpStreamToken(row), row);
      }
      const all = Array.from(byToken.values());
      const clips = [];
      for (const row of all) {
        const codec = ffmpegCodecForPayload(row?.payload);
        if (!codec) {
          throw new Error(`RTP stream ${rtpStreamToken(row)} is not an audio codec`);
        }
        this.progressMessage.push(`Extracting RTP ${row.ssrc} (${codec})`);
        this.cdr.detectChanges();
        const clip = await this.webSharkDataService.getRtpAudioClip(row, codec);
        clips.push({ row, codec, clip });
      }
      const sessionStart = sessionStartForClips(clips.map((c) => c.clip));
      const realign = this.lastSessionStart != null && Math.abs(this.lastSessionStart - sessionStart) > 0.001;
      if (realign) {
        this.destroyPlayers();
      }
      this.lastSessionStart = sessionStart;
      for (const item of clips) {
        await this.ensurePlayer(item.row, item.codec, item.clip, sessionStart);
      }
    } catch (err: any) {
      console.error(err);
      this.errorMessage = err?.message || String(err);
    } finally {
      this.opening = false;
      this.busy = false;
      this.cdr.detectChanges();
    }
  }
  private async ensurePlayer(row: any, codec: string, clip: RtpAudioClip, sessionStart: number) {
    const token = rtpStreamToken(row);
    this.activeToken = token;
    const cacheKey = `${token}@${sessionStart.toFixed(3)}`;
    if (this.players.find((p) => p.token === token && p.cacheKey === cacheKey)) {
      this.webSharkDataService.setView('rtp', { stream: token });
      return;
    }
    if (this.players.find((p) => p.token === token)) {
      this.removePlayer(token);
    }
    this.progressMessage = [`Opening RTP stream ${row.ssrc}`];
    this.cdr.detectChanges();
    let blobUrl = this.blobUrlCache.get(cacheKey);
    if (!blobUrl) {
      const blob = blobFromPaddedClip(clip, sessionStart, codec);
      if (!blob) {
        throw new Error(`No RTP payload bytes for ${token}`);
      }
      this.progressMessage.push(`FFmpeg:: converting ${row.ssrc} (${codec}) to audio`);
      this.cdr.detectChanges();
      const transcode = getTranscode();
      const safe = cacheKey.replace(/[^a-zA-Z0-9]+/g, '-');
      const sampleLen = clip.bytes.byteLength;
      let lastErr: any;
      for (const tryCodec of ffmpegCodecFallbacks(codec, sampleLen)) {
        try {
          blobUrl = await transcode(blob, tryCodec, `audio-${safe}.wav`);
          if (blobUrl) {
            break;
          }
        } catch (err) {
          lastErr = err;
        }
      }
      if (!blobUrl) {
        throw new Error(lastErr?.message || `FFmpeg returned no audio for ${token}`);
      }
      this.blobUrlCache.set(cacheKey, blobUrl);
    }
    this.players = [...this.players, {
      token,
      cacheKey,
      id: `player-${token}`,
      mp3: blobUrl,
      noData: !blobUrl,
      label: rtpStreamLabel(row),
      color: rtpWaveColor(this.players.length),
      player: null,
    }];
    this.webSharkDataService.setView('rtp', { stream: token });
    this.cdr.detectChanges();
  }
}