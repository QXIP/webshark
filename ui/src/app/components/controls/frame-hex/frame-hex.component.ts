import { HighlightService } from '@app/services/hightlight.service';
import { Component, Input, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-frame-hex',
  templateUrl: './frame-hex.component.html',
  styleUrls: ['./frame-hex.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrameHexComponent implements OnInit {
  selectedFrom: number = 0;
  selectedTo: number = 0;
  binaryCode: string[][] = [];
  hexCode: string[][] = [];
  scrollStart = false;

  @Input() set b64data(val: string) {
    if (val) {
      this.binaryCode = this.toHexArray(this.decodeBase64(val), 8);
      this.hexCode = this.toHexArray(this.decodeBase64(val), 16);
      this.cdr.detectChanges();
    }
  }
  @Output() onSelectedHex: EventEmitter<any> = new EventEmitter();

  constructor(
    private cdr: ChangeDetectorRef,
    private highlightService: HighlightService
  ) { }

  decodeBase64(b64String: string): string {
    return atob(b64String);
  }

  toHexArray(str: string, rowLength: number = 16) {
    return str.split('').reduce((a: any, b, k) => {
      const key = Math.floor(k / rowLength);
      if (!a[key]) {
        a[key] = [];
      }
      const hex = b.charCodeAt(0).toString(16);
      a[key].push(hex.length === 1 ? '0' + hex : hex)
      return a;
    }, [])

  }
  indexColumnValue(n: number, rowLength: number = 16): string {
    const m = n * rowLength;
    const k = m.toString(16);
    return Array.from({ length: 4 - k.length }, x => '0').join('') + k
  }
  hexToBinary(strHex: string) {
    const b = parseInt(strHex, 16).toString(2);
    return Array.from({ length: 8 - b.length }, x => '0').join('') + b;
  }
  toTextPre(hexCode:any) {
    return hexCode.map((i: any) => {
      return i.map((c: any) => {
        return this.toCharFromHex(c, true);
      }).join('');
    }).join('');
  }
  toCharFromHex(strHex: string, nonSpecialChar = false): string {
    const rxSymbols = /[^-!$%^&*()_+|~=`{}\[\]:";'<>?,.\/\w]/g;
    if (strHex == '0d') return '\r';
    if (strHex == '0a') return '\n';
    if (nonSpecialChar) {
      return String.fromCharCode(parseInt(strHex, 16))
    }
    return String.fromCharCode(parseInt(strHex, 16)).replace(rxSymbols, '.');
  }
  isSelected(rowId: number, colId: number, mode: any) {
    const index = (mode.value === 'HEX' ? 16 : 8) * rowId + colId;
    const out = this.selectedFrom <= index && this.selectedTo > index;
    if (out && this.scrollStart) {
      this.scrollStart = false;
      const el: any = document.getElementById('row-' + rowId);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    return out;
  }
  onClick(rowId: number, colId: number, mode: any) {
    const index = (mode.value === 'HEX' ? 16 : 8) * rowId + colId;

    this.onSelectedHex.emit(index)
  }
  ngOnInit() {
    this.highlightService.listener.subscribe((data: any[]) => {
      const [from, to] = data || [0, 0];
      this.selectedFrom = from;
      this.selectedTo = from + to;
      this.scrollStart = true;
      this.cdr.detectChanges();
    })
  }

}
