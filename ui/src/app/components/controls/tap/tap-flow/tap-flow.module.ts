import { NoDataModule } from './../../no-data/no-data.module';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TapFlowComponent } from './tap-flow.component';
import { MatGridListModule } from '@angular/material/grid-list';
@NgModule({
  imports: [
    CommonModule,
    MatGridListModule,
    ScrollingModule,
    NoDataModule
  ],
  declarations: [TapFlowComponent],
  exports: [TapFlowComponent]
})
export class TapFlowModule { }
