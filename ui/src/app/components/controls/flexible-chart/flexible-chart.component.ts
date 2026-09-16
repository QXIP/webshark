import { Component, Input, OnInit, ViewChild, EventEmitter, Output, AfterViewInit, HostListener, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Functions, hash } from '@app/helper/functions';
import { ThemeService } from '@app/services/theme.service';
import { Subscription } from 'rxjs';

export interface ChartOptions {

}
export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  AREA = 'area'
}
export type TypeOfChart = 'line' | 'bar' | 'area';
export interface ChartData {
  data: any[];
  typeOfChart?: TypeOfChart;
  name?: string;
  description?: string;
  color?: string;
}

@Component({
    selector: 'flexible-chart',
    templateUrl: './flexible-chart.component.html',
    styleUrls: ['./flexible-chart.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class FlexibleChartComponent implements OnInit, AfterViewInit, OnDestroy {
  exampleData: ChartData[] = [];
  @Input() globalMinMax: boolean = false
  mousePosition: any = {
    inside: false,
    mousedown: false,
    x: 0,
    y: 0
  };
  @Input() fullToolTip = false;
  @Input() isRange = true;
  @Input() startXAxisNumber = 0;
  @Input() options: any = {
    axisX: false,
    axisY: false
  };
  _typeOfChart: TypeOfChart = ChartType.BAR; // line | area | bar

  @Input() set typeOfChart(val: TypeOfChart) {
    this._typeOfChart = val;
    // console.log({ val });
    this.redraw();
  }
  get typeOfChart(): TypeOfChart {
    return this._typeOfChart;
  }

  @Input() set data(val: ChartData[]) {
    if (!val) {
      return;
    }
    this.exampleData = Array.isArray(val) ? val : [];
    this.redraw();
  }

  @Output() range: EventEmitter<any> = new EventEmitter();
  @ViewChild('canvas', { static: true }) canvas: any;

  private checkInterval: any;
  private bufferOffsetChart: any;
  private themeSub?: Subscription;

  constructor(private theme: ThemeService) { }

  @HostListener('window:resize')
  onResize() {
    this.redraw();
  }

  ngAfterViewInit() {
    // this.redraw();
  }

  private eventCheckerCanvasSizeChanged() {
    this.checkInterval = setInterval(() => {
      const { offsetWidth, offsetHeight } = this.canvas.nativeElement;
      const _hash = hash(`canvas-${offsetWidth}-${offsetHeight}`, 4);
      if (_hash !== this.bufferOffsetChart) {
        this.bufferOffsetChart = _hash;
        // console.log('EMIT CHANGE', { offsetWidth, offsetHeight, _hash });
        this.redraw();
      }
    }, 20)
  }

  ngOnInit() {
    this.eventCheckerCanvasSizeChanged();
    this.themeSub = this.theme.resolved$.subscribe(() => this.redraw());
  }
  public mouseEvent(event: any) {
    const { layerX, layerY } = event;
    // const { layerX = 0, layerY = 0 }:any = {};
    const { offsetWidth, offsetHeight, offsetLeft, offsetTop } = this.canvas.nativeElement;
    const dX = layerX - offsetLeft;
    const dY = layerX - offsetTop;

    switch (event.type) {
      case 'mousemove':
        this.mousePosition.x = layerX - offsetLeft;
        this.mousePosition.y = layerY - offsetTop;
        break;
      case 'mousedown':
        this.mousePosition.mousedown = true;
        this.mousePosition.xDown = dX / offsetWidth;
        this.mousePosition.yDown = layerY / offsetHeight;
        this.mousePosition.xUp = null;
        this.mousePosition.yUp = null;
        this.mousePosition.inside = true;
        break;
      case 'mouseup':
        this.mousePosition.inside = true;
        this.mousePosition.xUp = dX / offsetWidth;
        this.mousePosition.yUp = layerY / offsetHeight;
        this.mousePosition.mousedown = false;
        this.range.emit(this.сalcRangeByData());
        break;
      case 'mouseout':
        this.mousePosition.mousedown = false;
        this.mousePosition.inside = false;
        break;
      case 'mouseover':
        this.mousePosition.mousedown = false;
        this.mousePosition.inside = true;
        break;
      case 'mouseoutside':
        this.mousePosition.xUp = layerX / offsetWidth;
        this.mousePosition.yUp = layerY / offsetHeight;
        this.mousePosition.mousedown = false;
        this.mousePosition.inside = false;
        this.range.emit(this.сalcRangeByData());
        break;
    }
    this.redraw();
  }
  update() {
    this.redraw();
  }
  сalcRangeByData(): any[] {
    const pudding = { x: 10, y: 0 }; // px
    const [firstData] = this.exampleData || [{ data: [] }];
    const data = this.formattedData(firstData.data);
    const { offsetWidth } = this.canvas.nativeElement;
    const stepX = ((offsetWidth - pudding.x * 2) / (data.length));
    const from = Math.round((this.mousePosition.xDown * offsetWidth || this.mousePosition.x) / stepX);
    const to = Math.round((this.mousePosition.xUp * offsetWidth || this.mousePosition.x) / stepX);
    return [from, to];

  }
  getIndexOfData() {
    const pudding = { x: 10, y: 0 }; // px
    const [firstData] = this.exampleData || [];
    if (!firstData) {
      return 0;
    }
    const data = this.formattedData(firstData.data);
    const { offsetWidth } = this.canvas.nativeElement;
    const stepX = ((offsetWidth - pudding.x * 2) / (data.length));
    const index = Math.ceil((this.mousePosition.x) / stepX);
    return index;
  }
  tooltip(ctx: any, text: string, index = 0) {
    const padding = 4;
    ctx.font = `14px monospace`;
    const textElement = ctx.measureText(text.split('\n')[0]);
    const w = textElement.width;
    const x = Math.max(0, Math.min(
      ctx.canvas.clientWidth - w - padding * 2,
      this.mousePosition.x - (w + padding) / 2
    ));
    const y = 10;

    ctx.fillStyle = this.cssVar('--ws-chart-tooltip-bg', 'rgba(255, 255, 255, 0.8)');
    ctx.fillStyle = this.cssVar('--ws-chart-text', 'black');
    text.split('\n').forEach((line, k) => {

      this.drawText(ctx, line, {
        x, y: y + k * 20,
        bgColor: this.cssVar('--ws-chart-tooltip-bg', 'rgba(255, 255, 255, 0.8)'),
        color: this.cssVar('--ws-chart-text', 'black')
      })
    })

  }
  drawText(ctx: any, text: string, { x, y, bgColor, color }: any) {

    const padding = 4;
    const size = 14;

    ctx.font = `${size}px monospace`;
    const textElement = ctx.measureText(text);
    const w = textElement.width;
    const h = size;

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, padding * 2 + w, padding * 2 + h);

    ctx.textBaseline = "hanging";
    ctx.fillStyle = color;
    ctx.fillText(text, x + padding, y + padding + 1);
  }
  formattedData(data: any[] = []) {
    var out = [];
    for (var i = 0; i < data.length; i++) {
      out.push(data[i] || 0);
    };
    // out;
    return out;
  }
  setLineStyle(ctx: any) {
    const canvas = this.cssVar('--ws-chart-canvas', '#fff');
    ctx.beginPath();
    ctx.fillStyle = canvas;
    ctx.strokeStyle = canvas;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1;
  }
  private cssVar(name: string, fallback: string): string {
    if (typeof getComputedStyle !== 'function') {
      return fallback;
    }
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }
  draw(ctx: any) {

    let minData = Number.MAX_VALUE, maxData = Number.MIN_VALUE;
    if (this.globalMinMax) {
      this.exampleData.forEach(({ data }: any) => {
        minData = Math.min(...data, minData, 0);
        maxData = Math.max(...data, maxData);
      });
    }
    this.exampleData.forEach(({ data, color, typeOfChart }: any) => {
      this.drawChart(ctx, data, color, typeOfChart, [minData, maxData]);
    })
    if (this.isRange) {
      this.drawRange(ctx);

      if (this.mousePosition.inside) {
        this.drawTarget(ctx);
        if (this.fullToolTip) {

          const idx = this.getIndexOfData() - 1;
          console.log({ exampleData: this.exampleData });
          this.tooltip(ctx,

            this.exampleData.map(i => i.data[idx] ? `${i.name}: ${i.data[idx]}` : '').filter(i => !!i).join('\n')

          )
        } else {

          this.tooltip(ctx, JSON.stringify(
            !this.mousePosition.mousedown ?
              this.getIndexOfData() :
              this.сalcRangeByData()));
        }
      }
    }

    const [fItem] = this.exampleData || [];
    if (this.options?.axisX && fItem?.data) {
      this.drawAxisX(ctx, fItem.data);
    }

    if (this.options?.axisY && fItem?.data) {
      this.drawAxisY(ctx, Object.keys(fItem.data));
    }

  }
  drawAxisY(ctx: any, data: any[]) {
    const padding = { x: 10, y: this.options.axisY ? 40 : 0 };
    const h = ctx.canvas.offsetHeight - padding.y;
    this.setLineStyle(ctx);
    ctx.strokeStyle = this.cssVar('--ws-chart-text', '#000');
    ctx.moveTo(padding.x, 0);
    ctx.lineTo(padding.x, h);
    ctx.stroke();

    const min = Math.min(...data, 0);
    const max = Math.max(...data);
    const L = Math.ceil(h / 20);
    const step = h / L;
    let x, y;
    for (let i = 1; i <= L; i++) {
      x = padding.x + 10;
      y = i * step;
      ctx.moveTo(padding.x, y);
      ctx.lineTo(padding.x + 5, y);
      ctx.stroke();
      this.drawText(ctx, `${((max - min) * (L - i) / L).toFixed(2)}`, {
        x: padding.x + 5,
        y: y - 12,
        bgColor: 'rgba(255, 255, 255, 0)',
        color: this.cssVar('--ws-chart-text', 'black')
      })
    }

    // ctx.stroke();
  }
  drawAxisX(ctx: any, data: any[]) {
    const padding = { x: 10, y: 40 };
    const w = ctx.canvas.offsetWidth - padding.x * 2;
    const h = ctx.canvas.offsetHeight;
    this.setLineStyle(ctx);
    ctx.strokeStyle = this.cssVar('--ws-chart-text', '#000');
    ctx.moveTo(padding.x, h - padding.y);
    ctx.lineTo(padding.x + w, h - padding.y);
    ctx.stroke();

    const min = Math.min(...data, 0);
    const max = Math.max(...data);
    const L = Math.min(data.length, Math.ceil(w / 40));
    const step = w / L;
    let x, y;
    for (let i = 0; i < L; i++) {
      x = padding.x + i * step + step / 2;
      y = h - padding.y + 5;
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x, y + 3);
      ctx.stroke();
      this.drawText(ctx, `${(this.startXAxisNumber + data.length * (i + 1) / L).toFixed(0)}`, {
        x: x - 10,
        y: y,
        bgColor: 'rgba(255, 255, 255, 0)',
        color: this.cssVar('--ws-chart-text', 'black')
      })
    }
  }

  drawRange(ctx: any) {
    const { offsetWidth } = ctx.canvas;
    if (this.mousePosition.xDown) {
      const k = this.mousePosition.xUp && offsetWidth || 1;
      const [a, b] = [
        this.mousePosition.xDown * offsetWidth,
        (this.mousePosition.xUp || this.mousePosition.x) * k
      ];
      const startX = Math.max(a, b);
      const endX = Math.min(a, b);
      ctx.fillStyle = 'rgba(128,255,128,0.5)';
    ctx.strokeStyle = this.cssVar('--ws-chart-text', 'rgba(255, 255, 255, 0.8)');
    ctx.fillRect(startX, 0, endX - startX, ctx.canvas.height);
      ctx.stroke();
    }
  }
  drawChart(ctx: any, data: any[], color = 'rgba(0,255,255,0.5)', type: TypeOfChart = this.typeOfChart, [min, max]: any) {
    data = Functions.cloneObject(data);
    const pudding = { x: 10, y: this.options.axisX ? 40 : 0 }; // px
    let minY;
    let maxY;
    if (this.globalMinMax) {
      minY = min;
      maxY = max;

    } else {

      minY = Math.min(...data, 0);
      maxY = Math.max(...data);
    }

    let stepX = ((ctx.canvas.offsetWidth - pudding.x * 2) / (data.length));
    const stepY = ((ctx.canvas.offsetHeight - pudding.y * 2) / maxY);

    let x, y, w, h;
    ctx.globalAlpha = 0.5;
    this.setLineStyle(ctx);
    ctx.fillStyle = color;
    switch (type) {
      case ChartType.LINE:
      case ChartType.AREA:
        stepX = ((ctx.canvas.offsetWidth - pudding.x * 2) / (data.length - 1));
        for (let i = 0; data.length; i += stepX) {
          y = pudding.y + (minY + maxY - data.shift()) * stepY;
          x = pudding.x + i;

          if (i === 0) {
            ctx.moveTo(x, ctx.canvas.offsetHeight - pudding.y);
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.lineTo(x, ctx.canvas.offsetHeight - pudding.y);

        if (type === ChartType.AREA) {
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.stroke();
        break;
      case ChartType.BAR:
        ctx.fillStyle = color;

        for (let i = 0; data.length; i += stepX) {
          y = pudding.y + (minY + maxY - data.shift()) * stepY;
          x = pudding.x + i + stepX / 10;
          w = stepX * 8 / 10;
          h = ctx.canvas.offsetHeight - pudding.y - y
          ctx.fillRect(x, y, w, h);
        }
        break;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  drawTarget(ctx: any) {
    this.setLineStyle(ctx);
    ctx.strokeStyle = this.cssVar('--ws-chart-text', 'rgba(255, 255, 255, 0.8)');

    // vertical
    ctx.moveTo(this.mousePosition.x, 0);
    ctx.lineTo(this.mousePosition.x, ctx.canvas.height);


    // horizontal
    // ctx.moveTo(0, this.mousePosition.y);
    // ctx.lineTo(ctx.canvas.width, this.mousePosition.y);

    ctx.stroke();
  }
  redraw() {
    if (!this.canvas?.nativeElement) {
      return;
    }
    const c = this.canvas.nativeElement;

    c.width = `${c.offsetWidth}`;
    c.height = `${c.offsetHeight - 5}`;

    if (c.getContext) {
      var ctx = c.getContext('2d');
      this.draw(ctx);
    }
    // requestAnimationFrame(this.redraw.bind(this));
  }
  ngOnDestroy() {
    this.themeSub?.unsubscribe();
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
