import { Component, Inject, Injectable } from '@angular/core';
import { MatSnackBar, MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';

@Component({
  selector: 'alert-template',
  template: `<div [className]="data.type">{{data.message}}</div>`,
  styles: [`
    .success {
      color: white;
      padding: 1rem;
      margin: -1rem;
      border-radius: 4px;
      background-color: #8BC34A;
    }
    .error {
      color: white;
      padding: 1rem;
      margin: -1rem;
      border-radius: 4px;
      background-color: #F44336;
    }

  `],
})
class AlertTemplateComponent {
  constructor(@Inject(MAT_SNACK_BAR_DATA) public data: any) { }
}
@Injectable({
  providedIn: 'root'
})
export class AlertService {
  constructor(private snackBar: MatSnackBar) { }
  private alert(type: string, message: string, duration: number = 5) {
    this.snackBar.openFromComponent(AlertTemplateComponent, {
      data: {
        type,
        message,
      },
      duration: 1000 * duration,
      horizontalPosition: 'left',
      verticalPosition: 'bottom'
    });
  }
  success(message: string, duration: number = 5) {
    this.alert('success', message, duration);
  }
  error(message: string, duration: number = 5) {
    this.alert('error', message, duration);
  }

}
