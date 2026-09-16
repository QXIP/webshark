import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'isData',
    styleUrls: ['./no-data.component.scss'],
    template: `
    @if (inProgress) {
      <div class="lds-container onlyLoader">
        <h3 style="margin: 0"><div class="lds-ring"><div></div><div></div><div></div><div></div></div></h3>
      </div>
    } @else {
      @if (noDataIf) {
        <div class="is-no-data"><h1>No Data</h1></div>
      } @else {
        <div class="is-data-body"><ng-content></ng-content></div>
      }
    }
    `,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class NoDataComponent {
  @Input() noDataIf: boolean = false;
  @Input() inProgress: boolean = false;
}
