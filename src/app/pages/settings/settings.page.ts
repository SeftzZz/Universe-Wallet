import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastController, LoadingController, AlertController } from '@ionic/angular';
import { User, UserProfile } from '../../services/user';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit {
  name: string = '';
  email: string = '';
  oldPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  notifyNewItems: boolean = false;
  notifyEmail: boolean = false;
  recoveryPhrase: string = '';
  privateKey: string = '';
  avatarFile: File | null = null;
  avatar: string = '';
  fileName: string = 'No files selected';
  private loading: HTMLIonLoadingElement | null = null;

  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;

  profile!: UserProfile;

  showPrivateKeyToggle = false;
  showRecoveryPhraseToggle = false;

  qrImage: string = '';
  otpCode: string = '';
  secretCode: string = '';
  twoFactorEnabled: boolean = false;

  constructor(
    private http: HttpClient, 
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private userService: User,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
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

  onAvatarChange(event: any) {
    this.avatarFile = event.target.files[0];
    this.fileName = this.avatarFile ? this.avatarFile.name : 'No files selected';
  }

  async saveAvatar() {
    if (!this.avatarFile) {
      this.showToast('❌ Please select a file first');
      return;
    }

    await this.presentLoading();
    const userId = localStorage.getItem('userId');
    const formData = new FormData();
    formData.append('avatar', this.avatarFile);

    try {
      const res: any = await this.http
        .post(`${environment.apiUrl}/auth/user/${userId}/avatar`, formData)
        .toPromise();

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

      this.showToast('✅ Avatar updated!');

      // 🔹 reset input file & label
      this.avatarFile = null;
      this.fileName = 'No files selected';
      if (this.avatarInput) {
        this.avatarInput.nativeElement.value = '';
      }
      await this.dismissLoading();
    } catch (err: any) {
      console.error('❌ Error updating avatar:', err);
      this.showToast('❌ Failed to update avatar');
    }
  }

  async updateProfile() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const payload = { name: this.name, email: this.email };

    try {
      const res: any = await this.http
        .put(`${environment.apiUrl}/auth/user/${userId}/profile`, payload)
        .toPromise();

      this.showToast('✅ Profile updated!');

      // kalau ada update name/email sukses, sinkronkan ke service juga
      this.userService.setUser({
        name: res.name ?? this.name,
        email: res.email ?? this.email,
      });

    } catch (err: any) {
      console.error('❌ Profile update failed:', err);

      let msg = '❌ Failed to update profile';
      if (err.error?.error?.includes('duplicate key error')) {
        msg = '❌ Email already in use';
      }

      this.showToast(msg);
    }
  }

  async changePassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.showToast('❌ Passwords do not match');
      return;
    }

    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const payload = { oldPassword: this.oldPassword, newPassword: this.newPassword };

    try {
      await this.http
        .put(`${environment.apiUrl}/auth/user/${userId}/password`, payload)
        .toPromise();

      this.showToast('✅ Password updated!');
      // optional reset input
      this.oldPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch (err: any) {
      console.error('❌ Change password failed:', err);

      let msg = '❌ Failed to update password';
      if (err.error?.error?.toLowerCase().includes('old password')) {
        msg = '❌ Old password is incorrect';
      }

      this.showToast(msg);
    }
  }

  async updateNotifications() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const payload = {
      notifyNewItems: this.notifyNewItems,
      notifyEmail: this.notifyEmail,
    };

    try {
      await this.http
        .put(`${environment.apiUrl}/auth/user/${userId}/notifications`, payload)
        .toPromise();

      this.showToast('✅ Notification settings saved!');
    } catch (err: any) {
      console.error('❌ Update notifications failed:', err);

      let msg = '❌ Failed to save notification settings';
      if (err.error?.error?.toLowerCase().includes('duplicate')) {
        msg = '❌ Conflict while saving notification settings';
      }

      this.showToast(msg);
    }
  }

  private async showToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2500,
      position: "bottom",
      cssClass: "custom-toast",
    });
    toast.present();
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

  async showSecretPrompt(type: 'privateKey' | 'recovery') {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Access',
      message: 'Enter password, 6-digit OTP, and a passphrase to protect your secret',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Password',
        },
        {
          name: 'otpCode',
          type: 'text',
          placeholder: '6-digit OTP',
          attributes: { inputmode: 'numeric', maxlength: 6 }
        },
        {
          name: 'passphrase',
          type: 'password',
          placeholder: 'Custom passphrase (only you know)',
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: async (data) => {
            if (!data.password || !data.otpCode || !data.passphrase) {
              this.showToast('❌ Password, OTP, and passphrase are required');
              return false;
            }

            if (type === 'privateKey') {
              await this.fetchPrivateKey(data.password, data.otpCode, data.passphrase);
            } else {
              await this.fetchRecoveryPhrase(data.password, data.otpCode, data.passphrase);
            }
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  async fetchPrivateKey(password: string, otpCode: string, passphrase: string) {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    const walletAddress = localStorage.getItem('walletAddress');

    if (!userId || !token || !walletAddress) {
      this.showToast('❌ Missing user or wallet data');
      return;
    }

    try {
      const res: any = await this.http.post(
        `${environment.apiUrl}/auth/user/${userId}/export/private`,
        { address: walletAddress, password, otpCode, passphrase },
        { headers: { Authorization: `Bearer ${token}` } }
      ).toPromise();

      // ✅ terima encryptedKey, bukan raw privateKey
      const encryptedKey = res.encryptedKey;

      // decrypt di FE pakai passphrase
      this.privateKey = await this.decryptWithPassphrase(res.encryptedKey, passphrase);
      this.showToast('✅ Private key decrypted locally');

      setTimeout(() => {
        this.privateKey = '';
        this.showToast('🔒 Private key auto-hidden');
      }, 30000);

    } catch (err: any) {
      console.error('❌ Failed to fetch private key:', err);
      this.showToast(err.error?.error || '❌ Failed to fetch private key');
    }
  }

  async fetchRecoveryPhrase(password: string, otpCode: string, passphrase: string) {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    const walletAddress = localStorage.getItem('walletAddress');

    if (!userId || !token || !walletAddress) {
      this.showToast('❌ Missing user or wallet data');
      return;
    }

    try {
      const res: any = await this.http.post(
        `${environment.apiUrl}/auth/user/${userId}/export/phrase`,
        { address: walletAddress, password, otpCode, passphrase }, // ✅ kirim passphrase juga
        { headers: { Authorization: `Bearer ${token}` } }
      ).toPromise();

      // ✅ decrypt lokal sama kayak privateKey
      this.recoveryPhrase = await this.decryptWithPassphrase(res.recoveryPhrase, passphrase);
      this.showToast('✅ Recovery phrase decrypted locally');

      setTimeout(() => {
        this.recoveryPhrase = '';
        this.showToast('🔒 Recovery phrase auto-hidden');
      }, 30000);
    } catch (err: any) {
      console.error('❌ Failed to fetch recovery phrase:', err);
      this.showToast(err.error?.error || '❌ Failed to fetch recovery phrase');
    }
  }

  // helper untuk convert base64 → ArrayBuffer
  base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // helper untuk convert ArrayBuffer → string utf8
  arrayBufferToString(buffer: ArrayBuffer): string {
    return new TextDecoder().decode(buffer);
  }

  // ✅ Decrypt pakai Web Crypto API
  async decryptWithPassphrase(encryptedBase64: string, passphrase: string): Promise<string> {
    const raw = this.base64ToArrayBuffer(encryptedBase64);
    const data = new Uint8Array(raw);

    // sesuai backend: [iv(16)][tag(16)][ciphertext]
    const iv = data.slice(0, 16);
    const tag = data.slice(16, 32);
    const ciphertext = data.slice(32);

    // gabungkan ciphertext + tag → sesuai format WebCrypto
    const cipherAndTag = new Uint8Array(ciphertext.length + tag.length);
    cipherAndTag.set(ciphertext, 0);
    cipherAndTag.set(tag, ciphertext.length);

    // derive key dari passphrase (sha256)
    const passphraseKey = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(passphrase)
    );

    const key = await window.crypto.subtle.importKey(
      "raw",
      passphraseKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipherAndTag
    );

    return new TextDecoder().decode(decrypted);
  }

  async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('📋 Copied to clipboard!');
    } catch (err) {
      console.error('❌ Failed to copy:', err);
      this.showToast('❌ Failed to copy text');
    }
  }

  async toggle2FA(event: any) {
    if (event.target.checked) {
      await this.setup2FA();
    } else {
      this.showToast('⚠️ Disable 2FA not implemented yet');
      this.twoFactorEnabled = true; // reset supaya tidak langsung uncheck
    }
  }

  async setup2FA() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    if (!userId || !token) {
      this.showToast('❌ User not logged in');
      return;
    }

    try {
      const res: any = await this.http.post(
        `${environment.apiUrl}/auth/user/${userId}/2fa/setup`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      ).toPromise();

      this.qrImage = res.qr;
      this.secretCode = res.secret; 
      this.showToast('📲 Scan QR dengan Google Authenticator');
    } catch (err: any) {
      console.error('❌ Setup 2FA gagal:', err);
      this.showToast(err.error?.error || '❌ Setup 2FA gagal');
    }
  }

  async onSubmit2FA() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    if (!userId || !token) {
      this.showToast('❌ User not logged in');
      return;
    }

    try {
      const res: any = await this.http.post(
        `${environment.apiUrl}/auth/user/${userId}/2fa/verify`,
        { otpCode: this.otpCode },
        { headers: { Authorization: `Bearer ${token}` } }
      ).toPromise();

      this.twoFactorEnabled = true;
      this.qrImage = '';
      this.otpCode = '';
      this.showToast('✅ 2FA berhasil diaktifkan');
    } catch (err: any) {
      console.error('❌ Verifikasi 2FA gagal:', err);
      this.showToast(err.error?.error || '❌ Verifikasi 2FA gagal');
    }
  }
}
