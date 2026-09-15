import { NoDataModule } from './../controls/no-data/no-data.module';
import { TreeFilterModule } from './../controls/tree-filter/tree-filter.module';
import { MatMenuModule } from '@angular/material/menu';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuComponent } from './menu.component';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

@NgModule({
  imports: [
    CommonModule,
    MatMenuModule,
    MatButtonModule,
    MatButtonToggleModule,
    TreeFilterModule,
    NoDataModule
  ],
  declarations: [MenuComponent],
  exports: [MenuComponent]
})
export class MenuModule { }
