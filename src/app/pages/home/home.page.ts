import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Idl } from '../../services/idl';
import { Wallet } from '../../services/wallet';
import { Auth } from '../../services/auth';
import { Modal } from '../../services/modal';
import { User, UserProfile } from '../../services/user';
const web3 = require('@solana/web3.js');

import { WalletNftPage } from '../wallet-nft/wallet-nft.page';
import { Router } from '@angular/router';

import { ActionSheetController } from '@ionic/angular';
import { ToastController, LoadingController } from '@ionic/angular';
import {
  trigger,
  transition,
  style,
  animate
} from '@angular/animations';

import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of, Subject, firstValueFrom } from 'rxjs';
import { NgZone } from '@angular/core';

interface SignResponse {
  signedTx?: string;   // optional, bisa kosong saat status pending
  txId?: string;       // ID transaksi di DB
  status?: "pending" | "signed" | "failed";
  message?: string;    // optional, dari backend
}

interface SubmitResponse {
  signature: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [ // element masuk
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [ // element keluar
        style({ opacity: 1, transform: 'translateY(0)' }),
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-20px)' }))
      ])
    ])
  ]
})
export class HomePage implements OnInit {
  program: any;

  userAddress: string = '';
  balance: number | null = null;
  balanceUsd: number | null = null;
  totalBalanceUsd: number | null = null;
  totalBalanceSol: number | null = null;
  uploadForm!: FormGroup;
  blockchainSelected: string | null = null;
  private lastBalanceUsd: number | null = null;
  trend: number = 0;          // -1 = turun, 0 = stabil, 1 = naik
  percentChange: number = 0;

  tokens: any[] = [];
  nfts: any[] = [];
  trendingTokens: any[] = [];

  showReceiveSheet = false;
  isClosing = false;
  
  showSendModal = false;
  isClosingSend = false;
  recipient: string = '';
  amount: number | null = null;
  selectedToken: any = null;
  tokenSearch: string = '';
  txSig: string | null = null;   // simpan signature tx
  isSending: boolean = false;    // flag loading
  isClosingStep = false;

  showSwapModal = false;
  isClosingSwap = false;
  selectedFromToken: any = null;
  selectedToToken: any = null;
  swapAmount: number = 0;
  isSwapping = false;
  swapSearchFrom: string = '';
  swapSearchTo: string = '';

  private loading: HTMLIonLoadingElement | null = null;

  activeWallet: string = '';

  wallets: any[] = [];

  name: string = '';
  email: string = '';
  oldPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  notifyNewItems: boolean = false;
  notifyEmail: boolean = false;
  avatarFile: File | null = null;
  avatar: string = '';

  showSignModal = false;
  isClosingSign = false;
  signCompleted = false;
  signRejected = false;
  isSigning = false;
  pendingBuildTx: any = null;       // Menyimpan hasil /wallet/send/build sementara
  signedTxBase64: string | null = null;  // Menyimpan hasil tanda tangan base64
  pendingTxId: string | null = null;

  showOptionsModal = false;
  isClosingOptions = false;
  tokenSearchOptions = '';
  filteredOptionTokens: any[] = [];
  searchResults: any[] = [];
  isSearching = false;
  selectedOptionToken: any = null;
  searchInput$ = new Subject<string>();

  constructor(
    private http: HttpClient, 
    private idlService: Idl, 
    private router: Router, 
    private actionSheetCtrl: ActionSheetController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private auth: Auth,
    private walletService: Wallet,
    private modalService: Modal,
    private userService: User,
    private zone: NgZone,
  ) {
    this.dismissLoading();

    // ✅ Debounce input untuk pencarian jaringan
    this.searchInput$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((query) => this.searchTokenNetwork(query))
      )
      .subscribe({
        next: (results) => {
          // pastikan update view dilakukan di dalam zone
          this.zone.run(() => {
            this.searchResults = results;
            this.isSearching = false;
          });
        },
        error: (err) => {
          console.error('❌ Search token error', err);
          this.isSearching = false;
        },
      });
  }

  async ngOnInit() {
    // 🔹 subscribe perubahan activeWallet
    this.walletService.getActiveWallet().subscribe(async (addr) => {
      if (addr) {
        this.activeWallet = addr;
        console.log('🔄 Active wallet updated in Home:', addr);

        // refresh data setiap kali wallet diganti
        await this.updateBalance();
        await this.loadTokens();
        await this.loadNfts();
        await this.loadTrendingTokens();
      }
    });

    // subscribe ke UserService agar avatar langsung update
    this.userService.getUser().subscribe(profile => {
      this.name = profile.name;
      this.email = profile.email;
      this.notifyNewItems = profile.notifyNewItems;
      this.notifyEmail = profile.notifyEmail;
      this.avatar = profile.avatar;
    });

    const userId = localStorage.getItem('userId');
    if (userId) {
      this.http.get(`${environment.apiUrl}/auth/user/${userId}`).subscribe((res: any) => {
        const avatarUrl = res.avatar
          ? `${environment.baseUrl}${res.avatar}`
          : 'assets/images/app-logo.jpeg';

        // update service → otomatis update avatar di semua halaman
        this.userService.setUser({
          name: res.name,
          email: res.email,
          notifyNewItems: res.notifyNewItems || false,
          notifyEmail: res.notifyEmail || false,
          avatar: avatarUrl,
        });
      });
    }
  }

  private async setActiveWallet(address: string) {
    this.userAddress = address;

    // 1️⃣ cek tokens di localStorage dulu
    const cachedTokens = localStorage.getItem('walletTokens');
    if (cachedTokens) {
      try {
        this.tokens = JSON.parse(cachedTokens);
      } catch (e) {
        console.error("❌ Error parse cached tokens", e);
      }
    }

    // 2️⃣ tetap panggil server untuk update balance & tokens
    await this.updateBalance();
    await this.loadTokens();
    await this.loadNfts();
    await this.loadTrendingTokens();
  }

  ionViewWillEnter() {
    if (this.activeWallet) {
      this.updateBalance();
      this.loadTokens();
      this.loadNfts();
      this.loadTrendingTokens();
    }
  }

  async connectWallet() {
    try {
      const resp = await (window as any).solana.connect();
      this.userAddress = resp.publicKey.toString();

      if (this.userAddress) {
        localStorage.setItem('walletAddress', this.userAddress);
        await this.updateBalance();
        await this.loadTokens();
        await this.loadNfts();
      }
    } catch (err) {
      console.error('Wallet connect error', err);
    }
  }

  disconnectWallet() {
    localStorage.removeItem('walletAddress');
    this.userAddress = '';
    this.balance = null;
    this.balanceUsd = null;
    this.trend = 0;
    this.percentChange = 0;
    this.tokens = [];
  }

  async updateBalance() {
    if (!this.activeWallet) return;
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/balance/${this.activeWallet}`)
        .toPromise();

      this.balance = resp.solTotal;
      this.balanceUsd = resp.usdValue;
      this.trend = resp.trend ?? 0;
      this.percentChange = resp.percentChange ?? 0;

    } catch (err) {
      console.error('Error fetch balance from API', err);
      this.router.navigateByUrl('/tabs/offline');
    }
  }

  async loadTokens() {
    if (!this.activeWallet) return;
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/tokens/${this.activeWallet}`)
        .toPromise();

      this.tokens = resp.tokens || [];
      this.totalBalanceUsd = resp.total;
      this.totalBalanceSol = resp.totalSol;
      localStorage.setItem('walletTokens', JSON.stringify(this.tokens));
    } catch (err) {
      console.error('Error fetch tokens from API', err);
      this.router.navigateByUrl('/tabs/offline');

      const cachedTokens = localStorage.getItem('walletTokens');
      if (cachedTokens) {
        try {
          this.tokens = JSON.parse(cachedTokens);
          console.log("⚡ Loaded tokens from cache");
        } catch (e) {
          console.error("❌ Error parse cached tokens", e);
        }
      }
    }
  }

  async loadNfts() {
    if (!this.activeWallet) return;
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/nfts/${this.activeWallet}`)
        .toPromise();

      this.nfts = resp || [];
    } catch (err) {
      console.error('Error fetch NFTs from API', err);
      this.router.navigateByUrl('/tabs/offline');
    }
  }

  async loadTrendingTokens() {
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/trending`)
        .toPromise();

      this.trendingTokens = resp.tokens || [];
      console.log('🔥 Trending tokens loaded:', this.trendingTokens.length);
    } catch (err) {
      console.error('❌ Error fetch trending tokens', err);
    }
  }

  shorten(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  async dismissLoading() {
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
  }

  async walletNft() {
    this.router.navigate(['/tabs/home']);
  }

  async toggleReceiveSheet() {
    if (this.showReceiveSheet) {
      // sedang buka → tutup dengan animasi
      this.isClosing = true;
      setTimeout(() => {
        this.showReceiveSheet = false;
        this.isClosing = false;
      }, 300); // sesuai durasi animasi
    } else {
      // buka sheet
      this.showReceiveSheet = true;
    }
  }

  async copyAddress() {
    if (!this.activeWallet) return;
    try {
      await navigator.clipboard.writeText(this.activeWallet);
      console.log('✅ Copied:', this.activeWallet);

      // tutup sheet dengan animasi slide-down
      this.toggleReceiveSheet();

      // tampilkan toast sukses dengan icon ✔
      const toast = await this.toastCtrl.create({
        message: 'Address copied to clipboard!',
        duration: 2000,
        position: 'bottom',
        color: 'light',
        icon: 'checkmark-circle-outline',
        cssClass: 'custom-toast'
      });
      await toast.present();
    } catch (err) {
      console.error('❌ Failed copy', err);
      const toast = await this.toastCtrl.create({
        message: 'Failed to copy address',
        duration: 2000,
        position: 'bottom',
        color: 'light',
        icon: 'close-circle-outline',
        cssClass: 'custom-toast'
      });
      await toast.present();
    }
  }

  toggleSendModal() {
    this.showSendModal = true;
  }

  get filteredTokens() {
    if (!this.tokenSearch) return this.tokens;
    return this.tokens.filter(t =>
      (t.symbol?.toLowerCase().includes(this.tokenSearch.toLowerCase()) ||
       t.name?.toLowerCase().includes(this.tokenSearch.toLowerCase()))
    );
  }

  selectToken(token: any) {
    this.selectedToken = token;
  }

  resetSendModal() {
    this.selectedToken = null;
    this.txSig = null;
    this.isSending = false;
    this.showSendModal = false;
    // this.toggleSendModal();
  }

  async sendToken(event: Event) {
    event.preventDefault();
    if (!this.recipient || !this.amount || !this.selectedToken) return;

    const token = this.selectedToken;

    try {
      if (this.amount > token.amount) {
        const toast = await this.toastCtrl.create({
          message: `Insufficient balance. Your ${token.symbol} balance is ${token.amount}`,
          duration: 2500,
          position: 'bottom',
          color: 'danger',
          icon: 'close-circle-outline',
          cssClass: 'custom-toast'
        });
        await toast.present();
        return;
      }

      this.isSending = true;
      this.txSig = null;

      // 🧱 1️⃣ Build unsigned transaction
      const buildRes: any = await this.http.post(
        `${environment.apiUrl}/wallet/send/build`,
        {
          from: this.activeWallet,
          to: this.recipient,
          amount: this.amount,
          mint: token.mint
        }
      ).toPromise();

      if (!buildRes?.tx) throw new Error("❌ No tx returned from backend");
      this.pendingBuildTx = buildRes;

      // 🪪 2️⃣ Request to save TX as pending (server creates txId)
      const signRes: any = await this.http.post(
        `${environment.apiUrl}/wallet/send/sign`,
        { tx: buildRes.tx, wallet: this.activeWallet }
      ).toPromise();

      console.log("📩 Sign response:", signRes);

      if (!signRes?.txId) throw new Error("❌ Missing txId from sign response");
      this.pendingTxId = signRes.txId;
      console.log("💾 Saved pendingTxId:", this.pendingTxId);

      // ✨ 3️⃣ Buka modal tanda tangan setelah txId tersimpan
      this.toggleSignModal();
      this.signCompleted = false;
      this.signRejected = false;

      // 4️⃣ Kalau status pending → tunggu manual sign
      if (signRes?.status === "pending") {
        console.log("⏳ Waiting for manual signature...");

        let signedTx: string | null = null;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));

          const statusRes: any = await this.http
            .get(`${environment.apiUrl}/wallet/send/status/${this.pendingTxId}`)
            .toPromise();

          console.log(`... still waiting signature ${i}`);

          if (statusRes?.status === "signed" && statusRes?.signedTx) {
            console.log("✅ Signature found!");
            signedTx = statusRes.signedTx;
            this.signCompleted = true;
            break;
          }
        }

        if (!signedTx) throw new Error("Timeout waiting for signature");
        this.signedTxBase64 = signedTx;
      } 
      else if (signRes?.signedTx) {
        // langsung signed
        this.signCompleted = true;
        this.signedTxBase64 = signRes.signedTx;
      } 
      else {
        throw new Error("❌ Signing failed");
      }

      // 🔄 5️⃣ Submit signed transaction ke backend
      const submitRes = await this.http.post<SubmitResponse>(
        `${environment.apiUrl}/wallet/send/submit`,
        { signedTx: this.signedTxBase64 }
      ).toPromise();

      if (!submitRes?.signature) throw new Error("❌ No signature from submit response");
      this.txSig = submitRes.signature;

      // 🔃 6️⃣ Refresh balance & token list
      await this.updateBalance();
      await this.loadTokens();
      this.closeSignModal();

      // ✅ 7️⃣ Notifikasi sukses
      const toast = await this.toastCtrl.create({
        message: `Transaction successful! ✅`,
        duration: 2500,
        position: 'bottom',
        color: 'success',
        icon: 'checkmark-circle-outline',
        cssClass: 'custom-toast'
      });
      await toast.present();

    } catch (err: any) {
      console.error("❌ sendToken error:", err);
      const toast = await this.toastCtrl.create({
        message: err.message || `Failed to send ${token.symbol}`,
        duration: 2500,
        position: 'bottom',
        color: 'danger',
        icon: 'close-circle-outline',
        cssClass: 'custom-toast'
      });
      await toast.present();
    } finally {
      this.isSending = false;
    }
  }

  async closeForm() {
    this.isClosingStep = true;
    await new Promise(r => setTimeout(r, 400)); // delay animasi
    this.isClosingStep = false;
    this.selectedToken = null;
  }

  toggleSwapModal() {
    this.showSwapModal = true;
  }

  resetSwapModal() {
    this.isClosingSwap = true;
    setTimeout(() => {
      this.showSwapModal = false;
      this.isClosingSwap = false;
      this.selectedFromToken = null;
      this.selectedToToken = null;
      this.swapAmount = 0;
      this.isSwapping = false;
      this.txSig = null;
    }, 300);
  }

  selectFromToken(token: any) {
    this.selectedFromToken = token;
    this.swapAmount = 0;
  }

  selectToToken(token: any) {
    this.selectedToToken = token;
    this.swapAmount = 0;
  }

  setHalfAmount() {
    if (this.selectedFromToken) {
      this.swapAmount = this.selectedFromToken.amount / 2;
    }
  }

  setMaxAmount() {
    if (this.selectedFromToken) {
      this.swapAmount = this.selectedFromToken.amount;
    }
  }

  async swapTokens(event: Event) {
    event.preventDefault();

    if (
      !this.swapAmount ||
      this.swapAmount <= 0 ||
      this.swapAmount > this.selectedFromToken.amount
    ) {
      return;
    }

    try {
      this.isSwapping = true;
      this.txSig = null;

      const WSOL_MINT = "So11111111111111111111111111111111111111112";
      const DUMMY_SOL_MINT = "So11111111111111111111111111111111111111111";

      const normalizeMint = (mint: string) =>
        mint === DUMMY_SOL_MINT ? WSOL_MINT : mint;

      // 🧱 1️⃣ Get Quote
      const quoteRes: any = await this.http.post(
        `${environment.apiUrl}/wallet/swap/quote`,
        {
          from: this.activeWallet,
          fromMint: normalizeMint(this.selectedFromToken.mint),
          toMint: normalizeMint(this.selectedToToken.mint),
          amount: this.swapAmount,
        }
      ).toPromise();

      if (!quoteRes?.openTransaction)
        throw new Error("❌ No openTransaction from backend");

      // 🧱 2️⃣ Build Unsigned Transaction
      const buildRes: any = await this.http.post(
        `${environment.apiUrl}/wallet/swap/build`,
        {
          from: this.activeWallet,
          openTransaction: quoteRes.openTransaction,
          toMint: normalizeMint(this.selectedToToken.mint),
          fromMint: normalizeMint(this.selectedFromToken.mint),
          inAmount: quoteRes.inAmount,
          outAmount: quoteRes.outAmount,
        }
      ).toPromise();

      if (!buildRes?.tx) throw new Error("❌ No tx returned from backend build step");
      this.pendingBuildTx = buildRes;

      // 🪪 3️⃣ Save TX as Pending (use /wallet/send/sign)
      const signRes: any = await this.http.post(
        `${environment.apiUrl}/wallet/send/sign`,
        { tx: buildRes.tx, wallet: this.activeWallet }
      ).toPromise();

      if (!signRes?.txId)
        throw new Error("❌ Missing txId from sign response");

      this.pendingTxId = signRes.txId;
      console.log("💾 Saved pendingTxId:", this.pendingTxId);

      // ✨ 4️⃣ Tampilkan modal tanda tangan
      this.toggleSignModal();
      this.signCompleted = false;
      this.signRejected = false;

      let signedTx: string | null = null;

      // ⏳ 5️⃣ Polling status signature (manual sign)
      if (signRes?.status === "pending") {
        console.log("⏳ Waiting for manual signature...");

        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));

          const statusRes: any = await this.http
            .get(`${environment.apiUrl}/wallet/send/status/${this.pendingTxId}`)
            .toPromise();

          console.log(`... waiting for signature ${i}`);

          if (statusRes?.status === "signed" && statusRes?.signedTx) {
            console.log("✅ Signature found!");
            signedTx = statusRes.signedTx;
            this.signCompleted = true;
            break;
          }
        }

        if (!signedTx) throw new Error("Timeout waiting for signature");
        this.signedTxBase64 = signedTx;
      } 
      else if (signRes?.signedTx) {
        // langsung signed
        this.signCompleted = true;
        this.signedTxBase64 = signRes.signedTx;
      } 
      else {
        throw new Error("❌ Signing failed");
      }

      // 🔄 6️⃣ Submit Signed Transaction (swap/submit)
      const submitRes: any = await this.http.post(
        `${environment.apiUrl}/wallet/swap/submit`,
        { signedTx: this.signedTxBase64 }
      ).toPromise();

      if (!submitRes?.signature)
        throw new Error("❌ No signature from submit response");

      this.txSig = submitRes.signature;

      // 🔃 7️⃣ Refresh balance & token list
      await this.updateBalance();
      await this.loadTokens();
      this.closeSignModal();

      // ✅ 8️⃣ Success Toast
      const toast = await this.toastCtrl.create({
        message: `Swap successful! ✅`,
        duration: 2500,
        position: "bottom",
        color: "success",
        icon: "checkmark-circle-outline",
        cssClass: "custom-toast",
      });
      await toast.present();

    } catch (err: any) {
      console.error("❌ swapTokens error:", err);

      const toast = await this.toastCtrl.create({
        message: err.message || `Failed to swap ${this.selectedFromToken.symbol}`,
        duration: 2500,
        position: "bottom",
        color: "danger",
        icon: "close-circle-outline",
        cssClass: "custom-toast",
      });
      await toast.present();

    } finally {
      this.isSwapping = false;
      this.closeSignModal();
    }
  }

  async toggleBuyModal() {
    const toast = await this.toastCtrl.create({
      message: `Feature Buy is comming soon !`,
      duration: 2500,
      position: "bottom",
      color: "success",
      icon: "checkmark-circle-outline",
      cssClass: "custom-toast",
    });
    await toast.present();
  }

  toggleSignModal() {
    this.showSignModal = true;
    this.signCompleted = false;
    this.signRejected = false;
  }

  closeSignModal() {
    this.isClosingSign = true;
    setTimeout(() => {
      this.showSignModal = false;
      this.isClosingSign = false;
    }, 300);
  }

  cancelSignModal() {
    this.signRejected = true;
  }

  // 🪪 Konfirmasi tanda tangan transaksi
  async confirmSign() {
    this.isSigning = true;
    try {
      console.log("=== 🪪 CONFIRM SIGN START ===");

      const buildRes: any = this.pendingBuildTx;
      console.log("🧱 Using pending build tx:", buildRes?.tx?.length || 0);

      // 🚀 Kirim request untuk simpan tx ke pending (sign = pending)
      const signRes: any = await this.http.post(
        `${environment.apiUrl}/wallet/send/sign`,
        { tx: buildRes.tx, wallet: this.activeWallet }
      ).toPromise();

      console.log("📩 Sign response:", signRes);

      // 🆕 Simpan pendingTxId lebih awal agar bisa dipakai manualSignNow()
      if (signRes?.txId) {
        this.pendingTxId = signRes.txId;
        console.log("💾 Saved pendingTxId:", this.pendingTxId);
      } else {
        console.warn("⚠️ Backend did not return txId — manual signing may fail!");
      }

      // ✅ Kalau status masih pending → tunggu sampai manual sign selesai
      if (signRes?.status === "pending") {
        console.log("⏳ Waiting for manual signature... (txId:", this.pendingTxId, ")");
        let signedTx: string | null = null;

        // loop tunggu status signed
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000)); // tunggu 2 detik per iterasi

          // 🔍 Cek status di backend
          const statusRes: any = await this.http
            .get(`${environment.apiUrl}/wallet/send/status/${this.pendingTxId}`)
            .toPromise();

          console.log(`... still waiting signature ${i}`);

          if (statusRes?.status === "signed" && statusRes?.signedTx) {
            console.log("✅ Signature found!");
            signedTx = statusRes.signedTx;
            break;
          }
        }

        if (!signedTx) throw new Error("❌ No signature after waiting.");

        this.signCompleted = true;
        this.signedTxBase64 = signedTx;
      }

      // 🧾 Jika backend langsung kirim signedTx (tanpa pending)
      else if (signRes?.signedTx) {
        this.signCompleted = true;
        this.signedTxBase64 = signRes.signedTx;
      }

      else {
        throw new Error("❌ Signing failed — no valid response from backend");
      }

      // 📤 Submit hasil tanda tangan ke blockchain
      const submitRes: any = await this.http
        .post(`${environment.apiUrl}/wallet/send/submit`, {
          signedTx: this.signedTxBase64,
        })
        .toPromise();

      console.log("📤 Submit response:", submitRes);
      this.txSig = submitRes?.signature ?? null;
      console.log("✅ Final transaction signature:", this.txSig);

    } catch (err) {
      console.error("❌ confirmSign error:", err);
      this.signRejected = true;
    } finally {
      this.isSigning = false;
    }
  }

  // ✍️ Fungsi untuk pengguna menandatangani manual dari modal
  async manualSignNow() {
    try {
      console.log("🖋️ Manual sign started...");
      console.log("Current pendingTxId:", this.pendingTxId);

      if (!this.pendingTxId) throw new Error("❌ No pending tx ID found");

      // 🪪 Kirim permintaan tanda tangan manual ke backend
      const manualSignRes: any = await this.http
        .post(`${environment.apiUrl}/wallet/send/manual-sign`, {
          txId: this.pendingTxId,
        })
        .toPromise();

      console.log("✅ Manual sign response:", manualSignRes);

      if (manualSignRes?.signedTx) {
        this.signCompleted = true;
        this.signedTxBase64 = manualSignRes.signedTx;
        console.log("✅ Transaction signed manually via modal!");
      } else {
        throw new Error("❌ No signedTx returned from manual-sign response");
      }
    } catch (err) {
      console.error("❌ manualSignNow error:", err);
      this.signRejected = true;
    }
  }

  toggleOptionsModal() {
    this.filteredOptionTokens = this.tokens;
    this.showOptionsModal = true;
  }

  resetOptionsModal() {
    this.isClosingOptions = true;
    setTimeout(() => {
      this.showOptionsModal = false;
      this.isClosingOptions = false;
      this.selectedOptionToken = null;
      this.tokenSearchOptions = '';
      this.searchResults = [];
    }, 250);
  }

  onSearchToken(event: Event) {
    event.preventDefault();
    const query = this.tokenSearchOptions.trim();
    if (!query) {
      this.searchResults = [];
      this.isSearching = false;
      return;
    }
    this.isSearching = true;
    this.searchInput$.next(query);
  }

  // 🔍 Cari token dari jaringan Solana (via Jupiter API)
  async searchTokenNetwork(query: string): Promise<any[]> {
    if (!query) return [];

    console.log(`🔍 [searchTokenNetwork] Searching token: "${query}"`);
    const startTime = Date.now();

    try {
      const resp: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/token/search?q=${encodeURIComponent(query)}`)
      );

      const elapsed = Date.now() - startTime;
      console.log(`⏱️ [searchTokenNetwork] Response time: ${elapsed} ms`);
      console.log('📦 [searchTokenNetwork] Raw response:', resp);

      // ✅ Solana Tracker pakai "data", bukan "tokens"
      const data = resp?.data || resp?.tokens || [];
      console.log(`📊 [searchTokenNetwork] Token count: ${data.length}`);

      const mapped = data.map((t: any) => ({
        name: t.name,
        symbol: t.symbol,
        mint: t.mint,
        decimals: t.decimals || 9,
        logoURI: t.image || t.logoURI || 'assets/images/box-item/rank-01.jpg',
        usdValue: t.priceUsd || 0,
        liquidity: t.liquidityUsd || 0,
        volume24h: t.volume_24h || 0,
        verified: t.verified || false,
        amount: 0,
      }));

      console.log('✅ [searchTokenNetwork] Mapped tokens:', mapped);
      return mapped;
    } catch (err) {
      console.error('❌ [searchTokenNetwork] Error searching token on network:', err);
      return [];
    }
  }

  selectOptionToken(token: any) {
    this.selectedOptionToken = token;
  }

  async addNewToken(token: any) {
    try {
      console.log("✅ Add/Manage token:", token);

      // 🔹 subscribe perubahan activeWallet
      this.walletService.getActiveWallet().subscribe(async (addr) => {
        if (addr) {
          this.activeWallet = addr;
          console.log('🔄 Active wallet updated in Home:', addr);
        }
      });
      if (!this.activeWallet) {
        return this.toastCtrl.create({
          message: "No active wallet found!",
          duration: 2000,
          color: "warning",
        }).then(t => t.present());
      }

      const payload = { address: this.activeWallet, token };
      const resp: any = await firstValueFrom(
        this.http.post(`${environment.apiUrl}/wallet/tokens/add`, payload)
      );

      console.log("💾 Token added response:", resp);

      await this.toastCtrl.create({
        message: resp?.success
          ? `${token.symbol} added to your wallet!`
          : `${token.symbol} already exists.`,
        duration: 2000,
        color: "success",
      }).then(t => t.present());
      await this.updateBalance();
      await this.loadTokens();
      this.resetOptionsModal();
    } catch (err) {
      console.error("❌ Error adding token:", err);
      await this.toastCtrl.create({
        message: "Failed to add token. Please try again.",
        duration: 2000,
        color: "danger",
      }).then(t => t.present());
    }
  }

}
