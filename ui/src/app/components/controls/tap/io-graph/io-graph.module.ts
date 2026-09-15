import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IoGraphComponent } from './io-graph.component';
import { FlexibleChartModule } from '../../flexible-chart/flexible-chart.module';

@NgModule({
  imports: [CommonModule, FlexibleChartModule],
  declarations: [IoGraphComponent],
  exports: [IoGraphComponent]
})
export class IoGraphModule { }
