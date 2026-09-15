import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
    name: 'html'
})
export class HtmlPipe implements PipeTransform {

    constructor(private sanitizer: DomSanitizer) { }

    public transform(value: any) {
        return this.sanitizer.sanitize(SecurityContext.HTML, value == null ? '' : String(value)) || '';
    }

}
