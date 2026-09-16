import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import WaveSurfer from 'wavesurfer.js';

@Component({
    selector: 'rtp-waveform',
    template: `
    <div class="wave-label" [style.color]="color">{{ label }}</div>
    <div #host class="wave-host"></div>
  `,
    styles: [`
    :host { display: block; width: 100%; }
    .wave-label { font-size: 11px; padding: 0 0.2rem 0.05rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wave-host { width: 100%; height: 40px; min-height: 40px; }
  `],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class RtpWaveformComponent implements AfterViewInit, OnDestroy {
  @Input() url = '';
  @Input() label = '';
  @Input() color = '#4a90d9';
  @Output() ready = new EventEmitter<any>();
  @ViewChild('host') host?: ElementRef<HTMLDivElement>;
  player: any;
  private tries = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    requestAnimationFrame(() => this.attach());
  }

  private attach() {
    if (this.player || !this.url) {
      return;
    }
    const el = this.host?.nativeElement;
    if (!el || el.clientWidth < 8) {
      if (this.tries++ < 40) {
        requestAnimationFrame(() => this.attach());
      }
      return;
    }
    try {
      this.player = WaveSurfer.create({
        container: el,
        url: this.url,
        height: 40,
        normalize: true,
        waveColor: this.color,
        progressColor: '#1b5e20',
        cursorColor: '#333',
        barWidth: 2,
        barGap: 1,
      });
      this.player.on('ready', () => {
        this.ready.emit(this.player);
        this.cdr.detectChanges();
      });
      this.player.on('audioprocess', () => this.cdr.detectChanges());
      this.player.on('play', () => this.cdr.detectChanges());
      this.player.on('pause', () => this.cdr.detectChanges());
    } catch (err) {
      console.error(err);
    }
  }

  ngOnDestroy() {
    try {
      this.player?.destroy();
    } catch (err) {}
  }
}
