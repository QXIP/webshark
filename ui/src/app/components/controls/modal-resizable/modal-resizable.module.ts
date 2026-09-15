import { WindowComponent } from './window/window.component';
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalResizableComponent } from './modal-resizable.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {PortalModule} from '@angular/cdk/portal';

import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';


@NgModule({
    imports: [
        CommonModule,
        FontAwesomeModule,
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        PortalModule
    ],
    declarations: [
        ModalResizableComponent,
        WindowComponent
    ],
    exports: [ModalResizableComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ModalResizableModule {
    constructor(library: FaIconLibrary) {
        library.addIconPacks(fas, fab, far);
    }
}
