import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastController } from '@ionic/angular';

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
  avatarFile: File | null = null;
  avatar: string = '';

  constructor(private http: HttpClient, private toastCtrl: ToastController) {}

  ngOnInit() {
    const userId = localStorage.getItem('userId');
    if (userId) {
      this.http.get(`${environment.apiUrl}/auth/user/${userId}`).subscribe((res: any) => {
        this.name = res.name;
        this.email = res.email;
        this.notifyNewItems = res.notifyNewItems || false;
        this.notifyEmail = res.notifyEmail || false;

        // 🔹 gunakan baseUrl untuk avatar
        if (res.avatar) {
          this.avatar = `${environment.baseUrl}${res.avatar}`;
        }
      });
    }
  }

  onAvatarChange(event: any) {
    this.avatarFile = event.target.files[0];
  }

  async saveAvatar() {
    if (!this.avatarFile) {
      this.showToast('❌ Please select a file first');
      return;
    }

    const userId = localStorage.getItem('userId');
    const formData = new FormData();
    formData.append('avatar', this.avatarFile);

    await this.http.post(`${environment.apiUrl}/auth/user/${userId}/avatar`, formData).toPromise();
    this.showToast('✅ Avatar updated!');
  }

  async updateProfile() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const payload = { name: this.name, email: this.email };
    await this.http.put(`${environment.apiUrl}/auth/user/${userId}/profile`, payload).toPromise();
    this.showToast('✅ Profile updated!');
  }

  async changePassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.showToast('❌ Passwords do not match');
      return;
    }

    const userId = localStorage.getItem('userId');
    const payload = { oldPassword: this.oldPassword, newPassword: this.newPassword };
    await this.http.put(`${environment.apiUrl}/auth/user/${userId}/password`, payload).toPromise();
    this.showToast('✅ Password updated!');
  }

  async updateNotifications() {
    const userId = localStorage.getItem('userId');
    const payload = { notifyNewItems: this.notifyNewItems, notifyEmail: this.notifyEmail };
    await this.http.put(`${environment.apiUrl}/auth/user/${userId}/notifications`, payload).toPromise();
    this.showToast('✅ Notification settings saved!');
  }

  private async showToast(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 2000,
      position: 'bottom',
    });
    toast.present();
  }
}
