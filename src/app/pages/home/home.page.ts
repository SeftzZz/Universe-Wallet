import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { environment } from '../../../environments/environment';
import { Transaction } from '@solana/web3.js';
import { Idl } from '../../services/idl';

import { WalletNftPage } from '../wallet-nft/wallet-nft.page';
import { Router } from '@angular/router';

import { ActionSheetController } from '@ionic/angular';
import { ToastController } from '@ionic/angular';
import {
  trigger,
  transition,
  style,
  animate
} from '@angular/animations';

import {
  ChartConfiguration,
  ChartType,
} from 'chart.js';

import { Chart } from 'chart.js';

const crosshairPlugin = {
    id: 'crosshair',
    afterDraw: (chart: Chart) => {
      // pastikan tooltip aktif dan punya element
      const tooltip = chart.tooltip;
      if (!tooltip) return;
      const activeElements = tooltip.getActiveElements();
      if (!activeElements || activeElements.length === 0) return;

      const ctx = chart.ctx;
      const activePoint = activeElements[0];
      const { x, y } = activePoint.element;

      // akses scales dengan bracket agar TypeScript aman
      const yAxis = chart.scales['y'];
      const xAxis = chart.scales['x'];

      if (!yAxis || !xAxis) return;

      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#999';

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(x, yAxis.top);
      ctx.lineTo(x, yAxis.bottom);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(xAxis.left, y);
      ctx.lineTo(xAxis.right, y);
      ctx.stroke();

      // Dot at intersection
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();

      ctx.restore();
    }
};

Chart.register(crosshairPlugin);

interface Candle {
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  time: number;
}

interface SolResponse {
  candles: Candle[];
  athToday: number;
  athGlobal: number;
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
  uploadForm!: FormGroup;
  blockchainSelected: string | null = null;
  private lastBalanceUsd: number | null = null;
  trend: number = 0;          // -1 = turun, 0 = stabil, 1 = naik
  percentChange: number = 0;

  tokens: any[] = [];
  nfts: any[] = [];

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
  
  constructor(
    private http: HttpClient, 
    private idlService: Idl, 
    private router: Router, 
    private actionSheetCtrl: ActionSheetController,
    private toastCtrl: ToastController
  ) {}

 async ngOnInit() {
    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.userAddress = saved;

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
    }
  }

  async loadTokens() {
    if (!this.userAddress) return;
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/tokens/${this.userAddress}`)
        .toPromise();

      this.tokens = resp.tokens || [];

      // 3️⃣ simpan ke localStorage untuk cache
      localStorage.setItem('walletTokens', JSON.stringify(this.tokens));

    } catch (err) {
      console.error('Error fetch tokens from API', err);

      // kalau API error, fallback ke cache
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
    if (!this.userAddress) return;
    try {
      const resp: any = await this.http
        .get(`${environment.apiUrl}/wallet/nfts/${this.userAddress}`)
        .toPromise();

      this.nfts = resp || [];

    } catch (err) {
      console.error('Error fetch NFTs from API', err);
    }
  }

  shorten(addr: string) {
    return addr.slice(0, 7);
  }

  async walletNft() {
    this.router.navigate(['/tabs/wallet-nft']);
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
    if (this.showSendModal) {
      // tutup pakai animasi slide-down
      this.isClosingSend = true;
      setTimeout(() => {
        this.showSendModal = false;
        this.isClosingSend = false;
      }, 300);
    } else {
      this.showSendModal = true;
    }
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
      // ✅ Validasi recipient address
      try {
        new PublicKey(this.recipient);
      } catch (e) {
        const toast = await this.toastCtrl.create({
          message: 'Invalid Solana address',
          duration: 2000,
          position: 'bottom',
          color: 'danger',
          icon: 'close-circle-outline',
          cssClass: 'custom-toast'
        });
        await toast.present();
        return;
      }

      // ✅ Validasi balance
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

      // 👉 Step 3: show loading
      this.isSending = true;
      this.txSig = null;
      console.log(`🚀 Sending ${this.amount} ${this.selectedToken.symbol} to ${this.recipient}`);

      // 1️⃣ Minta unsigned tx dari backend
      const buildRes: any = await this.http.post(`${environment.apiUrl}/wallet/send/build`, {
        from: this.userAddress,
        to: this.recipient,
        amount: this.amount,
        mint: token.mint
      }).toPromise();

      const unsignedTx = Transaction.from(Buffer.from(buildRes.tx, "base64"));

      // 2️⃣ Sign di Phantom
      const signedTx = await (window as any).solana.signTransaction(unsignedTx);

      // 3️⃣ Kirim signed tx ke backend untuk broadcast
      const submitRes: any = await this.http.post(`${environment.apiUrl}/wallet/send/submit`, {
        signedTx: Buffer.from(signedTx.serialize()).toString("base64")
      }).toPromise();

      this.txSig = submitRes.signature; // tx signature dari backend

      // ✅ Success toast
      const toast = await this.toastCtrl.create({
        message: `Transaction successful!`,
        duration: 2500,
        position: 'bottom',
        color: 'success',
        icon: 'checkmark-circle-outline',
        cssClass: 'custom-toast'
      });
      await toast.present();

    } catch (err) {
      console.error(err);
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
  }

  selectToToken(token: any) {
    this.selectedToToken = token;
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

      // 1️⃣ Call backend to get DFLOW quote
      const quoteRes: any = await this.http
        .post(`${environment.apiUrl}/wallet/swap/quote`, {
          from: this.userAddress,
          fromMint: this.selectedFromToken.mint,
          toMint: this.selectedToToken.mint,
          amount: this.swapAmount,
        })
        .toPromise();

      console.log("✅ DFLOW Quote response:", quoteRes);

      if (!quoteRes.openTransaction) {
        throw new Error("❌ No openTransaction returned from backend");
      }

      // 2️⃣ Build tx for UOG marketplace program
      const buildRes: any = await this.http
        .post(`${environment.apiUrl}/wallet/swap/build`, {
          from: this.userAddress,
          openTransaction: quoteRes.openTransaction, // gunakan DFLOW openTransaction
          fromMint: this.selectedFromToken.mint,
          toMint: this.selectedToToken.mint,
        })
        .toPromise();

      const unsignedTx = Transaction.from(Buffer.from(buildRes.tx, "base64"));

      // 3️⃣ Sign with Phantom
      const signedTx = await (window as any).solana.signTransaction(unsignedTx);

      // 4️⃣ Submit to backend
      const submitRes: any = await this.http
        .post(`${environment.apiUrl}/wallet/swap/submit`, {
          signedTx: Buffer.from(signedTx.serialize()).toString("base64"),
        })
        .toPromise();

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
