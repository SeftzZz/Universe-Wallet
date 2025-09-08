import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'shortNumber',
  standalone: false
})
export class ShortNumberPipe implements PipeTransform {
  transform(value: number): string {
    if (value === null || value === undefined) return '0';
    if (value >= 1_000_000_000_000) return (value / 1_000_000_000_000).toFixed(1).replace(/\.0$/, '') + 'T';
    if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (value >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return value.toString();
  }
}
