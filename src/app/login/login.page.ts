import { Component, OnInit } from '@angular/core';
import { Auth } from '../services/auth';
import { Phantom } from '../services/phantom';
import { ToastController, LoadingController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

let dappKeyPair: nacl.BoxKeyPair | null = null;

export const dappKeys = nacl.box.keyPair();
export const nonce = nacl.randomBytes(24);

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  email = '';
  password = '';
  userAddress: string = '';

  balance: number | null = null;
  balanceUsd: number | null = null;
  trend: number = 0;
  percentChange: number = 0;

  private loading: HTMLIonLoadingElement | null = null;

  constructor(
    private http: HttpClient,
    private auth: Auth,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private router: Router,
    private phantom: Phantom
  ) {}

  ngOnInit() {
    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.userAddress = saved;
      this.updateBalance();
    }
  }

  // === Phantom Wallet connect + login ===
  async connectWallet() {
    try {
      this.phantom.generateSession();

      const dappPubKey = this.phantom.getPublicKeyB58();
      const nonceB58 = this.phantom.getNonceB58();

      // ⚠️ redirect harus sama dengan di AndroidManifest (scheme)
      const redirect = 'universeofgamers://phantom-callback';
      const appUrl = 'https://universeofgamers.io';

      // 📌 Buat schemaUrl manual sesuai format Phantom
      const schemaUrl =
        `https://phantom.app/ul/v1/connect?` +
        `dapp_encryption_public_key=${dappPubKey}` +
        `&cluster=mainnet-beta` +
        `&app_url=${encodeURIComponent(appUrl)}` +   // ✅ encode app_url
        `&redirect_link=${redirect}` +               // ✅ jangan encode custom scheme
        `&nonce=${nonceB58}`;

      console.log("🔗 schemaUrl:", schemaUrl);

      if (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') {
        setTimeout(async () => {
          try {
            window.location.href = schemaUrl;
            console.log('🌐 Universal link opened successfully.');
          } catch (err) {
            console.error('❌ Failed to open universal link:', err);
          }
        }, 1000);
      } else {
        // === Desktop (extension Phantom) ===
        console.log('🖥️ Desktop flow detected.');
        const provider = (window as any).solana;
        if (!provider || !provider.isPhantom) {
          console.warn('❌ Phantom extension not found in browser.');
          this.showToast('Phantom wallet not available', 'danger');
          return;
        }

        console.log('🔑 Requesting Phantom extension connect...');
        const resp = await provider.connect();
        this.userAddress = resp.publicKey.toString();
        console.log('✅ Phantom extension connected. Address:', this.userAddress);

        if (this.userAddress) {
          // this.presentLoading('Logging in...');
          console.log('⏳ Logging in to backend with wallet address...');

          this.auth.loginWithWallet({
            provider: 'phantom',
            address: this.userAddress,
            name: 'Phantom User',
          }).subscribe({
            next: (res) => {
              this.dismissLoading();
              console.log('✅ Wallet login success, backend response:', res);

              this.auth.setToken(res.token, res.authId);
              
              localStorage.setItem('userId', res.authId);
              localStorage.setItem('walletAddress', this.userAddress);

              // setelah dapat response dari backend
              if (res.wallets || res.custodialWallets) {
                const allWallets = [
                  ...(res.wallets),
                  ...(res.custodialWallets)
                ];
                localStorage.setItem('wallets', JSON.stringify(allWallets));
              }

              this.showToast('Wallet connected ✅', 'success');
              this.router.navigate(['/tabs/home']);
            },
            error: (err) => {
              this.dismissLoading();
              console.error('❌ Wallet login failed:', err);
              this.showToast(err.error?.error || 'Wallet login failed', 'danger');
            }
          });
        }
      }
    } catch (err) {
      this.dismissLoading();
      console.error('💥 Unhandled wallet connect error:', err);
      this.showToast('Wallet connect error', 'danger');
    }
  }

  // === Disconnect Phantom Wallet ===
  disconnectWallet() {
    localStorage.removeItem('walletAddress');
    this.auth.logout(); // hapus token + authId
    this.userAddress = '';
    this.balance = null;
    this.showToast('Wallet disconnected', 'danger');
  }

  async updateBalance() {
    if (!this.userAddress) return;
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/balance/${this.userAddress}`)
        .toPromise();

      this.balance = resp.solBalance;
      this.balanceUsd = resp.usdValue;
      this.trend = resp.trend ?? 0;
      this.percentChange = resp.percentChange ?? 0;

    } catch (err) {
      console.error('Error fetch balance from API', err);
      this.showToast('Error fetch balance', 'danger');
    }
  }

  async showToast(message: string, color: 'success' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
      color,
    });
    await toast.present();
  }

  async presentLoading(message = 'Please wait...') {
    this.loading = await this.loadingCtrl.create({
      message,
      spinner: 'crescent',
      translucent: true,
    });
    await this.loading.present();
  }

  async dismissLoading() {
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
  }

  clearForm() {
    this.email = '';
    this.password = '';
  }

  // === Login dengan email + password ===
  onLogin(event: Event) {
    event.preventDefault();

    if (!this.email || !this.password) {
      this.showToast('Email and password are required', 'danger');
      return;
    }

    // this.presentLoading('Logging in...');
    const payload = { email: this.email, password: this.password };

    this.auth.login(payload).subscribe({
      next: (res) => {
        this.dismissLoading();
        this.auth.setToken(res.token, res.authId);

        // ✅ ambil walletAddress (custodial dulu, kalau tidak ada pakai external)
        let walletAddr = null;
        if (res.custodialWallets?.length > 0) {
          walletAddr = res.custodialWallets[0].address;
        } else if (res.wallets?.length > 0) {
          walletAddr = res.wallets[0].address;
        }

        // ✅ simpan ke localStorage
        localStorage.setItem('userId', res.authId);
        if (walletAddr) {
          localStorage.setItem('walletAddress', walletAddr);
        }

        // setelah dapat response dari backend
        if (res.wallets || res.custodialWallets) {
          const allWallets = [
            ...(res.wallets || []),
            ...(res.custodialWallets || [])
          ];
          localStorage.setItem('wallets', JSON.stringify(allWallets));
        }

        this.showToast('Login success 🎉', 'success');
        this.clearForm();
        this.router.navigate(['/tabs/home']);
      },
      error: (err) => {
        this.dismissLoading();
        this.showToast(err.error?.error || 'Login failed', 'danger');
      },
    });
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  // === Placeholder login lain ===
  googleLogin() {
    this.showToast('🔑 Google Login coming soon', 'success');
  }

  onRegister() {
    this.router.navigate(['/registration']);
  }

  testDeeplink() {
    console.log("🔗 Trigger deeplink manually...");
    window.location.href = 'io.ionic.starter://phantom-callback?foo=bar';
  }

}
