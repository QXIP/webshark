import { MatDividerModule } from '@angular/material/divider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FrameHexComponent } from './frame-hex.component';

@NgModule({
  imports: [
    CommonModule,
    MatButtonToggleModule,
    MatDividerModule
  ],
  declarations: [FrameHexComponent],
  exports: [FrameHexComponent]
})
export class FrameHexModule { }
