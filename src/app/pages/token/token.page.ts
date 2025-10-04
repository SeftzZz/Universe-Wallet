import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Idl } from '../../services/idl';

import { WalletNftPage } from '../wallet-nft/wallet-nft.page';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';

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

import annotationPlugin from 'chartjs-plugin-annotation';
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
      ctx.fillStyle = '#999';
      ctx.fill();

      ctx.restore();
    }
};

Chart.register(annotationPlugin, crosshairPlugin);

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
  floorPrice: number;
  lastClose: number;
}

interface TokenInfoResponse {
  token: {
    name: string;
    symbol: string;
    mint: string;
    image: string;
    decimals: number;
  };
  pools: {
    liquidity: { usd: number };
    price: { usd: number };
    marketCap: { usd: number };
    market: string;
  }[];
  events: {
    [key: string]: { priceChangePercentage: number };
  };
  holders: number;
  buys: number;
  sells: number;
  txns: number;
}

@Component({
  selector: 'app-token',
  templateUrl: './token.page.html',
  styleUrls: ['./token.page.scss'],
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
export class TokenPage implements OnInit {
  program: any;

  userAddress: string | null = null;
  balance: number | null = null;
  balanceUsd: number | null = null;
  tokenPriceUsd: number | null = null;
  solPriceUsd: number | null = null;
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

  selectedTokenInfo: TokenInfoResponse | null = null;
  selectedTokenSymbol: string = 'SOL';
  selectedTokenMint: string = '';

  public chartType: ChartType = 'bar';

  public chartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: []
  };

  public chartOptions: ChartConfiguration['options'] = {
    scales: {
        x: {
            display: false,
            grid: {
                display: false,
            }
        },
        y: {
            display: false,
            beginAtZero: false,
            ticks: {
                callback: (value) => `$${Number(value).toFixed(2)}`
            }
        }
    },
    plugins: {
        legend: {
        display: false
        },
        tooltip: {
            yAlign: 'bottom',
            backgroundColor: 'rgba(222, 232, 232, 0.20)',
            callbacks: {
                label: (context) => {
                    const val = context.raw as number;
                    return `$${val.toFixed(2)}`;
                }
            }
        },
    },
    elements:{
        bar:{
            borderRadius: 20
        }                
    }
  };

  trades: any[] = [];
  showTxModal = false;
  isClosingTx = false;
  selectedTx: any = null;

  constructor(
    private http: HttpClient, 
    private idlService: Idl, 
    private router: Router, 
    private actionSheetCtrl: ActionSheetController,
    private toastCtrl: ToastController,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    this.route.paramMap.subscribe(async params => {
      let mint = params.get('mint');
      if (mint) {
        // 🔁 Jika mint = native SOL, ubah ke versi WSOL
        if (mint === "So11111111111111111111111111111111111111111") {
          mint = "So11111111111111111111111111111111111111112";
        }

        this.selectedTokenMint = mint;

        const saved = localStorage.getItem('walletAddress');
        if (saved) {
          this.userAddress = saved;
          await this.updateBalance();
          this.loadWalletTrades(mint);   // ✅ dipanggil setelah address siap
        }

        this.loadTokenData(mint);
        this.loadTokenInfo(mint);
      }
    });
  }

  loadTokenData(mint: string, interval: string = '5m') {
    this.http.get<SolResponse>(`${environment.apiUrl}/token/ohlcv?type=${interval}&mint=${mint}`).subscribe({
      next: (res) => {
        if (!res || !res.candles || res.candles.length === 0) return;

        const candles: Candle[] = res.candles;
        const prices = candles.map(c => +c.close.toFixed(2));
        this.tokenPriceUsd = parseFloat(res.lastClose.toFixed(2));
        this.chartData = {
          labels: candles.map((c: Candle) =>
            new Date(c.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          ),
          datasets: [
            {
              label: 'ATH per Candle',
              data: candles.map(c => +c.high.toFixed(2)),
              backgroundColor: '#161616',
              type: 'bar',
              order: 3
            },
            {
              label: 'Price',
              data: prices,
              borderColor: '#DDF247',
              borderWidth: 2,
              backgroundColor: 'transparent',
              fill: false,
              type: 'line',
              order: 2
            }
          ]
        };

        // ✅ Update chartOptions sesuai data
        this.chartOptions = {
          ...this.chartOptions,
          scales: {
            ...(this.chartOptions?.scales ?? {}),
            x: {
              display: false,
              grid: { display: false }
            },
            y: {
              display: false,
              beginAtZero: false,
              min: Math.min(...prices) - 1,
              max: Math.max(...prices) + 1,
              ticks: {
                callback: (value) => `$${Number(value).toFixed(2)}`
              }
            }
          },
          plugins: {
            ...(this.chartOptions?.plugins ?? {}),
            annotation: {
              annotations: {
                floorPriceLine: {
                  type: 'line',
                  yMin: res.floorPrice,
                  yMax: res.floorPrice,
                  borderColor: '#999',
                  borderWidth: 2,
                  borderDash: [6, 6],
                  label: {
                    display: false,
                    position: 'end',
                    color: '#fff',
                  }
                }
              }
            }
          }
        };
      },
      error: (err) => console.error('❌ Error fetch SOL data:', err)
    });
  }

  loadTokenInfo(mint: string) {
    this.http.get<TokenInfoResponse>(`${environment.apiUrl}/token/info?mint=${mint}`).subscribe({
      next: (info: TokenInfoResponse) => {
        this.selectedTokenInfo = info;
      },
      error: (err) => console.error('❌ Error fetch token info:', err)
    });
  }

  loadWalletTrades(mint: string) {
    if (!this.userAddress) return;

    this.http.get<any>(`${environment.apiUrl}/wallet/trades/${this.userAddress}?mint=${mint}`).subscribe({
      next: (res) => {
        this.trades = res.trades || [];
      },
      error: (err) => console.error("❌ Error fetch wallet trades:", err)
    });
  }

  getTradeType(trade: any): string {
    if (trade.from?.address && trade.to?.address) {
      return 'Swapped';
    }
    if (trade.to?.wallet === this.userAddress) {
      return 'Buy';
    }
    if (trade.from?.wallet === this.userAddress) {
      return 'Sell';
    }
    return 'Transfer';
  }

  async connectWallet() {
    try {
      const resp = await (window as any).solana.connect();
      this.userAddress = resp.publicKey.toString();

      if (this.userAddress) {
        localStorage.setItem('walletAddress', this.userAddress);
        await this.updateBalance();
      }
    } catch (err) {
      console.error('Wallet connect error', err);
    }
  }

  disconnectWallet() {
    localStorage.removeItem('walletAddress');
    this.userAddress = null;
    this.balance = null;
    this.balanceUsd = null;
    this.tokenPriceUsd = null;
    this.solPriceUsd = null;
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

      this.balance = resp.sol;
      this.balanceUsd = resp.usdValue;
      this.trend = resp.trend ?? 0;
      this.percentChange = resp.percentChange ?? 0;

    } catch (err) {
      console.error('Error fetch balance from API', err);
    }
  }

  shorten(addr: string) {
    return addr.slice(0, 7);
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
    if (!this.recipient || !this.amount) return;

    try {
      // 1️⃣ Call backend untuk build tx
      const buildRes: any = await this.http.post(`${environment.apiUrl}/wallet/send/build`, {
        from: this.userAddress,
        to: this.recipient,
        amount: this.amount,
        mint: this.selectedTokenSymbol === 'SOL'
          ? 'So11111111111111111111111111111111111111112'
          : this.selectedToken?.mint
      }).toPromise();

      // 2️⃣ Backend langsung broadcast → return signature
      this.txSig = buildRes.signature;
      console.log("✅ Transaction sent:", this.txSig);

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
        message: `Failed to send ${this.selectedTokenSymbol}`,
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

    // 1️⃣ Quote dari backend (DFLOW / Jupiter / aggregator)
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

    // 2️⃣ Build tx di backend → return base64 string
    const buildRes: any = await this.http
      .post(`${environment.apiUrl}/wallet/swap/build`, {
        from: this.userAddress,
        openTransaction: quoteRes.openTransaction,
        fromMint: this.selectedFromToken.mint,
        toMint: this.selectedToToken.mint,
      })
      .toPromise();

    if (!buildRes.tx) {
      throw new Error("❌ No tx returned from backend build step");
    }

    // 3️⃣ Minta Phantom sign → langsung passing base64
    const signed = await (window as any).solana.signTransaction(buildRes.tx);

    // 4️⃣ Submit ke backend
    const submitRes: any = await this.http
      .post(`${environment.apiUrl}/wallet/swap/submit`, {
        signedTx: signed, // langsung base64 dari Phantom
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

  openTxModal(trade: any) {
    this.selectedTx = trade;
    this.showTxModal = true;
  }

  resetTxModal() {
    this.isClosingTx = true;
    setTimeout(() => {
      this.showTxModal = false;
      this.isClosingTx = false;
      this.selectedTx = null;
    }, 300);
  }
}
