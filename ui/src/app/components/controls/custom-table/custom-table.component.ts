import { Component, ViewChild, Input, Output, EventEmitter, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Functions } from '@app/helper/functions';
import { TableVirtualScrollDataSource } from 'ng-table-virtual-scroll';
// dataSource = new TableVirtualScrollDataSource(DATA);
@Component({
  selector: 'app-custom-table',
  templateUrl: './custom-table.component.html',
  styleUrls: ['./custom-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomTableComponent {
  @Input() columns: any = [];
  @Input() isDictionary: boolean = false;
  @Input() columnsFilter: any[] = [];
  @Input() isSelectedByClick: boolean = false;

  get columnsValue(): any {
    return this.isDictionary ?
      Object.values(this.columns) : this.columns;
  }
  getKeyBy(value: any): any {
    return this.isDictionary ? Object.entries(this.columns).find(([key, val]) => val === value)?.[0] : value;
  }
  selectedRowIndex: number = -1; // -1 is selected nothings

  @Output() rowClick: EventEmitter<any> = new EventEmitter();
  @Output() rowDblClick: EventEmitter<any> = new EventEmitter();
  @ViewChild(CdkVirtualScrollViewport) viewport?: CdkVirtualScrollViewport;
  @ViewChild(MatSort, { static: true }) sort: any;
  @ViewChild(MatPaginator, { static: true }) paginator: any;

  dataSource = new TableVirtualScrollDataSource([]);
  tableFilters: any[] = [];
  @Input() isPaginator = true;
  @Input()
  set details(val: any) {
    this.dataSource = new TableVirtualScrollDataSource(val);
    if (this.isPaginator) {
      this.dataSource.paginator = this.paginator;
    }
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = (data: any, filtersJson: string) => {
      const matchFilter: any = [];
      const filters = Functions.JSON_parse(filtersJson);

      filters.forEach((filter: any) => {
        const value = data[filter.id] === null ? '' : data[filter.id] + '';
        matchFilter.push(value.toLowerCase().includes((filter.value + '').toLowerCase()));
      });
      return matchFilter.every(Boolean);
    };
    this.cdr.detectChanges();
  }
  public setSelected(index: number) {
    this.selectedRowIndex = this.isSelectedByClick ? index : -1;
    this.cdr.detectChanges();
  }
  public scrollToIndex(index: number) {
    this.setSelected(index);
    try {
      this.viewport?.scrollToIndex(Math.max(0, index));
    } catch (err) {}
  }
  public getSelected(index: number) {
    return this.selectedRowIndex === index;
  }
  constructor(private cdr: ChangeDetectorRef) { }
  onRowClick(row: any, indexItem: any, event: any) {
    this.setSelected(indexItem);
    this.rowClick.emit({ row, indexItem, event });
  }
  onRowDblClick(row: any, indexItem: any, event: any) {
    this.rowDblClick.emit({ row, indexItem, event });
  }
  checkFilterColumn(columnName: any): boolean {
    return !!this.columnsFilter.includes(columnName);
  }
  applyFilter(event: any, columnId: string): void {
    const filterValue = event?.target?.value || '';
    const itemFilter = this.tableFilters.find(i => i.id === columnId);
    if (itemFilter) {
      itemFilter.value = filterValue;
    } else {
      this.tableFilters.push({
        id: columnId,
        value: filterValue + ''
      });
    }
    this.tableFilters = this.tableFilters.filter(i => !!i.value);
    this.dataSource.filter = JSON.stringify(this.tableFilters);
    if (this.isPaginator && this.dataSource.paginator) {
      this.dataSource?.paginator?.firstPage();
    }
    this.cdr.detectChanges();
  }
}
