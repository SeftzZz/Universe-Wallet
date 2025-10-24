import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () =>
          import('../home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'wallet',
        loadChildren: () =>
          import('../wallet/wallet.module').then(m => m.WalletPageModule)
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('../profile/profile.module').then(m => m.ProfilePageModule)
      },
      {
        path: 'wallet-nft',
        loadChildren: () => 
          import('../wallet-nft/wallet-nft.module').then( m => m.WalletNftPageModule)
      },
      {
        path: 'swap',
        loadChildren: () => 
          import('../swap/swap.module').then( m => m.SwapPageModule)
      },
      {
        path: 'token/:mint',
        loadChildren: () => import('../token/token.module').then( m => m.TokenPageModule)
      },
      {
        path: 'offline',
        loadChildren: () => import('../offline/offline.module').then( m => m.OfflinePageModule)
      },
      {
        path: 'settings',
        loadChildren: () => import('../settings/settings.module').then( m => m.SettingsPageModule)
      },
      {
        path: 'transactions',
        loadChildren: () => import('../transactions/transactions.module').then( m => m.TransactionsPageModule)
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
