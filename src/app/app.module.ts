import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AuthInterceptor } from './interceptors/auth.interceptor';

import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { SharedModule } from './shared/shared.module';

import { QRCodeComponent } from 'angularx-qrcode';

import { ZXingScannerModule } from '@zxing/ngx-scanner';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    SharedModule,
    QRCodeComponent,
    ZXingScannerModule
  ],
  providers: [
    // provider routing
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

    // provider interceptor http
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    
    provideCharts(withDefaultRegisterables())
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
