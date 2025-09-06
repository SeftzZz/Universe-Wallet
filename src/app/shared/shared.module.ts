import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountUpDirective } from '../directives/count-up.directive';
import { FilterPipe } from '../pipes/filter.pipe';

@NgModule({
  declarations: [
    CountUpDirective,
    FilterPipe
  ],
  imports: [
    CommonModule
  ],
  exports: [
    CountUpDirective,
    FilterPipe
  ]
})
export class SharedModule {}
