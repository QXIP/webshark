import { MatCardModule } from '@angular/material/card';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { AngularSplitModule } from 'angular-split';
import { FlexibleChartModule } from './../flexible-chart/flexible-chart.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartAndTableComponent } from './chart-and-table.component';
import { NoDataModule } from '../no-data/no-data.module';

@NgModule({
  imports: [
    CommonModule,
    FlexibleChartModule,
    NoDataModule,
    AngularSplitModule,
    ScrollingModule,
    MatCardModule
  ],
  declarations: [ChartAndTableComponent],
  exports: [ChartAndTableComponent]
})
export class ChartAndTableModule { }
