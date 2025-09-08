import { Component, OnInit } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Auth } from '../../services/auth';
import { Wallet } from '../../services/wallet';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit {
  wallets: any[] = [];
  activeWallet: string | null = null;

  mobileNavActive = false;

  constructor(
    private http: HttpClient,
    private auth: Auth,
    private walletService: Wallet,
  ) {}

  ngOnInit() {
    const savedWallets = localStorage.getItem('wallets');
    if (savedWallets) {
      this.wallets = JSON.parse(savedWallets);
      this.loadAllWalletBalances(); // 🔹 preload balance tiap wallet
    }

    // 🔹 listen perubahan activeWallet dari service
    this.walletService.getActiveWallet().subscribe(addr => {
      this.activeWallet = addr;
    });
  }

  private async loadAllWalletBalances() {
    const updatedWallets = await Promise.all(
      this.wallets.map(async (w) => {
        try {
          const resp: any = await this.http
            .get(`${environment.apiUrl}/wallet/balance/${w.address}`)
            .toPromise();
          return { ...w, usdValue: resp.usdValue ?? 0 };
        } catch (err) {
          console.error('❌ Error fetch balance for wallet:', w.address, err);
          return { ...w, usdValue: 0 };
        }
      })
    );

    this.wallets = updatedWallets;
    localStorage.setItem('wallets', JSON.stringify(this.wallets));
  }

  async connectWallet() {
    try {
      const resp = await (window as any).solana.connect();
      const newAddress = resp.publicKey.toString();

      if (newAddress) {
        // tambahkan ke wallets[] kalau belum ada
        if (!this.wallets.find(w => w.address === newAddress)) {
          this.wallets.push({ provider: 'phantom', address: newAddress });
          localStorage.setItem('wallets', JSON.stringify(this.wallets));
        }

        this.switchWallet(newAddress);
      }
    } catch (err) {
      console.error('Wallet connect error', err);
    }
  }

  async addCustodialAccount() {
    try {
      const userId = localStorage.getItem('userId');
      const resp: any = await this.http.post(`${environment.apiUrl}/auth/create/custodial`, {
        userId,
        provider: 'solana'
      }).toPromise();

      if (resp.wallet) {
        // tambahkan ke wallets[] 
        this.wallets.push(resp.wallet);
        localStorage.setItem('wallets', JSON.stringify(this.wallets));

        // set sebagai active
        this.switchWallet(resp.wallet.address);
      }

      if (resp.authId) localStorage.setItem('userId', resp.authId);
      if (resp.token) this.auth.setToken(resp.token, resp.authId);

    } catch (err) {
      console.error("❌ Add custodial wallet error", err);
    }
  }

  async switchWallet(address: string) {
    this.walletService.setActiveWallet(address);
    console.log('✅ Active wallet switched to:', address);

    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/balance/${address}`)
        .toPromise();

      // update balance di wallets[]
      this.wallets = this.wallets.map(w =>
        w.address === address
          ? { ...w, usdValue: resp.usdValue ?? 0 }
          : w
      );

      localStorage.setItem('wallets', JSON.stringify(this.wallets));
    } catch (err) {
      console.error('❌ Error fetch balance for wallet:', address, err);
    }
  }

  disconnectWallet() {
    this.activeWallet = null;
    localStorage.removeItem('walletAddress');
    // optional: clear semua wallets juga kalau mau logout total
    // this.wallets = [];
    // localStorage.removeItem('wallets');
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  toggleMobileNav() {
    const navWrap = document.querySelector('#header_main .mobile-nav-wrap');
    navWrap?.classList.toggle('active');
  }

  closeMobileNav() {
    const navWrap = document.querySelector('#header_main .mobile-nav-wrap');
    navWrap?.classList.remove('active');
  }

  get uniqueWallets() {
    const seen = new Set<string>();
    return this.wallets.filter(w => {
      if (seen.has(w.address)) {
        return false;
      }
      seen.add(w.address);
      return true;
    });
  }

}
