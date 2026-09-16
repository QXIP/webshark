import { hash } from '@app/helper/functions';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { applyViewStateToUrl, parseViewState, rtpStreamToken, WebsharkViewState } from '@app/helper/share-url';
import { captureFileUrl, followToSharkd, staticTapInfo } from '@app/helper/wiregasm-adapt';
import { bytesFromFrameDump, followChunksFromFrames } from '@app/helper/follow-extract';
import { buildClassicPcap, filteredPcapFilename, triggerBrowserDownload } from '@app/helper/pcap-export';
import { followFromFrame, followHintFromTree, normalizeFollowProto } from '@app/helper/wireshark-views';
import { rtpAnalyseFromStream, rtpStreamsTapFromGroups, groupRtpStreams, enrichRtpPorts } from '@app/helper/rtp-from-frames';
import { groupVoipCalls, voipCallsTap } from '@app/helper/voip-calls';
import { bytesFromCaptureSource, copyToArrayBuffer } from '@app/helper/capture-bytes';
import { rtpAudioForStream, rtpAudioFromDump, RtpAudioClip } from '@app/helper/rtp-extract';
import { ffmpegCodecForPayload } from '@app/helper/rtp-codec';
import { WiregasmClient } from './wiregasm-client';

interface HashBuffer {
  [key: string]: any;
}

class StaticData {
  static captureFile: string = '';
  static filter: string = '';
  static frame: number | undefined;
  static view: string = '';
  static stream: string = '';
  static follow: string = '';
  static lastFollow: { proto: string; filter: string } | null = null;
}

class BufferData {
  static data: HashBuffer = {};
  static clear() {
    BufferData.data = {};
  }
}

@Injectable({
  providedIn: 'root'
})
export class WebSharkDataService {

  private url = `${environment.apiUrl}json`;
  private urlUpload = `${environment.apiUrl}upload`;
  private loadedName = '';
  private loadingName = '';
  private loadTask: Promise<void> | null = null;
  private rtpCache: any[] | null = null;
  private voipCache: any[] | null = null;
  private pendingRtpPlay = new BehaviorSubject<string[] | null>(null);
  public pendingRtpPlay$ = this.pendingRtpPlay.asObservable();
  private localCaptures = new Map<string, File | Uint8Array>();

  private behavior = new BehaviorSubject({})
  public updates: Observable<any>;

  constructor(
    private http: HttpClient,
    private wiregasm: WiregasmClient
  ) {
    const state = parseViewState(typeof location !== 'undefined' ? location.search : '');
    if (state.filter) {
      StaticData.filter = state.filter;
    }
    if (state.frame) {
      StaticData.frame = state.frame;
    }
    if (state.view) {
      StaticData.view = state.view;
    }
    if (state.stream) {
      StaticData.stream = state.stream;
    }
    if (state.follow) {
      StaticData.follow = state.follow;
    }
    this.updates = this.behavior.asObservable();
    if (state.capture && !environment.clientOnly) {
      StaticData.captureFile = state.capture;
      try {
        this.syncUrl();
      } catch (err) {
        console.error(err);
      }
      this.behavior.next({ cm: 'url' });
    }
  }

  private currentState(): WebsharkViewState {
    const embed = parseViewState(typeof location !== 'undefined' ? location.search : '').embed;
    return {
      capture: StaticData.captureFile || undefined,
      frame: StaticData.frame,
      filter: StaticData.filter || undefined,
      view: StaticData.view || undefined,
      stream: StaticData.stream || undefined,
      follow: StaticData.follow || undefined,
      embed
    };
  }

  private syncUrl() {
    if (typeof location === 'undefined' || typeof history === 'undefined') {
      return;
    }
    applyViewStateToUrl(this.currentState());
  }

  public setFilter(filter: string) {
    StaticData.filter = filter;
    this.syncUrl();
    BufferData.clear();
    this.rtpCache = null;
    this.voipCache = null;
    this.behavior.next({ cm: 'filter' });
  }
  public getFilter(): string {
    return StaticData.filter;
  }
  public setCaptureFile(fileName: string) {
    StaticData.captureFile = fileName;
    BufferData.clear();
    this.loadedName = '';
    this.rtpCache = null;
    this.voipCache = null;
    this.syncUrl();
    this.behavior.next({ cm: 'capture' });
  }

  public closeCapture() {
    StaticData.captureFile = '';
    StaticData.filter = '';
    StaticData.frame = undefined;
    StaticData.view = '';
    StaticData.stream = '';
    StaticData.follow = '';
    StaticData.lastFollow = null;
    BufferData.clear();
    this.loadedName = '';
    this.loadingName = '';
    this.loadTask = null;
    this.rtpCache = null;
    this.voipCache = null;
    this.localCaptures.clear();
    this.syncUrl();
    this.behavior.next({ cm: 'capture' });
  }
  public setView(view: string, extra: Partial<WebsharkViewState> = {}) {
    StaticData.view = view;
    if (extra.stream != null) {
      StaticData.stream = extra.stream;
    }
    if (extra.follow != null) {
      StaticData.follow = extra.follow;
    }
    if (extra.frame != null) {
      StaticData.frame = extra.frame;
    }
    this.syncUrl();
    this.behavior.next({ cm: 'view' });
  }

  public isClientOnly(): boolean {
    return !!environment.clientOnly;
  }

  public isCaptureLoaded(): boolean {
    return !!this.loadedName && this.loadedName === this.getCapture();
  }

  public hasLocalCapture(name = this.getCapture()): boolean {
    return !!name && this.localCaptures.has(name);
  }

  public getCapture(): string {
    return StaticData.captureFile;
  }
  public getFrame(): number | undefined {
    return StaticData.frame;
  }
  public getView(): string {
    return StaticData.view;
  }
  public getStream(): string {
    return StaticData.stream;
  }
  public getFollowHint(): string {
    return StaticData.follow;
  }
  public getLastFollow() {
    return StaticData.lastFollow;
  }
  public setLastFollow(fol: { proto: string; filter: string } | null) {
    StaticData.lastFollow = fol;
  }

  async resolveFollow(link = ''): Promise<{ proto: string; filter: string }> {
    const prefer = String(link || '').includes(':') ? String(link).split(':')[1] : '';
    let hint = this.getLastFollow();
    if (!hint?.filter) {
      const frameId = this.getFrame();
      if (frameId) {
        const frame = await this.getFrameData(frameId);
        hint = followFromFrame(frame?.fol, prefer)
          || followFromFrame(frame?.fol)
          || followHintFromTree(frame?.tree || []);
        if (hint) {
          this.setLastFollow(hint);
        }
      }
    }
    if (hint?.filter) {
      return { proto: normalizeFollowProto(hint.proto), filter: hint.filter };
    }
    throw { err: 1, errstr: 'Select a TCP, UDP, TLS, or HTTP packet, then Follow Stream.' };
  }
  public isEmbed(): boolean {
    return !!parseViewState(typeof location !== 'undefined' ? location.search : '').embed;
  }
  public clearBuffer() {
    BufferData.clear();
    this.loadedName = '';
    this.rtpCache = null;
    this.voipCache = null;
  }

  public setPendingRtpPlay(tokens: string[]) {
    this.pendingRtpPlay.next(tokens);
  }

  public takePendingRtpPlay(): string[] | null {
    const tokens = this.pendingRtpPlay.value;
    this.pendingRtpPlay.next(null);
    return tokens;
  }

  public getVoipCall(id: string): any | null {
    return (this.voipCache || []).find((c) => c.id === id) || null;
  }

  private getBufferGate<T>(url: string, bypassCache = false): Observable<any> {
    const bufferIndex = hash(url);
    if (!bypassCache && BufferData.data[bufferIndex]) {
      return new Observable(observer => {
        observer.next(BufferData.data[bufferIndex]);
        observer.complete();
      });
    }
    return this.http.get<T>(url).pipe(map(data => {
      if (!bypassCache) {
        BufferData.data[bufferIndex] = data;
      }
      return data;
    }));
  }

  getBLOB(url: string): Observable<any> {
    return this.http.get(url, { responseType: 'blob' });
  }

  private async ensureLoaded(force = false): Promise<void> {
    const name = this.getCapture();
    if (!name) {
      throw { error: 'Capture file is unset!' };
    }
    if (!force && this.loadedName === name) {
      return;
    }
    if (this.loadTask && this.loadingName === name) {
      await this.loadTask;
      if (!force || this.loadedName === name) {
        return;
      }
    }
    this.loadingName = name;
    this.loadTask = this.loadCaptureBytes(name).then(() => {
      if (this.loadingName !== name) {
        return;
      }
      this.loadedName = name;
      this.rtpCache = null;
      this.voipCache = null;
    }).finally(() => {
      if (this.loadingName === name) {
        this.loadTask = null;
      }
    });
    await this.loadTask;
    if (this.loadedName === name) {
      this.behavior.next({ cm: 'loaded' });
    }
  }

  private async loadCaptureBytes(name: string): Promise<any> {
    const local = this.localCaptures.get(name);
    if (local) {
      const data = local instanceof Uint8Array ? local : new Uint8Array(await local.arrayBuffer());
      return this.wiregasm.load(name, { data });
    }
    if (environment.clientOnly) {
      throw { err: 1, errstr: 'Open a PCAP from your computer to analyze it in the browser.' };
    }
    return this.wiregasm.load(name, { url: captureFileUrl(name) });
  }

  async openLocalCapture(file: File): Promise<void> {
    const name = String(file?.name || 'capture.pcap').replace(/^.*[/\\]/, '') || 'capture.pcap';
    this.localCaptures.clear();
    this.localCaptures.set(name, file);
    this.setCaptureFile(name);
  }

  getInfo(): Promise<any> {
    return Promise.resolve(staticTapInfo());
  }

  getFiles(dir: string = ''): Promise<any> {
    if (environment.clientOnly) {
      return Promise.resolve({ files: [], pwd: '.' });
    }
    const extra = dir ? `&dir=${encodeURIComponent('/' + dir)}` : '';
    return this.getBufferGate<any>(`${this.url}?method=files${extra}`).toPromise();
  }

  public selectFrame(frameId: number) {
    const n = Number(frameId);
    if (!Number.isFinite(n) || n <= 0) {
      return;
    }
    StaticData.frame = n;
    this.syncUrl();
    this.behavior.next({ cm: 'frame' });
  }

  async getFrames(limit = 120, skip = 0, bypassCache = false): Promise<any> {
    await this.ensureLoaded(bypassCache);
    return this.wiregasm.frames(this.getFilter(), skip, limit === 0 ? 0 : limit);
  }

  async framesWithFilter(filter: string, limit = 400): Promise<any[]> {
    await this.ensureLoaded();
    return this.wiregasm.frames(filter || '', 0, limit);
  }

  async getFrameData(frameId: number): Promise<any> {
    StaticData.frame = frameId;
    this.syncUrl();
    await this.ensureLoaded();
    return this.wiregasm.frame(frameId);
  }

  async getTapJson(tapID: string): Promise<any> {
    await this.ensureLoaded();
    if (tapID === 'rtp-streams') {
      const frames = await this.wiregasm.frames('rtp', 0, 0);
      const streams = groupRtpStreams(frames);
      await enrichRtpPorts(streams, (n) => this.wiregasm.frame(n));
      this.rtpCache = streams;
      return rtpStreamsTapFromGroups(streams);
    }
    if (tapID === 'voip-calls') {
      if (!this.rtpCache) {
        const rtpFrames = await this.wiregasm.frames('rtp', 0, 0);
        this.rtpCache = groupRtpStreams(rtpFrames);
        await enrichRtpPorts(this.rtpCache, (n) => this.wiregasm.frame(n));
      }
      let sipFrames: any[] = [];
      try {
        sipFrames = await this.wiregasm.frames('sip', 0, 0) || [];
      } catch (err) {
        sipFrames = [];
      }
      this.voipCache = groupVoipCalls(sipFrames, this.rtpCache);
      return voipCallsTap(this.voipCache);
    }
    if (tapID && tapID.indexOf('rtp-analyse:') === 0) {
      const token = tapID.slice('rtp-analyse:'.length);
      if (!this.rtpCache) {
        const frames = await this.wiregasm.frames('rtp', 0, 0);
        this.rtpCache = groupRtpStreams(frames);
        await enrichRtpPorts(this.rtpCache, (n) => this.wiregasm.frame(n));
      }
      const stream = (this.rtpCache || []).find((s: any) => rtpStreamToken(s) === token);
      return rtpAnalyseFromStream(stream, tapID);
    }
    const taps: Record<string, string> = { tap0: tapID };
    if (this.getFilter()) {
      taps['filter0'] = this.getFilter();
    }
    return this.wiregasm.tap(taps);
  }

  captureDownloadUrl(): string {
    return captureFileUrl(this.getCapture());
  }

  async getCaptureBytes(): Promise<ArrayBuffer> {
    const name = this.getCapture();
    if (!name) {
      throw new Error('No capture loaded');
    }
    const local = this.localCaptures.get(name);
    if (local) {
      return bytesFromCaptureSource(local);
    }
    try {
      return await this.captureBytesFromSession();
    } catch {
      /* fall through to origin storage when a backend is present */
    }
    if (!environment.clientOnly) {
      const url = this.captureDownloadUrl();
      try {
        const res = await fetch(url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          this.localCaptures.set(name, new Uint8Array(buf));
          return buf;
        }
      } catch {
        /* session already tried */
      }
    }
    throw new Error('Could not read capture bytes from the WASM session');
  }

  private async captureBytesFromSession(): Promise<ArrayBuffer> {
    await this.ensureLoaded();
    const res = await this.wiregasm.readCapture();
    const data = res?.data ?? res;
    if (data instanceof ArrayBuffer && data.byteLength > 24) {
      this.localCaptures.set(this.getCapture(), new Uint8Array(data));
      return data;
    }
    if (ArrayBuffer.isView(data) && data.byteLength > 24) {
      const view = data as Uint8Array;
      const copy = copyToArrayBuffer(view);
      this.localCaptures.set(this.getCapture(), new Uint8Array(copy));
      return copy;
    }
    throw new Error('Could not read capture bytes from the WASM session');
  }

  async getRtpAudioClip(
    row: { saddr?: string; sport?: number; daddr?: string; dport?: number; ssrc?: string | number; payload?: string },
    codec?: string
  ): Promise<RtpAudioClip> {
    const audioCodec = codec || ffmpegCodecForPayload(row?.payload || '');
    if (!audioCodec) {
      throw new Error('RTP stream is not an audio codec');
    }
    try {
      const buffer = await this.getCaptureBytes();
      const fromFile = rtpAudioForStream(buffer, row, audioCodec);
      if (fromFile?.bytes?.byteLength) {
        return fromFile;
      }
    } catch {
      /* fall through to dissected session frames */
    }
    await this.ensureLoaded();
    const dump = await this.wiregasm.rtpDump(row);
    const fromSession = rtpAudioFromDump(dump?.packets || [], row, audioCodec);
    if (fromSession?.bytes?.byteLength) {
      return fromSession;
    }
    throw new Error(`No RTP payload bytes for ${rtpStreamToken(row as any)}`);
  }

  getMp3LinkByRowData(_rtpData: any): string {
    return this.captureDownloadUrl();
  }

  getRTPStreamTap(rtpData: any): Promise<any> {
    const tap0 = 'rtp-analyse:' + rtpStreamToken(rtpData);
    return this.getTapJson(tap0);
  }

  async completeFilter(field: string): Promise<any> {
    await this.ensureLoaded();
    return this.wiregasm.complete(field);
  }

  async checkFilter(filter: string): Promise<any> {
    await this.ensureLoaded();
    return this.wiregasm.check(filter);
  }

  async followStream(follow: string, filter: string): Promise<any> {
    await this.ensureLoaded();
    const proto = normalizeFollowProto(follow);
    let native: any = null;
    let nativeErr: any = null;
    try {
      native = await this.wiregasm.follow(proto, filter);
    } catch (err) {
      nativeErr = err;
      if (proto === 'SIP') {
        try {
          native = await this.wiregasm.follow('UDP', filter);
          nativeErr = null;
        } catch (err2) {
          nativeErr = err2;
        }
      }
    }
    if (native?.payload?.length) {
      return native;
    }
    if (filter) {
      const rebuilt = await this.rebuildFollow(filter);
      if (rebuilt?.payload?.length) {
        return rebuilt;
      }
    }
    if (native) {
      return native;
    }
    throw nativeErr || { err: 1, errstr: 'follow failed' };
  }

  private async rebuildFollow(filter: string): Promise<any> {
    const rows = await this.wiregasm.frames(filter, 0, 400);
    const detailed: Array<{ bytes: any; num: number; c?: any[] }> = [];
    for (const row of rows || []) {
      const num = Number(row.num || row.c?.[0]);
      if (!num) {
        continue;
      }
      const frame = await this.wiregasm.frame(num);
      detailed.push({ bytes: frame?.bytes, num, c: row.c });
      if (detailed.length >= 400) {
        break;
      }
    }
    const chunks = followChunksFromFrames(detailed);
    return followToSharkd({
      shost: chunks.shost,
      sport: chunks.sport,
      chost: chunks.dhost,
      cport: chunks.dport,
      payloads: chunks.payload.map((p) => ({ number: p.n, data: p.d, server: p.s }))
    });
  }

  async getIograph(graph0 = 'packets', interval = 1, filter = ''): Promise<any> {
    await this.ensureLoaded();
    const params: Record<string, string | number> = { graph0, interval: String(interval) };
    params['filter0'] = filter || this.getFilter() || '';
    return this.wiregasm.iograph(params);
  }

  downloadObject(token: string): string {
    if (!token || token === 'self') {
      return this.captureDownloadUrl();
    }
    return this.captureDownloadUrl();
  }

  async downloadToken(token: string): Promise<string> {
    if (!token || token === 'self') {
      return this.captureDownloadUrl();
    }
    await this.ensureLoaded();
    const res = await this.wiregasm.download(token);
    const pack = res?.download || res;
    const raw = pack?.data;
    if (!raw) {
      return this.captureDownloadUrl();
    }
    const bytes = typeof raw === 'string' ? Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)) : raw;
    const blob = new Blob([bytes], { type: pack?.mime || 'application/octet-stream' });
    return URL.createObjectURL(blob);
  }

  downloadCaptureFile() {
    const name = this.getCapture();
    if (!name || typeof document === 'undefined') {
      return;
    }
    const local = this.localCaptures.get(name);
    if (local instanceof File) {
      triggerBrowserDownload(local, name, local.type || 'application/octet-stream');
      return;
    }
    if (local instanceof Uint8Array) {
      triggerBrowserDownload(local, name);
      return;
    }
    if (environment.clientOnly) {
      return;
    }
    const a = document.createElement('a');
    a.href = this.captureDownloadUrl();
    a.download = name.split(/[/\\]/).pop() || name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 0);
  }

  async exportSpecifiedPackets(): Promise<{ filename: string; count: number }> {
    await this.ensureLoaded();
    const filter = this.getFilter() || '';
    const res = await this.wiregasm.exportPcap(filter);
    const packets = (res?.packets || []).map((p: any) => ({
      t: Number(p.t) || 0,
      bytes: bytesFromFrameDump(p.data)
    }));
    const pcap = buildClassicPcap(packets);
    if (pcap.byteLength <= 24) {
      throw { err: 1, errstr: 'No packets matched the current filter' };
    }
    const filename = filteredPcapFilename(this.getCapture(), filter);
    triggerBrowserDownload(pcap, filename);
    return { filename, count: packets.filter((p: any) => p.bytes?.byteLength).length };
  }

  postFile(fileToUpload: File, isDataTimeNow: any): Observable<any> {
    if (environment.clientOnly) {
      return from(this.openLocalCapture(fileToUpload));
    }
    const formData: FormData = new FormData();
    formData.append('fileKey', fileToUpload, fileToUpload.name);
    const url = isDataTimeNow ? this.urlUpload + '/now' : this.urlUpload;

    return this.http.post(url, formData).pipe(map(() => {
      this.localCaptures.set(fileToUpload.name, fileToUpload);
      this.setCaptureFile(fileToUpload.name);
      this.behavior.next({ cm: 'uploaded' });
    }));
  }
}
