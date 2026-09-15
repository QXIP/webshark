import { ModalResizableService } from './../controls/modal-resizable/modal-resizable.service';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { WebSharkDataService } from '@app/services/web-shark-data.service';
import { tapInfoLists } from '@app/helper/wireshark-views';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MenuComponent implements OnInit {
  menuTree: any = null;
  menuTreeIndex: any = [];
  constructor(
    private webSharkDataService: WebSharkDataService,
    private modalResizableService: ModalResizableService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.initMenu();
    this.webSharkDataService.updates.subscribe(() => this.initMenu());
  }

  public onMenuClick(link: string, name: string) {
    if (link === 'file:close') {
      this.webSharkDataService.closeCapture();
      this.cdr.detectChanges();
      return;
    }
    if (link === 'file:export-pcap') {
      this.webSharkDataService.exportSpecifiedPackets().catch(() => undefined);
      return;
    }
    if (link === 'file:download') {
      this.webSharkDataService.downloadCaptureFile();
      return;
    }
    this.modalResizableService.open({ link, name });
    this.cdr.detectChanges();
  }

  async initMenu() {
    try {
      this.menuTreeIndex = [];
      if (!this.webSharkDataService.getCapture()) {
        this.menuTree = [];
        this.cdr.detectChanges();
        return;
      }
      const { convs, endpts, eo } = tapInfoLists(await this.webSharkDataService.getInfo());

      const menuCollection: any[] = [
        { name: 'Analyze', children: [
          { name: 'Follow Stream', tap: 'follow' },
          { name: 'Expert Information', tap: 'expert' }
        ] },
        { name: 'Statistics', children: [
          ...convs.map((c: any) => ({ name: `Conversations/${c.name}`, tap: c.tap })),
          ...endpts.map((c: any) => ({ name: `Endpoints/${c.name}`, tap: c.tap })),
          { name: 'I/O Graph', tap: 'iograph' },
          { name: 'Flow Graph', tap: 'flow' }
        ] },
        { name: 'Telephony', children: [
          { name: 'VoIP Calls', tap: 'voip-calls' },
          { name: 'RTP Streams', tap: 'rtp-streams' }
        ] },
        { name: 'File', children: [
          { name: 'Close Capture', tap: 'file:close' },
          { name: 'Export Specified Packets', tap: 'file:export-pcap' },
          { name: 'Download Original Capture', tap: 'file:download' },
          ...eo.map((item: any) => ({ name: `Export ${item.name} Objects`, tap: item.tap }))
        ] }
      ];

      this.menuTree = menuCollection.map(menu => {
        // console.log(menu.children);
        menu.children = menu.children.reduce((a: any, i: any) => {
          if (i.tap.split(':')[0] === 'eo') {
            a[i.name] = i.tap;
            return a;
          }

          const [category, ...name] = i.name.split('/');
          if (name.join('/')) {
            if (!a[category]) {
              a[category] = [];
            }

            a[category].push({
              name: i.name,
              func: () => this.onMenuClick(i.tap, i.name)
            })
            this.menuTreeIndex.push({
              name: i.name,
              func: () => this.onMenuClick(i.tap, i.name)
            })
            // this.webSharkDataService.getTapJson(i.tap).then( d => {
            //   console.log({d});
            // });
          } else {
            a[category] = i.tap;
          }
          return a;
        }, {})
        menu.children = Object.entries(menu.children).map(([key, value]: any[]) => {
          if (typeof value === 'string') {
            // this.webSharkDataService.getTapJson(value).then( d => {
            //   console.log({d});
            // });
            this.menuTreeIndex.push({
              name: key,
              func: () => this.onMenuClick(value, key)
            });
            return {
              name: key,
              func: () => this.onMenuClick(value, key)
            }
          }
          return {
            name: key,
            children: value
          }
        })
        return menu;
      });

      // console.log('menu', { menuCollection, menuTree: this.menuTree });
      this.cdr.detectChanges();
    } catch (err) {
      this.menuTree = [];
      this.cdr.detectChanges();
    }
  }
  onSelected(event: any) {
    const menuItem = this.menuTreeIndex.find((i: any) => i.name === event.name);
    menuItem?.func();
    // console.log(event, this.menuTreeIndex.find((i: any) => i.name === event.name))
  }
}
