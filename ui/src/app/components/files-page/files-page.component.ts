import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Output, EventEmitter, Input } from '@angular/core';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-files-page',
  templateUrl: './files-page.component.html',
  styleUrls: ['./files-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class FilesPageComponent implements OnInit {
  files: any[] = [];
  isKIOSK = !!environment.kiosk;
  @Input() isFile = false;

  @Output() fileChosen: EventEmitter<any> = new EventEmitter();
  constructor(
    private webSharkDataService: WebSharkDataService,
    private cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit() {

    this.getFiles();
    this.webSharkDataService.updates.subscribe(({ cm }: { cm: string }) => {
      if (cm === 'uploaded') {
        this.getFiles();
      }
    });
  }
  async getFiles() {
    if (this.isFile) {
      return;
    }
    const getFiles: Function = (dir: string) => this.webSharkDataService.getFiles(dir);
    const fileData = await getFiles();
    const mapping = (file: any, prefix: string = '/') => {
      if (file.dir === true) {
        const o: any = {
          name: file.name + ` <i></i>[..loading]</i>`,
          description: prefix,
          children: []
        }
        getFiles(file.name).then((data: any) => {
          const arrFiles: any = data.files.map((i: any) => mapping(i, file.name));
          o.name = file.name;
          o.description = prefix;
          o.children.push(...arrFiles);
          this.files = [...this.files];
          this.cdr.detectChanges();
        })
        return o;
      }
      file.description = prefix;
      return file;
    }
    const files = fileData.files.map((i: any) => mapping(i, ''));
    this.files = [
      ...files.filter((i: any) => i.children),
      ...files.filter((i: any) => !i.children)
    ];
    this.cdr.detectChanges();
  }


  onFileChoose(data: any) {
    const path = data.description ? [data.description, data.name].join('/') : data.name;
    this.webSharkDataService.setCaptureFile(path);
    this.isFile = true;
    this.fileChosen.emit(path);
  }
}
