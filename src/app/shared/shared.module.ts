import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountUpDirective } from '../directives/count-up.directive';
import { FilterPipe } from '../pipes/filter.pipe';
import { ShortNumberPipe } from '../pipes/shortNumber.pipe';

@NgModule({
  declarations: [
    CountUpDirective,
    FilterPipe,
    ShortNumberPipe
  ],
  imports: [
    CommonModule
  ],
  exports: [
    CountUpDirective,
    FilterPipe,
    ShortNumberPipe
  ]
})
export class SharedModule {}
