// app.component.ts
import { Component, AfterViewInit, NgZone } from '@angular/core';
import { Auth } from './services/auth';
import { App } from '@capacitor/app';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { ToastController, LoadingController } from '@ionic/angular';
import { Phantom } from './services/phantom';
import { StatusBar, Style } from '@capacitor/status-bar';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { User, UserProfile } from './services/user';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

declare var bootstrap: any;
declare function btnmenu(): void;

// simpan ephemeral keypair global
export let dappKeys: nacl.BoxKeyPair | null = null;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements AfterViewInit {
  userAddress: string = '';
  private loading: HTMLIonLoadingElement | null = null;
  constructor(
    private router: Router,
    private ngZone: NgZone,
    private auth: Auth,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private phantom: Phantom,
    private http: HttpClient, 
    private userService: User,
  ) {
    App.addListener('appUrlOpen', async (data: any) => {
      console.log('📥 Phantom callback raw URL:', data.url);

      const url = new URL(data.url);
      url.searchParams.forEach((val, key) => {
        console.log(`🔑 Param ${key} = ${val}`);
      });

      const encryptedData = url.searchParams.get('data');
      const nonce = url.searchParams.get('nonce');
      const phantomPubKey = url.searchParams.get('phantom_encryption_public_key');

      if (!encryptedData || !nonce || !phantomPubKey) {
        console.error('❌ Missing params in callback');
        return;
      }

      try {
        // Ambil secret key dari service Phantom atau fallback ke localStorage
        let secretKey: Uint8Array | null = null;
        try {
          secretKey = this.phantom.getSecretKey();
        } catch (e) {
          const stored = localStorage.getItem("dappSecretKey");
          if (stored) {
            secretKey = bs58.decode(stored);
            console.warn("⚡ Loaded secretKey from localStorage (service was reset).");
          }
        }

        if (!secretKey) {
          console.error("❌ No secretKey available for decrypt");
          return;
        }

        console.log("📥 Encrypted data (b58):", encryptedData);
        console.log("📥 Nonce (b58):", nonce);
        console.log("📥 Phantom pubkey (b58):", phantomPubKey);

        const sharedSecret = nacl.box.before(
          bs58.decode(phantomPubKey),
          secretKey
        );

        console.log('🔑 Shared Secret (hex):', Buffer.from(sharedSecret).toString("hex"));
        console.log('🔑 Shared Secret (b58):', bs58.encode(sharedSecret));

        const decrypted = nacl.box.open.after(
          bs58.decode(encryptedData),
          bs58.decode(nonce),
          sharedSecret
        );

        if (!decrypted) {
          console.error('❌ Failed to decrypt Phantom payload');
          return;
        }

        const payload = JSON.parse(new TextDecoder().decode(decrypted));
        console.log('✅ Decrypted payload:', payload);

        if (payload.public_key) {
          // login ke backend
          // this.presentLoading('Logging in...');

          // === Desktop (extension Phantom) ===
          console.log('🖥️ Desktop flow detected.');
          const provider = (window as any).solana;
          if (!provider || !provider.isPhantom) {
            console.warn('❌ Phantom extension not found in browser.');
            this.showToast('Phantom wallet not available', 'danger');
            return;
          }

          this.userAddress = payload.public_key;
          console.log('⏳ Requesting login challenge from backend...');

          // 1️⃣ Ambil challenge dari backend
          const challenge: any = await this.http
            .get(`${environment.apiUrl}/auth/wallet/challenge?address=${this.userAddress}`)
            .toPromise();

          console.log('📜 Challenge received:', challenge);

          // 2️⃣ Sign challenge message pakai Phantom
          const messageBytes = new TextEncoder().encode(challenge.message);
          const signed = await provider.signMessage(messageBytes, "utf8");
          const signature = signed.signature ? bs58.encode(signed.signature) : null;

          if (!signature) {
            this.showToast('❌ Signature missing', 'danger');
            return;
          }

          // 3️⃣ Kirim hasil sign ke backend
          this.auth.loginWithWallet({
            provider: 'phantom',
            address: this.userAddress,
            name: 'Phantom User',
            signature,
            nonce: challenge.nonce,
          }).subscribe({
            next: (res) => {
              this.dismissLoading();
              console.log('✅ Wallet login success, backend response:', res);

              this.auth.setToken(res.token, res.authId);

              localStorage.setItem('userId', res.authId);
              localStorage.setItem('walletAddress', this.userAddress);

              if (res.wallets || res.custodialWallets) {
                const allWallets = [
                  ...(res.wallets),
                  ...(res.custodialWallets)
                ];
                localStorage.setItem('wallets', JSON.stringify(allWallets));
              }

              this.showToast('Wallet connected ✅', 'success');
              window.location.href = '/tabs/home';
            },
            error: (err) => {
              this.dismissLoading();
              console.error('❌ Wallet login failed:', err);
              this.showToast(err.error?.error || 'Wallet login failed', 'danger');
            }
          });
        }
      } catch (err) {
        console.error('❌ Error decrypting Phantom response:', err);
      }
    });

    this.router.events
    .pipe(filter(event => event instanceof NavigationEnd))
    .subscribe(() => {
      setTimeout(() => this.bindMobileNav(), 50);
    });

    this.initStatusBar();

    const userId = localStorage.getItem('userId');
    if (userId) {
      this.http.get(`${environment.apiUrl}/auth/user/${userId}`).subscribe((res: any) => {
        const avatarUrl = res.avatar
          ? `${environment.baseUrl}${res.avatar}`
          : 'assets/images/app-logo.jpeg';

        this.userService.setUser({
          name: res.name,
          email: res.email,
          notifyNewItems: res.notifyNewItems || false,
          notifyEmail: res.notifyEmail || false,
          avatar: avatarUrl,
        });
      });
    }

    // Hanya untuk Web (PWA) supaya tidak nabrak gapi.auth2
    GoogleAuth.initialize({
      clientId: '542126096811-asmbfaoqgk3itq0amjjn85q4qvabl3aa.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
    });
  }

  async initStatusBar() {
    try {
      // 🔹 Tampilkan status bar
      await StatusBar.show();

      // 🔹 Atur style (DARK → teks putih, LIGHT → teks hitam)
      await StatusBar.setStyle({ style: Style.Light });

      // 🔹 Bisa juga atur background warna status bar
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
    } catch (err) {
      console.warn('⚠️ StatusBar plugin error:', err);
    }
  }

  private bindMobileNav() {
    const header = document.querySelector('#header_main');
    if (!header) return;

    const navWrap = header.querySelector('.mobile-nav-wrap');
    if (!navWrap) return; // jaga2

    const btn = header.querySelector('.mobile-button');
    const closeBtn = header.querySelector('.mobile-nav-close');
    const overlay = header.querySelector('.overlay-mobile-nav');

    // supaya tidak dobel listener
    btn?.removeEventListener('click', this.toggleNav);
    closeBtn?.removeEventListener('click', this.closeNav);
    overlay?.removeEventListener('click', this.closeNav);

    btn?.addEventListener('click', this.toggleNav.bind(this));
    closeBtn?.addEventListener('click', this.closeNav.bind(this));
    overlay?.addEventListener('click', this.closeNav.bind(this));
  }

  private toggleNav() {
    const navWrap = document.querySelector('#header_main .mobile-nav-wrap');
    navWrap?.classList.toggle('active');
  }

  private closeNav() {
    const navWrap = document.querySelector('#header_main .mobile-nav-wrap');
    navWrap?.classList.remove('active');
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

  // tambahkan toast ke AppComponent
  async showToast(message: string, color: 'success' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'top',
      color,
    });
    await toast.present();
  }

  private runTemplate() {
    (window as any).initTemplate && (window as any).initTemplate();
  }

  ngAfterViewInit() {
    // pertama kali
    setTimeout(() => this.runTemplate());
    this.bindMobileNav();

    // setiap route selesai
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => setTimeout(() => this.runTemplate()));
  }
}
