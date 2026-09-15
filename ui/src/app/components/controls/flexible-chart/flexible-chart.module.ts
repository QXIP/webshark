import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlexibleChartComponent } from './flexible-chart.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [FlexibleChartComponent],
  exports: [FlexibleChartComponent]
})
export class FlexibleChartModule { }
