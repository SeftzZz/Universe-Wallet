import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TokenPageRoutingModule } from './token-routing.module';

import { TokenPage } from './token.page';

import { BaseChartDirective } from 'ng2-charts';

import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TokenPageRoutingModule,
    BaseChartDirective,
    SharedModule
  ],
  declarations: [TokenPage]
})
export class TokenPageModule {}
