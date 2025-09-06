import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[countUp]',
  standalone: false
})
export class CountUpDirective implements OnChanges {
  @Input('countUp') endVal: number = 0;
  @Input() prefix: string = '';
  @Input() suffix: string = '';
  @Input() duration: number = 1000; // ms

  private startVal: number = 0;
  private frameId: number | null = null;

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['endVal']) {
      this.startAnimation();
    }
  }

  private startAnimation() {
    if (this.frameId) cancelAnimationFrame(this.frameId);

    const startTime = performance.now();
    const initial = this.startVal;
    const target = this.endVal;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / this.duration, 1);
      const current = initial + (target - initial) * progress;

      this.el.nativeElement.textContent =
        `${this.prefix}${current.toFixed(2)}${this.suffix}`;

      if (progress < 1) {
        this.frameId = requestAnimationFrame(animate);
      } else {
        this.startVal = target; // simpan nilai terakhir
      }
    };

    this.frameId = requestAnimationFrame(animate);
  }
}
