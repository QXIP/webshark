import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomTableComponent } from './custom-table.component';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
@NgModule({
  imports: [
    CommonModule,
    MatPaginatorModule,
    MatTableModule,
    MatSortModule
  ],
  declarations: [CustomTableComponent],
  exports: [CustomTableComponent]
})
export class CustomTableModule { }
