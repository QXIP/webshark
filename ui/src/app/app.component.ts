import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ThemeService } from '@app/services/theme.service';

@Component({
    selector: 'app-root',
    template: `<router-outlet></router-outlet>`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AppComponent {
  constructor(_theme: ThemeService) {}
}
