import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Idl } from '../../services/idl';
import { Wallet } from '../../services/wallet';
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
  
  constructor(
    private http: HttpClient, 
    private idlService: Idl, 
    private router: Router, 
    private actionSheetCtrl: ActionSheetController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private walletService: Wallet,
  ) {
    this.dismissLoading();
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

      this.balance = resp.solBalance;
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
    if (!this.userAddress) return;
    try {
      await navigator.clipboard.writeText(this.userAddress);
      console.log('✅ Copied:', this.userAddress);

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

      const buildRes: any = await this.http.post(`${environment.apiUrl}/wallet/send/build`, {
        from: this.userAddress,
        to: this.recipient,
        amount: this.amount,
        mint: token.mint
      }).toPromise();

      if (!buildRes.tx) throw new Error("❌ No tx returned from backend");

      const tx = web3.Transaction.from(Buffer.from(buildRes.tx, "base64"));

      const signedTx = await (window as any).solana.signTransaction(tx);

      const signedTxBase64 = signedTx.serialize().toString("base64");

      const submitRes: any = await this.http.post(`${environment.apiUrl}/wallet/send/submit`, {
        signedTx: signedTxBase64
      }).toPromise();

      this.txSig = submitRes.signature;

      const toast = await this.toastCtrl.create({
        message: `Transaction successful! ✅`,
        duration: 2500,
        position: 'bottom',
        color: 'success',
        icon: 'checkmark-circle-outline',
        cssClass: 'custom-toast'
      });
      await toast.present();

    } catch (err) {
      console.error("❌ sendToken error:", err);
      const toast = await this.toastCtrl.create({
        message: `Failed to send ${token.symbol}`,
        duration: 2000,
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

      // 1️⃣ Quote
      const quoteRes: any = await this.http.post(`${environment.apiUrl}/wallet/swap/quote`, {
        from: this.userAddress,
        fromMint: this.selectedFromToken.mint,
        toMint: this.selectedToToken.mint,
        amount: this.swapAmount,
        decimals: this.selectedToToken.decimals,
      }).toPromise();

      if (!quoteRes.openTransaction) throw new Error("❌ No openTransaction from backend");

      // 2️⃣ Build tx
      const buildRes: any = await this.http.post(`${environment.apiUrl}/wallet/swap/build`, {
        from: this.userAddress,
        openTransaction: quoteRes.openTransaction,
        fromMint: this.selectedFromToken.mint,
        toMint: this.selectedToToken.mint,
      }).toPromise();

      if (!buildRes.tx) throw new Error("❌ No tx from backend build step");

      // 3️⃣ Phantom sign → pakai base64 langsung
      const tx = web3.Transaction.from(Buffer.from(buildRes.tx, "base64"));

      const signedTx = await (window as any).solana.signTransaction(tx);

      const signedTxBase64 = signedTx.serialize().toString("base64");

      // 4️⃣ Submit
      const submitRes: any = await this.http.post(`${environment.apiUrl}/wallet/swap/submit`, {
        signedTx: signedTxBase64,
      }).toPromise();

      this.txSig = submitRes.signature;

      const toast = await this.toastCtrl.create({
        message: `Swap successful! ✅`,
        duration: 2500,
        position: "bottom",
        color: "success",
        icon: "checkmark-circle-outline",
        cssClass: "custom-toast",
      });
      await toast.present();

    } catch (err) {
      console.error("❌ swap error:", err);
      const toast = await this.toastCtrl.create({
        message: `Swap failed ❌`,
        duration: 2000,
        position: "bottom",
        color: "danger",
        icon: "close-circle-outline",
        cssClass: "custom-toast",
      });
      await toast.present();
    } finally {
      this.isSwapping = false;
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
}
