import { Component, ViewChild, Input, Output, EventEmitter, ChangeDetectorRef, ChangeDetectionStrategy, ElementRef } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Functions } from '@app/helper/functions';

@Component({
    selector: 'app-custom-table',
    templateUrl: './custom-table.component.html',
    styleUrls: ['./custom-table.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
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
  selectedRowIndex: number = -1;

  @Output() rowClick: EventEmitter<any> = new EventEmitter();
  @Output() rowDblClick: EventEmitter<any> = new EventEmitter();
  @ViewChild('scrollHost') scrollHost?: ElementRef<HTMLElement>;
  @ViewChild(MatSort, { static: true }) sort: any;
  @ViewChild(MatPaginator, { static: true }) paginator: any;

  dataSource = new MatTableDataSource<any>([]);
  tableFilters: any[] = [];
  @Input() isPaginator = true;
  @Input()
  set details(val: any) {
    this.dataSource = new MatTableDataSource(val || []);
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
    const rows = this.scrollHost?.nativeElement.querySelectorAll('tr.mat-mdc-row, tr.mat-row');
    (rows?.[index] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
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
