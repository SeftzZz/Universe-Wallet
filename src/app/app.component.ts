// app.component.ts
import { Component, AfterViewInit, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
declare var bootstrap: any;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements AfterViewInit {
  constructor(private router: Router, private ngZone: NgZone) {}

  private runTemplate() {
    (window as any).initTemplate && (window as any).initTemplate();
  }

  ngAfterViewInit() {
    // pertama kali
    setTimeout(() => this.runTemplate());

    // setiap route selesai
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => setTimeout(() => this.runTemplate()));
  }
}
