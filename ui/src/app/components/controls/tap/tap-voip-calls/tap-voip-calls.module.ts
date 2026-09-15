import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { NoDataModule } from '../../no-data/no-data.module';
import { TapFlowModule } from '../tap-flow/tap-flow.module';
import { TapVoipCallsComponent } from './tap-voip-calls.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    NoDataModule,
    TapFlowModule
  ],
  declarations: [TapVoipCallsComponent],
  exports: [TapVoipCallsComponent]
})
export class TapVoipCallsModule { }
