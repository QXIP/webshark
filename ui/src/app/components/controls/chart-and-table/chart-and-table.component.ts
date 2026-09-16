import { ChartType, ChartData } from './../flexible-chart/flexible-chart.component';
import { Component, Input, OnInit, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { hash } from '@app/helper/functions';
import { tapCellValue, tapColumnKeys, tapDisplayRows, tapTableTitle } from '@app/helper/wiregasm-adapt';

@Component({
    selector: 'chart-and-table',
    templateUrl: './chart-and-table.component.html',
    styleUrls: ['./chart-and-table.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ChartAndTableComponent implements OnInit {
  private _data: any = [];
  columns: string[] = [];
  title: string = '';
  @Output() rowClick: EventEmitter<any> = new EventEmitter();
  @Input() set data(val: any) {
    if (!val) {
      return;
    }
    this._data = tapDisplayRows(val);
    this.columns = tapColumnKeys(this._data[0]);
    this.title = tapTableTitle(val);

    const series: Record<string, number[]> = {};
    this._data.forEach((row: any) => {
      this.columns.forEach((key) => {
        const val = row[key];
        if (typeof val === 'number') {
          if (!series[key]) {
            series[key] = [];
          }
          series[key].push(val);
        }
      });
    });
    this.chartData = Object.entries(series).map(([key, data]) => ({
      typeOfChart: ChartType.AREA,
      color: `#${hash(key, 6)}`,
      name: key,
      data
    }));
  }
  cellValue(item: any, col: string): string {
    return tapCellValue(item?.[col]);
  }
  get data(): any {
    return this._data;
  }
  chartData: ChartData[] = [];
  constructor() { }

  ngOnInit() {
  }

  onRowClick(item: any) {
    this.rowClick.emit(item);
  }

}
