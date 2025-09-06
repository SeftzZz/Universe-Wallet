import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { environment } from '../../../environments/environment';
import { Transaction } from '@solana/web3.js';
import { Idl } from '../../services/idl';

import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-wallet-nft',
  templateUrl: './wallet-nft.page.html',
  styleUrls: ['./wallet-nft.page.scss'],
  standalone: false,
})
export class WalletNftPage implements OnInit {
  program: any;

  userAddress: string | null = null;
  balance: number | null = null;
  balanceUsd: number | null = null;
  uploadForm!: FormGroup;
  blockchainSelected: string | null = null;
  private lastBalanceUsd: number | null = null;
  trend: number = 0;          // -1 = turun, 0 = stabil, 1 = naik
  percentChange: number = 0;

  tokens: any[] = [];
  nfts: any[] = [];

  constructor(private http: HttpClient, private idlService: Idl, private modalCtrl: ModalController) {}

  async ngOnInit() {
    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.userAddress = saved;
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
    this.userAddress = null;
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

      this.balance = resp.sol;
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

    } catch (err) {
      console.error('Error fetch tokens from API', err);
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
}
