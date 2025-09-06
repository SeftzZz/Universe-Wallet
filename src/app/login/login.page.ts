import { Component, OnInit } from '@angular/core';
import { Auth } from '../services/auth';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { environment } from '../../environments/environment';

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

  constructor(
    private auth: Auth,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    const saved = localStorage.getItem('walletAddress');
    if (saved) {
      this.userAddress = saved;
      this.updateBalance();
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

    const payload = { email: this.email, password: this.password };

    this.auth.login(payload).subscribe({
      next: (res) => {
        console.log('✅ Login success:', res);
        this.auth.setToken(res.token, res.authId);
        this.showToast('Login success 🎉', 'success');
        this.clearForm();
        this.router.navigate(['/tabs/home']);
      },
      error: (err) => {
        console.error('❌ Login failed:', err);
        this.showToast(err.error?.error || 'Login failed', 'danger');
      },
    });
  }

  // === Phantom Wallet connect + login ===
  async connectWallet() {
    try {
      const resp = await (window as any).solana.connect();
      this.userAddress = resp.publicKey.toString();

      if (this.userAddress) {
        // === login ke backend pakai wallet ===
        this.auth.loginWithWallet({
          provider: 'phantom',
          address: this.userAddress,
          name: 'Phantom User'   // opsional
        }).subscribe({
          next: (res) => {
            console.log('✅ Wallet login success:', res);

            // simpan token & authId
            this.auth.setToken(res.token, res.authId);

            // simpan juga walletAddress (untuk balance dsb)
            localStorage.setItem('walletAddress', this.userAddress);

            this.showToast('Wallet connected ✅', 'success');
            this.router.navigate(['/tabs/home']);
          },
          error: (err) => {
            console.error('❌ Wallet login failed:', err);
            this.showToast(err.error?.error || 'Wallet login failed', 'danger');
          }
        });
      }
    } catch (err) {
      console.error('Wallet connect error', err);
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
      const connection = new Connection(environment.rpcUrl, 'confirmed');
      const pubkey = new PublicKey(this.userAddress);
      const lamports = await connection.getBalance(pubkey);
      this.balance = lamports / LAMPORTS_PER_SOL;
    } catch (err) {
      console.error('Error fetch balance', err);
      this.showToast('Error fetch balance', 'danger');
    }
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
}
