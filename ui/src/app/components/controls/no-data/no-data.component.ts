import { Component, Input } from '@angular/core';

@Component({
  selector: 'isData',
  styleUrls: ['./no-data.component.scss'],
  template: `
    <div class="lds-container onlyLoader" *ngIf="inProgress; else dataTag">
      <h3 style="margin: 0"><div class="lds-ring"><div></div><div></div><div></div><div></div></div></h3>
    </div>
    <ng-template #dataTag>
      <div class="is-no-data" *ngIf="noDataIf; else content"><h1>No Data</h1></div>
      <ng-template #content><div class="is-data-body"><ng-content></ng-content></div></ng-template>
    </ng-template>`
})
export class NoDataComponent {
  @Input() noDataIf: boolean = false;
  @Input() inProgress: boolean = false;
}
