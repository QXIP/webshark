import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { AngularSplitModule } from 'angular-split';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TapRtpStreamsComponent } from './tap-rtp-streams.component';
import { CustomTableModule } from '../../custom-table/custom-table.module';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { NoDataModule } from '../../no-data/no-data.module';
import { StreamDetailComponent } from './stream-detail/stream-detail.component';
import { RtpWaveformComponent } from './rtp-waveform.component';
import { ModalResizableModule } from '../../modal-resizable/modal-resizable.module';
import { MatTabsModule } from '@angular/material/tabs';
import { FlexibleChartModule } from '../../flexible-chart/flexible-chart.module';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {MatRadioModule} from '@angular/material/radio';

@NgModule({
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    CustomTableModule,
    AngularSplitModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    ScrollingModule,
    NoDataModule,
    ModalResizableModule,
    MatTabsModule,
    FlexibleChartModule,
    MatCheckboxModule,
    MatRadioModule
  ],
  declarations: [
    StreamDetailComponent,
    RtpWaveformComponent,
    TapRtpStreamsComponent
  ],
  exports: [TapRtpStreamsComponent]
})
export class TapRtpStreamsModule { }
