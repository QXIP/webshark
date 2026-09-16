import { MessageDetailsService } from './message-details.service';
import { Functions } from '@app/helper/functions';
import {
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild,
  Output,
  EventEmitter,
  HostListener,
  AfterViewInit,
  Input,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';

@Component({
    selector: 'modal-resizable',
    templateUrl: './modal-resizable.component.html',
    styleUrls: ['./modal-resizable.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ModalResizableComponent implements OnInit, AfterViewInit, OnDestroy {
  static ZIndex = 12;
  _content: any;
  _arrowMetaData: any = null;
  _noLayout = false;
  _isNonWindow: boolean = false;
  @ViewChild('layerZIndex', { static: false }) layerZIndex: any;
  @ViewChild('containerWindow', { static: false }) containerWindow: any;
  @ViewChild('inWindow', { static: false }) inWindow: any;
  @ViewChild('outWindow', { static: false }) outWindow: any;

  @Input()
  set isNonWindow(bool: boolean) {
    this._isNonWindow = bool;
  }
  get isNonWindow(): boolean {
    return this._isNonWindow;
  }
  @Input() sharedUrl: string = '';
  @Input() objectData: any;
  @Input() title: string = '';
  @Input() headerColor: string = '';
  @Input() width = Math.round((typeof document !== 'undefined' ? document.body.offsetWidth : 1200) * 0.94) || 1200;
  @Input() height = Math.round((typeof document !== 'undefined' ? document.body.offsetHeight : 900) * 0.9) || 900;
  @Input() minWidth = 200;
  @Input() minHeight = 200;
  @Input() mouseEventData: any = null;
  @Input() isBrowserWindow = false;
  @Input() startZIndex = 0;
  @Input() isOutsideButton = false;
  @Input() set arrowMetaData(val: any) {
    this._arrowMetaData = val;
  }
  get arrowMetaData(): any {
    return this._arrowMetaData;
  }
  @Output() close: EventEmitter<any> = new EventEmitter();
  @Output() browserWindow: EventEmitter<any> = new EventEmitter();
  __isBrowserWindow = false;
  isFullPage = false;

  constructor(
    private messageDetailsService: MessageDetailsService,
    private cdr: ChangeDetectorRef
  ) {
    this.cdr.detach();
  }

  ngOnInit() {
    this.cdr.detectChanges();
    setInterval(() => {
      Functions.emitWindowResize();
      this.cdr.detectChanges();
    }, 500);
  }

  onFullPage() {
    this.isFullPage = !this.isFullPage;
    setTimeout(() => {
      Functions.emitWindowResize();
      this.cdr.detectChanges();
    }, 35);
  }

  @HostListener('window:resize')
  onViewportResize() {
    if (!this.containerWindow?.nativeElement) {
      return;
    }
    const maxWidth = window.innerWidth * 0.96;
    const maxHeight = window.innerHeight * 0.92;
    const s = this.containerWindow.nativeElement.style;
    s.maxWidth = maxWidth + 'px';
    s.maxHeight = maxHeight + 'px';
    Functions.emitWindowResize();
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape', ['$event']) onKeydownHandler(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.onClose();
  }
  ngAfterViewInit() {
    /* attache window to native document.body */
    document.body.appendChild(this.layerZIndex.nativeElement);
    const { min, ceil } = Math;
    const maxWidth = window.innerWidth * 0.96;
    const maxHeight = window.innerHeight * 0.92;
    this.minWidth = ceil(min(this.minWidth, maxWidth));
    this.minHeight = ceil(min(this.minHeight, maxHeight));
    const s = this.containerWindow.nativeElement.style;
    s.maxWidth = maxWidth + 'px';
    s.maxHeight = maxHeight + 'px';

    if (this.mouseEventData) {
      const mouseOffset = 50; // 50px inside window
      this.setPositionWindow({
        x: ceil(this.mouseEventData.clientX - mouseOffset),
        y: ceil(this.mouseEventData.clientY - mouseOffset)
      });
      this.mouseEventData.focus = () => this.onFocus();
    }
    this.onFocus();
    if (this.isBrowserWindow) {
      this.newWindow();
    }
  }
  setPositionWindow({ x = 0, y = 0 }) {
    const { min, ceil } = Math;
    const el = this.containerWindow.nativeElement;
    const positionLocal = this.getTranslatePosition(el);
    const positionGlobal = el.getBoundingClientRect();
    x = ceil(min(window.innerWidth - positionGlobal.width, x));
    y = ceil(min(window.innerHeight - positionGlobal.height, y));
    positionLocal.x -= positionGlobal.left;
    positionLocal.y -= positionGlobal.top;
    positionLocal.x = ceil(positionLocal.x + x);
    positionLocal.y = ceil(positionLocal.y + y);

    el.style.transform = `translate3d(${positionLocal.x}px, ${positionLocal.y}px, 0px)`;
  }
  onClose() {
    this.close.emit();

  }

  onFocus() {
    this.layerZIndex.nativeElement.style.zIndex = '' + ((ModalResizableComponent.ZIndex += 2) + this.startZIndex);
  }

  onResize(event: any, controlName: string) {
    const { min, ceil } = Math;
    this._noLayout = false;
    this.setMouseLayer(true);
    const x0 = ceil(event.clientX);
    const y0 = ceil(event.clientY);
    const winWidth = ceil(this.containerWindow.nativeElement.offsetWidth);
    const winHeight = ceil(this.containerWindow.nativeElement.offsetHeight);
    const winPosition = this.getTranslatePosition(this.containerWindow.nativeElement);

    this.containerWindow.nativeElement.classList.add('animation-off');
    const vector: any = {
      left: { h: -1, v: 0 },
      right: { h: 1, v: 0 },
      bottom: { h: 0, v: 1 },
      top: { h: 0, v: -1 },
      tl: { h: -1, v: -1 },
      tr: { h: 1, v: -1 },
      bl: { h: -1, v: 1 },
      br: { h: 1, v: 1 },
    };

    const size = { w: 0, h: 0 },
      vh = vector[controlName].h,
      vv = vector[controlName].v,
      position = { x: winPosition.x, y: winPosition.y };

    // window.document.body.classList.add('no-selected-text');
    window.document.body.onmousemove = evt => {
      if (vh !== 0) {
        const cX = ceil(Math[(vh > 0) ? 'max' : 'min'](x0 + vh * (this.minWidth - winWidth), evt.clientX));
        size.w = ceil(winWidth + vh * (cX - x0));
        position.x = ceil(winPosition.x + (cX - x0) / 2);
        this.containerWindow.nativeElement.style.width = size.w + 'px';
      }
      if (vv !== 0) {
        const cY = ceil(Math[(vv > 0) ? 'max' : 'min'](y0 + vv * (this.minHeight - winHeight), evt.clientY));
        size.h = ceil(winHeight + vv * (cY - y0));
        position.y = ceil(winPosition.y + (cY - y0) / 2);
        this.containerWindow.nativeElement.style.height = size.h + 'px';
      }

      this.containerWindow.nativeElement.style.transform = `translate3d(${position.x}px, ${position.y}px, 0px)`;

      Functions.emitWindowResize();
    };

    window.document.body.onmouseleave = window.document.body.onmouseup = () => {
      this.containerWindow.nativeElement.classList.remove('animation-off');
      this.setMouseLayer(false);
      Functions.emitWindowResize();
      window.document.body.onmouseleave = null;
      window.document.body.onmousemove = null;
      window.document.body.onmouseup = null;
    };
  }
  afterResize() {
    this._noLayout = true;
    Functions.emitWindowResize();
  }

  private getTranslatePosition(el: any): any {
    const { ceil } = Math;
    const style = window.getComputedStyle(el);
    const matrix = new WebKitCSSMatrix(style['webkitTransform']);
    return { x: ceil(matrix.m41), y: ceil(matrix.m42) };
  }

  onStartMove(event: any) {
    const target = event?.target as HTMLElement;
    if (target?.closest('button, a, input, textarea')) {
      return;
    }
    const { max, ceil } = Math;
    const x0 = ceil(event.clientX);
    const y0 = ceil(event.clientY);
    const winPosition = this.getTranslatePosition(this.containerWindow.nativeElement);
    winPosition.h = ceil(this.containerWindow.nativeElement.offsetHeight);

    const documentHeigth = ceil(document.body.offsetHeight);
    const top0px = ceil((documentHeigth - winPosition.h) / -2);

    this.containerWindow.nativeElement.classList.add('animation-off');
    this.layerZIndex.nativeElement.classList.add('active');

    window.document.body.onmousemove = evt => {
      this.setMouseLayer(true);
      const xMove = ceil(winPosition.x + (evt.clientX - x0));
      const yMove = ceil(Math.max(top0px, winPosition.y + (evt.clientY - y0)));
      this.containerWindow.nativeElement.style.transform = `translate3d(${xMove}px, ${yMove}px, 0px)`;
    };

    window.document.body.onmouseleave = window.document.body.onmouseup = () => {
      this.containerWindow.nativeElement.classList.remove('animation-off');
      this.layerZIndex.nativeElement.classList.remove('active');
      this.setMouseLayer(false);
      window.document.body.onmouseleave = null;
      window.document.body.onmousemove = null;
      window.document.body.onmouseup = null;
    };
  }

  onWindowClose(event: any) {
    this._content.appendChild(this.inWindow.nativeElement);
    this.browserWindow.emit(false);

    this.onClose();
  }
  setMouseLayer(bool: boolean = true) {
    let _layer: any = document.querySelector('.mouse-layer');
    if (!_layer) {
      _layer = document.createElement('div');
      _layer.classList.add('mouse-layer');
      _layer.style.cssText = 'position:fixed;inset:0;z-index:10000;cursor:move;';
      document.body.appendChild(_layer);
    }
    _layer.style.display = bool && !this._noLayout ? 'block' : 'none';

  }
  newWindow() {
    this.__isBrowserWindow = true;
    this._content = this.inWindow.nativeElement.parentElement;
    this.outWindow.nativeElement.appendChild(this.inWindow.nativeElement);
    this.layerZIndex.nativeElement.style.display = 'none';
    this.browserWindow.emit(this.__isBrowserWindow);
    this.cdr.detectChanges();
  }
  clickArrowLeft(event: any = null): void {
    event.stopPropagation();
    this.messageDetailsService.clickArrowLeft({
      data: this.arrowMetaData,
      mouseEventData: event
    });
  }
  clickArrowRight(event: any = null): void {
    event.stopPropagation();
    this.messageDetailsService.clickArrowRight({
      data: this.arrowMetaData,
      mouseEventData: event
    });
  }
  ngOnDestroy() {
    document.body.removeChild(this.layerZIndex.nativeElement);
  }
  onWheel(event: any) {
    return;
  }
}
