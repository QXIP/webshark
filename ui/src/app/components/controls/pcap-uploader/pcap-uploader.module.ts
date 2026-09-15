import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PcapUploaderComponent } from './pcap-uploader.component';
import { MaterialModule } from '@app/app.material-module';
import { FormsModule } from '@angular/forms';
@NgModule({
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule
  ],
  declarations: [PcapUploaderComponent],
  exports: [PcapUploaderComponent]
})
export class PcapUploaderModule { }
