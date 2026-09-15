import { NoDataModule } from './../no-data/no-data.module';
import { FlexibleChartModule } from './../flexible-chart/flexible-chart.module';
import { TreeFilterModule } from './../tree-filter/tree-filter.module';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HtmlPipe } from './html.pipe';
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WebsharkComponent } from './webshark.component';
import {MatMenuModule} from '@angular/material/menu';
import { MatTreeModule } from '@angular/material/tree';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CustomTableModule } from '../custom-table/custom-table.module';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { FrameHexModule } from '../frame-hex/frame-hex.module';
import { MatDividerModule } from '@angular/material/divider';
import { PcapUploaderModule } from '../pcap-uploader/pcap-uploader.module';

/**
 * https://angular-split.github.io/documentation
 */
import { AngularSplitModule } from 'angular-split';
import { MenuStatComponent } from '../menu-stat/menu-stat.component';
@NgModule({
  imports: [
    PcapUploaderModule,
    MatDividerModule,
    MatMenuModule,
    CommonModule,
    MatTreeModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    CustomTableModule,
    MatInputModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    FormsModule,
    TreeFilterModule,
    FrameHexModule,
    AngularSplitModule,
    FlexibleChartModule,
    NoDataModule
  ],
  declarations: [
    MenuStatComponent,
    WebsharkComponent,
    HtmlPipe,
  ],
  exports: [WebsharkComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class WebsharkModule { }
