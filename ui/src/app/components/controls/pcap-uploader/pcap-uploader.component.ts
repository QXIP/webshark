import { MatSnackBar } from '@angular/material/snack-bar';
import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { Component, Input, Output, EventEmitter, AfterViewInit, ViewChild, ChangeDetectorRef, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { environment } from '@environments/environment';
import { AlertService } from '../alert/alert.service';


@Component({
    selector: 'pcap-uploader',
    templateUrl: './pcap-uploader.component.html',
    styleUrls: ['./pcap-uploader.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class PcapUploaderComponent implements OnInit, OnDestroy, AfterViewInit {
  idDrugOver = false;
  data: any;
  filename: string = '';
  filesize: string = '';
  fileToUpload: any;
  inProgress = false;
  isDataTimeNow: any = false;
  isClientOnly = !!environment.clientOnly;

  @Output() changeSettings = new EventEmitter<any>();

  @ViewChild('fileSelect', { static: true }) fileSelect: any;

  constructor(
    private webSharkDataService: WebSharkDataService,
    private cdr: ChangeDetectorRef,
    private alertService: AlertService
  ) { }

  ngAfterViewInit() {
    const hsp = (e: any) => {
      this.idDrugOver = e.type === 'dragover';
      e.preventDefault();
      e.stopPropagation();
    };
    const handlerDrop = (e: any) => {
      hsp(e);
      Array.from(e.dataTransfer.files).forEach(this.handlerUpload.bind(this));
    };

    Object.entries({
      submit: hsp, drag: hsp, dragstart: hsp, dragend: hsp,
      dragover: hsp, dragenter: hsp, dragleave: hsp,
      drop: handlerDrop, change: (e: any) => this.handlerUpload(e.target.files[0])
    }).forEach(([key, listener]) => {
      this.fileSelect.nativeElement.addEventListener(key, listener);
    });
  }

  private handlerUpload(file: any) {
    this.filename = file.name;
    this.filesize = (file.size / 1024).toFixed(2);
    this.fileToUpload = file;
    this.cdr.detectChanges();
    if (this.isClientOnly) {
      this.onSubmit();
    }
  }
  onSubmit() {
    this.inProgress = true;
    this.webSharkDataService.postFile(this.fileToUpload, this.isDataTimeNow).subscribe(data => {
      this.inProgress = false;
      this.alertService.success(this.isClientOnly ? 'Opened ' + this.filename : 'File was uploaded successfully');
      this.filename = '';
      this.cdr.detectChanges();
    }, error => {
      this.inProgress = false;
      this.alertService.error(error?.errstr || error?.message || 'Could not open capture');
      this.cdr.detectChanges();
    });
  }
  openDialog(): void { }

  ngOnInit() { }

  ngOnDestroy() { }
}
