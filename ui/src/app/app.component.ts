import { Component } from '@angular/core';
import { ThemeService } from '@app/services/theme.service';

@Component({
  selector: 'app-root',
  template: `<router-outlet></router-outlet>`
})
export class AppComponent {
  constructor(_theme: ThemeService) {}
}
