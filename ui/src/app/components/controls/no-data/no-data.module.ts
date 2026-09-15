import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NoDataComponent } from './no-data.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [NoDataComponent],
  exports: [NoDataComponent]
})
export class NoDataModule { }
