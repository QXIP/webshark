import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';


// import { AlertService } from '../services/alert.service';
import { Router } from '@angular/router';
import { AlertService } from '@app/components/controls/alert/alert.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
    constructor(
        private alertService: AlertService,
        private router: Router
    ) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(catchError(err => {
            if (err.status === 401 && request.url.indexOf('/proxy') === -1) {
                // auto logout if 401 response returned from api

                const snapshotUrl = this.router.routerState.snapshot.url;

                if (!snapshotUrl.match('(system:login)')) {
                    this.router.navigate([{
                        outlets: { primary: null, system: 'login' }
                    }], {
                        queryParams: {
                            returnUrl: snapshotUrl
                        }
                    });

                }
            }

            const error = err.error.message || err.statusText;
            if (err.error.message !== 'invalid or expired jwt') {
                this.alertService.error(error + '\n' + JSON.stringify(err));
            }

            return throwError(error);
        }));
    }
}
