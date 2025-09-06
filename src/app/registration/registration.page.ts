import { Component, OnInit } from '@angular/core';
import { Auth } from '../services/auth';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.page.html',
  styleUrls: ['./registration.page.scss'],
  standalone: false,
})
export class RegistrationPage implements OnInit {
  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  acceptedTerms = false;

  constructor(
    private auth: Auth,
    private toastCtrl: ToastController,
    private router: Router // ✅ tambahkan Router
  ) {}

  ngOnInit() {}

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
    this.name = '';
    this.email = '';
    this.password = '';
    this.confirmPassword = '';
    this.acceptedTerms = false;
  }

  onRegister(event: Event) {
    event.preventDefault();

    if (this.password !== this.confirmPassword) {
      this.showToast('Passwords do not match!', 'danger');
      return;
    }

    const payload = {
      name: this.name,
      email: this.email,
      password: this.password,
      acceptedTerms: this.acceptedTerms,
    };

    this.auth.register(payload).subscribe({
      next: (res) => {
        console.log('✅ Register success:', res);

        // simpan token + userId
        this.auth.setToken(res.token, res.authId);

        // simpan address wallet (kalau ada di response)
        if (res.wallet && res.wallet.address) {
          localStorage.setItem('walletAddress', res.wallet.address);
          console.log('💾 Wallet address saved:', res.wallet.address);
        }

        this.showToast('Register success 🎉', 'success');
        this.clearForm();

        // redirect ke home
        this.router.navigate(['/tabs/home']);
      },
      error: (err) => {
        console.error('❌ Register failed:', err);
        this.showToast(err.error?.error || 'Register failed', 'danger');
      },
    });
  }

  onLogin() {
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        console.log('✅ Login success:', res);
        this.auth.setToken(res.token, res.authId);
        this.showToast('Login success 🎉', 'success');
        this.clearForm();

        // ✅ Redirect ke tabs/home setelah login
        this.router.navigate(['/tabs/home']);
      },
      error: (err) => {
        console.error('❌ Login failed:', err);
        this.showToast(err.error?.error || 'Login failed', 'danger');
      },
    });
  }

  onGenerateCustodial() {
    const userId = this.auth.getAuthId();
    if (!userId) {
      this.showToast('User not logged in', 'danger');
      return;
    }

    this.auth.generateCustodialWallet({ userId, provider: 'solana' }).subscribe({
      next: (res) => {
        console.log('✅ Custodial wallet created:', res);
        this.showToast(`Wallet created: ${res.wallet.address}`, 'success');
      },
      error: (err) => {
        console.error('❌ Custodial wallet error:', err);
        this.showToast(err.error?.error || 'Custodial wallet error', 'danger');
      },
    });
  }

  onLogout() {
    this.auth.logout();
    this.showToast('Logged out', 'success');
    this.clearForm();
    this.router.navigate(['/login']); // ✅ balik ke login
  }
}
