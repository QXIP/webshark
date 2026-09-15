import { Subject, Observable } from 'rxjs';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ModalResizableService {
  private subject = new Subject<any>();

  public get event(): Observable<any> {
    return this.subject.asObservable();
  }
  public open(data: any = null) {
    this.subject.next({open: true, data});
  }

}
