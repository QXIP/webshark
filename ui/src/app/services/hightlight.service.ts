import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HighlightService {
  public bs = new BehaviorSubject([0, 0]);
  public listener: Observable<any>;
  constructor() {
    this.listener = this.bs.asObservable();
  }
  set(hArray: any[]) {
    this.bs.next(hArray);
  }

}
