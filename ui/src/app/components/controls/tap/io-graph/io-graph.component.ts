import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { iographSeries } from '@app/helper/wireshark-views';
import { ChartData, ChartType } from '../../flexible-chart/flexible-chart.component';

@Component({
    selector: 'io-graph',
    templateUrl: './io-graph.component.html',
    styleUrls: ['./io-graph.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class IoGraphComponent implements OnInit {
  chartData: ChartData[] = [];
  loading = false;

  @Input() set data(val: any) {
    if (val) {
      this.apply(val);
    }
  }

  constructor(private webSharkDataService: WebSharkDataService) {}

  async ngOnInit() {
    if (this.chartData.length) {
      return;
    }
    this.loading = true;
    try {
      const result = await this.webSharkDataService.getIograph();
      this.apply(result);
    } finally {
      this.loading = false;
    }
  }

  private apply(result: any) {
    const series = iographSeries(result);
    this.chartData = [{
      typeOfChart: ChartType.BAR,
      color: '#3f51b5',
      name: 'packets',
      data: series
    }];
  }
}
