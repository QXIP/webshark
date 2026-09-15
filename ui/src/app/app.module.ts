import { FlexibleChartModule } from './components/controls/flexible-chart/flexible-chart.module';
import { FrameHexModule } from './components/controls/frame-hex/frame-hex.module';
import { PcapUploaderModule } from './components/controls/pcap-uploader/pcap-uploader.module';
import { FilesPageModule } from './components/files-page/files-page.module';
import { MenuModule } from './components/menu/menu.module';
import { WebsharkModule } from './components/controls/webshark/webshark.module';
import { HomeComponent } from './components/Home/Home.component';
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MaterialModule } from './app.material-module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { routing } from './app.routing';
import { HttpClientModule, HTTP_INTERCEPTORS, HttpClientJsonpModule } from '@angular/common/http';
import { ErrorInterceptor } from './helper/error.interceptor';
import { ModalResizableModule } from './components/controls/modal-resizable/modal-resizable.module';
import { TapPageModule } from './components/controls/tap/tap-page.module';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent
  ],
  imports: [
    MaterialModule,
    BrowserModule,
    AppRoutingModule,
    routing,
    BrowserAnimationsModule,
    WebsharkModule,
    MenuModule,
    HttpClientModule,
    HttpClientJsonpModule,
    FilesPageModule,
    PcapUploaderModule,
    FrameHexModule,
    ModalResizableModule,
    TapPageModule,
    FlexibleChartModule
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
  ]
})
export class AppModule { }
