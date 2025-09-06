import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { WalletNftPage } from './wallet-nft.page';

const routes: Routes = [
  {
    path: '',
    component: WalletNftPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class WalletNftPageRoutingModule {}
