import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { HomePageRoutingModule } from './home-routing.module';

import { HomePage } from './home.page';

import { BaseChartDirective } from 'ng2-charts';

import { SharedModule } from '../../shared/shared.module';

import { QRCodeComponent } from 'angularx-qrcode';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    BaseChartDirective,
    SharedModule,
    QRCodeComponent
  ],
  declarations: [HomePage]
})
export class HomePageModule {}
