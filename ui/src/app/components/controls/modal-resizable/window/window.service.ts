import { Observable, BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class WindowService {
    subject = new BehaviorSubject<any>({});
    constructor() { }
    get listen(): Observable<any> {
        return this.subject.asObservable();
    }
    setMousePosition(evt: any): void {
        this.subject.next(evt);
    }
}
