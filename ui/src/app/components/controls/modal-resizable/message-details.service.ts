import { Functions } from '@app/helper/functions';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export enum ArrowEventState {
    PREVIOUS = 'previous',
    FOLLOWING = 'following'
}


@Injectable({
    providedIn: 'root'
})
export class MessageDetailsService {
    static parentWindow: any = {};
    constructor() { }
    private subject = new Subject<any>();
    private subjectArrows = new Subject<any>();

    public get event(): Observable<any> {
        return this.subject.asObservable();
    }

    public get arrows(): Observable<any> {
        return this.subjectArrows.asObservable();
    }
    public setParentWindowData(indexWindow: string, data: any = null): void {
        const hash = Functions.md5(indexWindow);
        MessageDetailsService.parentWindow[hash] = data;
    }
    public getParentWindowData(indexWindow: string): any {
        const hash = Functions.md5(indexWindow);
        const p = MessageDetailsService.parentWindow;
        return p && p[hash] || { isBrowserWindow: false };
    }

    public open(message: any, metadata: any): void {
        this.subject.next({ message, metadata });
    }

    public clickArrowRight(metadata: any): void {
        this.subjectArrows.next({
            eventType: ArrowEventState.FOLLOWING,
            metadata
        });
    }

    public clickArrowLeft(metadata: any): void {
        this.subjectArrows.next({
            eventType: ArrowEventState.PREVIOUS,
            metadata
        });
    }
}
