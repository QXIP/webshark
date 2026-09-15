import { AngularSplitModule } from 'angular-split';
import { PcapUploaderModule } from './../controls/pcap-uploader/pcap-uploader.module';
import { TreeFilterModule } from './../controls/tree-filter/tree-filter.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FilesPageComponent } from './files-page.component';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MenuModule } from '../menu/menu.module';
@NgModule({
  imports: [
    CommonModule,
    TreeFilterModule,
    PcapUploaderModule,
    MatButtonToggleModule,
    MatDividerModule,
    MenuModule,
    AngularSplitModule
  ],
  declarations: [FilesPageComponent],
  exports: [FilesPageComponent]
})
export class FilesPageModule { }
