import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TapPageComponent } from './tap-page.component';
import { TreeFilterModule } from '../tree-filter/tree-filter.module';
import { TapFlowModule } from './tap-flow/tap-flow.module';
import { TapRtpStreamsModule } from './tap-rtp-streams/tap-rtp-streams.module';
import { TapVoipCallsModule } from './tap-voip-calls/tap-voip-calls.module';
import { NoDataModule } from '../no-data/no-data.module';
import { ChartAndTableModule } from '../chart-and-table/chart-and-table.module';
import { FollowStreamModule } from './follow-stream/follow-stream.module';
import { IoGraphModule } from './io-graph/io-graph.module';
import { FrameHexModule } from '../frame-hex/frame-hex.module';

@NgModule({
  imports: [
    CommonModule,
    TreeFilterModule,
    TapFlowModule,
    TapRtpStreamsModule,
    TapVoipCallsModule,
    NoDataModule,
    ChartAndTableModule,
    FollowStreamModule,
    IoGraphModule,
    FrameHexModule
  ],
  declarations: [TapPageComponent],
  exports: [TapPageComponent]
})
export class TapPageModule { }
