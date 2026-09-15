import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { FollowStreamComponent } from './follow-stream.component';
import { TapFlowModule } from '../tap-flow/tap-flow.module';

@NgModule({
  imports: [CommonModule, MatButtonModule, TapFlowModule],
  declarations: [FollowStreamComponent],
  exports: [FollowStreamComponent]
})
export class FollowStreamModule { }
