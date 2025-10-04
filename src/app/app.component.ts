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
import { Capacitor } from '@capacitor/core';

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

  private phantomFlow: 'connect' | 'signMessage' | null = null;
  private challengeNonce: string | null = null;
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
    // this.listenPhantomCallback();

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

  /**
   * Listener untuk callback Phantom (deeplink)
   */
  listenPhantomCallback() {
    App.addListener('appUrlOpen', async (data: any) => {
      console.log('📥 Phantom callback raw URL:', data.url);

      const url = new URL(data.url);
      url.searchParams.forEach((val, key) => {
        console.log(`🔑 Param ${key} = ${val}`);
      });

      const encryptedData = url.searchParams.get('data');
      const nonce = url.searchParams.get('nonce');
      const phantomPubKey = url.searchParams.get('phantom_encryption_public_key');
      const errorCode = url.searchParams.get('errorCode');
      const errorMessage = url.searchParams.get('errorMessage');

      // 🚨 Tangani error dari Phantom
      if (errorCode || errorMessage) {
        console.error(`❌ Phantom error: ${errorCode} - ${errorMessage}`);
        return;
      }

      if (!encryptedData || !nonce || !phantomPubKey) {
        console.error('❌ Missing params in callback');
        return;
      }

      try {
        // ✅ Simpan phantomPubKey supaya bisa dipakai di signMessage berikutnya
        localStorage.setItem('phantomPubKey', phantomPubKey);

        // Ambil secretKey dari Phantom service / localStorage
        let secretKey: Uint8Array | null = null;
        try {
          secretKey = this.phantom.getSecretKey();
        } catch {
          const stored = localStorage.getItem('dappSecretKey');
          if (stored) {
            secretKey = bs58.decode(stored);
            console.warn('⚡ Loaded secretKey from localStorage (service was reset).');
          }
        }

        if (!secretKey) {
          console.error('❌ No secretKey available for decrypt');
          return;
        }

        const sharedSecret = nacl.box.before(
          bs58.decode(phantomPubKey),
          secretKey
        );

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

        // === Bedakan antara CONNECT vs SIGN MESSAGE ===
        if (payload.public_key) {
          // === CONNECT result ===
          this.userAddress = payload.public_key;
          console.log('✅ Phantom mobile connected:', this.userAddress);

          if (payload.session) {
            localStorage.setItem('phantomSession', payload.session);
            console.log('💾 Saved Phantom session:', payload.session);
          }

          // Step berikutnya: ambil challenge & sign
          this.loginWithBackend(this.userAddress);

        } else if (payload.signature) {
          // === SIGN MESSAGE result ===
          console.log('✍️ Phantom signature received:', payload.signature);

          // Ambil nonce yg dipakai waktu generate deeplink signMessage
          const nonceFromLocal = localStorage.getItem('lastNonce') || '';

          this.finishLogin(this.userAddress, payload.signature, nonceFromLocal);
        }
      } catch (err) {
        console.error('❌ Error decrypting Phantom response:', err);
      }
    });
  }

  /**
   * Login ke backend setelah dapat public_key dari Phantom
   */
  async loginWithBackend(address: string) {
    console.log('⏳ Requesting login challenge from backend...');
    const challenge: any = await this.http
      .get(`${environment.apiUrl}/auth/wallet/challenge?address=${address}`)
      .toPromise();

    console.log('📜 Challenge received:', challenge);

    if (Capacitor.getPlatform() === 'web') {
      // 🖥️ Desktop: sign via Phantom extension
      const provider = (window as any).solana;
      if (!provider || !provider.isPhantom) {
        console.error('❌ Phantom extension not found.');
        return;
      }

      const messageBytes = new TextEncoder().encode(challenge.message);
      const signed = await provider.signMessage(messageBytes, 'utf8');
      const signature = signed.signature ? bs58.encode(signed.signature) : undefined;

      if (!signature) {
        console.error('❌ No signature returned from Phantom extension');
        return;
      }

      this.finishLogin(address, signature, challenge.nonce);

    } else {
      // 📱 Mobile: sign via deeplink
      try {
        const dappPubKey = this.phantom.getPublicKeyB58();
        const redirect = 'universeofgamers://phantom-callback';

        // ✅ ambil phantom pubkey dari connect callback
        const phantomPubKey = localStorage.getItem('phantomPubKey');
        if (!phantomPubKey) {
          console.error('❌ phantomPubKey not found in localStorage (connect step missing)');
          return;
        }

        // ✅ secret key dapp
        const secretKey = this.phantom.getSecretKey();
        if (!secretKey) {
          console.error('❌ No secretKey available for Phantom session');
          return;
        }

        // ✅ nonce baru khusus signMessage
        const nonceArr = nacl.randomBytes(24);
        const nonceB58 = bs58.encode(nonceArr);

        // ✅ derive shared secret dari phantom pubkey
        const sharedSecret = nacl.box.before(
          bs58.decode(phantomPubKey),
          secretKey
        );

        // ✅ build payload sesuai spesifikasi Phantom
        const session = localStorage.getItem('phantomSession');
        const payloadObj = {
          session,
          message: challenge.message,
          display: 'utf8',
        };
        const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));

        const encryptedPayload = nacl.box.after(payloadBytes, nonceArr, sharedSecret);
        const payloadB58 = bs58.encode(encryptedPayload);

        // ✅ signMessage deeplink
        const signUrl =
          `https://phantom.app/ul/v1/signMessage?` +
          `dapp_encryption_public_key=${dappPubKey}` +
          `&redirect_link=${redirect}` +
          `&nonce=${nonceB58}` +
          `&payload=${payloadB58}`;

        console.log('🔗 Open signMessage URL:', signUrl);
        window.location.href = signUrl;

      } catch (err) {
        console.error('❌ Failed to open signMessage link:', err);
      }
    }
  }

  /**
   * Kirim hasil login ke backend
   */
  finishLogin(address: string, signature: string | null, nonce: string) {
    this.auth.loginWithWallet({
      provider: 'phantom',
      address,
      name: 'Phantom User',
      signature: signature || "",   // ✅ fix TS error
      nonce,
    }).subscribe({
      next: (res) => {
        console.log('✅ Wallet login success:', res);
        this.auth.setToken(res.token, res.authId);

        localStorage.setItem('userId', res.authId);
        localStorage.setItem('walletAddress', address);

        if (res.wallets || res.custodialWallets) {
          const allWallets = [
            ...(res.wallets || []),
            ...(res.custodialWallets || [])
          ];
          localStorage.setItem('wallets', JSON.stringify(allWallets));
        }

        window.location.href = '/tabs/home';
      },
      error: (err) => {
        console.error('❌ Wallet login failed:', err);
      }
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
