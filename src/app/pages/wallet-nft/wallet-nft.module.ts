import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { WalletNftPageRoutingModule } from './wallet-nft-routing.module';

import { WalletNftPage } from './wallet-nft.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    WalletNftPageRoutingModule
  ],
  declarations: [WalletNftPage]
})
export class WalletNftPageModule {}
