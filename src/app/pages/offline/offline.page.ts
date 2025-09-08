import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-offline',
  templateUrl: './offline.page.html',
  styleUrls: ['./offline.page.scss'],
  standalone: false,
})
export class OfflinePage implements OnInit {

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
  }

  async reconnect() {
    try {
      // coba hit endpoint sederhana
      await this.http.get(`${environment.apiUrl}/ping`).toPromise();

      // kalau sukses, redirect ke halaman utama
      this.router.navigateByUrl('/tabs/home');
    } catch (err) {
      console.error("❌ Still offline:", err);
      // bisa tambahkan toast error
      const toast = await this.toastCtrl.create({
        message: 'Still offline, please try again.',
        duration: 2000,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
    }
  }

}
