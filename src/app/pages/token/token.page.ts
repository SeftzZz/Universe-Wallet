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
import { Router, ActivatedRoute } from '@angular/router';

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
import { Platform } from '@ionic/angular';

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

  name: string = '';
  email: string = '';
  oldPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  notifyNewItems: boolean = false;
  notifyEmail: boolean = false;
  avatarFile: File | null = null;
  avatar: string = '';

  userAddress: string | null = null;
  balance: number | null = null;
  balanceUsd: number | null = null;
  tokenPriceUsd: number | null = null;
  solPriceUsd: number | null = null;
  totalBalanceUsd: number | null = null;
  totalBalanceSol: number | null = null;
  uploadForm!: FormGroup;
  blockchainSelected: string | null = null;
  private lastBalanceUsd: number | null = null;
  trend: number = 0;          // -1 = turun, 0 = stabil, 1 = naik
  percentChange: number = 0;

  tokens: any[] = [];
  nfts: any[] = [];
  activeWallet: string = '';

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

  private loading: HTMLIonLoadingElement | null = null;

  groupedTrades: { label: string; trades: any[] }[] = [];

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
    private route: ActivatedRoute,
    private platform: Platform,
  ) {
    this.dismissLoading();

    // ✅ Deteksi tombol back HP
    this.platform.backButton.subscribeWithPriority(10, async () => {
      // Jika modal swap sedang terbuka, tutup dulu
      if (this.showSwapModal) {
        this.resetSwapModal();
        return;
      }

      // Jika modal send sedang terbuka, tutup dulu
      if (this.showSendModal) {
        this.resetSendModal();
        return;
      }

      // Kalau ada modal lain, tutup juga sesuai prioritas
      if (this.showTxModal) {
        this.closeTxModal();
        return;
      }

      // Kalau tidak ada modal aktif → navigasi kembali
      this.router.navigateByUrl('/tabs/home', { replaceUrl: false });
    });

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
    let loading: HTMLIonLoadingElement | null = null;

    try {
      // 🌀 1️⃣ Tampilkan loading sejak awal
      loading = await this.loadingCtrl.create({
        message: 'Loading token data...',
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });
      await loading.present();

      this.route.paramMap.subscribe(async (params) => {
        let mint = params.get('mint');
        if (mint) {
          // 🔁 Jika mint = native SOL, ubah ke WSOL
          if (mint === "So11111111111111111111111111111111111111111") {
            mint = "So11111111111111111111111111111111111111112";
          }

          this.selectedTokenMint = mint;

          const saved = localStorage.getItem('walletAddress');
          if (saved) {
            this.userAddress = saved;
            await this.updateBalance();

            // 🧭 2️⃣ Panggil loadWalletTrades dengan loading di dalamnya
            await this.loadWalletTrades(mint); 
          }

          // 🧩 3️⃣ Ambil data token
          await Promise.all([
            this.loadTokenData(mint),
            this.loadTokenInfo(mint)
          ]);

          // ✅ Langsung set token “From” berdasarkan param mint
          await this.setDefaultFromToken(mint);
        }
      });

      // 🔹 4️⃣ Subscribe perubahan active wallet
      this.walletService.getActiveWallet().subscribe(async (addr) => {
        if (addr) {
          this.activeWallet = addr;
          console.log('🔄 Active wallet updated in Home:', addr);

          await this.updateBalance();
          await this.loadTokens();
        }
      });

      // 🔹 5️⃣ Subscribe ke UserService untuk update avatar real-time
      this.userService.getUser().subscribe(profile => {
        this.name = profile.name;
        this.email = profile.email;
        this.notifyNewItems = profile.notifyNewItems;
        this.notifyEmail = profile.notifyEmail;
        this.avatar = profile.avatar;
      });

      // 🔹 6️⃣ Fetch user profile dari backend
      const userId = localStorage.getItem('userId');
      if (userId) {
        const res: any = await this.http.get(`${environment.apiUrl}/auth/user/${userId}`).toPromise();

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
      }
    } catch (err) {
      console.error("❌ Error during ngOnInit:", err);

      // ⚠️ Tampilkan notifikasi error
      const toast = await this.toastCtrl.create({
        message: 'Failed to load token data',
        duration: 2500,
        position: 'bottom',
        color: 'danger',
        icon: 'alert-circle-outline'
      });
      await toast.present();
    } finally {
      // 🧹 7️⃣ Pastikan loading selalu ditutup
      if (loading) await loading.dismiss();
    }
  }

  async setDefaultFromToken(mint: string) {
    // pastikan token list sudah ada
    if (!this.tokens || this.tokens.length === 0) {
      await this.loadTokens();
    }

    // cari token sesuai mint dari param
    const found = this.tokens.find(t => t.mint === mint);

    if (found) {
      this.selectedFromToken = found;
      console.log(`🔒 From token locked: ${found.symbol} (${mint})`);
    } else {
      console.warn(`⚠️ Token not found for mint ${mint}`);
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

  groupTradesByDate(trades: any[]) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const groups: Record<string, any[]> = {
      Today: [],
      Yesterday: [],
      'Last 7 Days': [],
      Older: [],
    };

    for (const t of trades) {
      if (!t.time) continue;
      const txDate = new Date(t.time);
      const diffDays = Math.floor((today.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        groups['Today'].push(t);
      } else if (diffDays === 1) {
        groups['Yesterday'].push(t);
      } else if (diffDays <= 7) {
        groups['Last 7 Days'].push(t);
      } else {
        groups['Older'].push(t);
      }
    }

    // Filter group yang kosong
    this.groupedTrades = Object.entries(groups)
      .filter(([label, list]) => list.length > 0)
      .map(([label, list]) => ({ label, trades: list.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()) }));
  }

  async loadWalletTrades(mint: string) {
    if (!this.userAddress) return;

    let loading: HTMLIonLoadingElement | null = null;

    try {
      loading = await this.loadingCtrl.create({
        message: 'Loading transactions...',
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });
      await loading.present();

      const res: any = await this.http
        .get(`${environment.apiUrl}/wallet/trades/${this.userAddress}?mint=${mint}`)
        .toPromise();

      this.trades = res?.trades || [];
      this.groupTradesByDate(this.trades);
      console.log(`✅ Loaded ${this.trades.length} transactions`);
    } catch (err) {
      console.error("❌ Error fetch wallet trades:", err);
      const toast = await this.toastCtrl.create({
        message: 'Failed to load transactions',
        duration: 2000,
        color: 'danger',
        position: 'bottom',
        icon: 'alert-circle-outline'
      });
      await toast.present();
    } finally {
      if (loading) await loading.dismiss();
    }
  }

  // 🔄 Lifecycle yang dipanggil setiap kali halaman muncul kembali
  async ionViewWillEnter() {
    console.log('🔄 Page re-entered, reloading trades...');
    this.route.paramMap.subscribe(async (params) => {
      let mint = params.get('mint');
      if (mint) {
        // 🔁 Jika mint = native SOL, ubah ke WSOL
        if (mint === "So11111111111111111111111111111111111111111") {
          mint = "So11111111111111111111111111111111111111112";
        }

        this.selectedTokenMint = mint;

        const saved = localStorage.getItem('walletAddress');
        if (saved) {
          this.userAddress = saved;
          await this.updateBalance();

          // 🧭 2️⃣ Panggil loadWalletTrades dengan loading di dalamnya
          await this.loadWalletTrades(mint); 
        }

        // 🧩 3️⃣ Ambil data token
        await Promise.all([
          this.loadTokenData(mint),
          this.loadTokenInfo(mint)
        ]);

        // ✅ Langsung set token “From” berdasarkan param mint
        await this.setDefaultFromToken(mint);
      }
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
    return 'Unknown';
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

    // Kalau sudah ada param mint (berarti token detail page)
    if (this.selectedTokenMint) {
      this.setDefaultFromToken(this.selectedTokenMint);
    }
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

  closeTxModal() {
    this.isClosingTx = true;
    setTimeout(() => {
      this.showTxModal = false;
      this.isClosingTx = false;
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

  setMaxAmount() {
    if (this.selectedFromToken) {
      this.swapAmount = this.selectedFromToken.amount;
    }
  }

  setHalfAmount() {
    if (this.selectedFromToken) {
      this.swapAmount = this.selectedFromToken.amount / 2;
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

  async dismissLoading() {
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
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
}
