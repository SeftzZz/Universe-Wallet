import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CustodialWallet {
  provider: string;
  address: string;
}

export interface UserProfile {
  name: string;
  email: string;
  notifyNewItems: boolean;
  notifyEmail: boolean;
  avatar: string;
  custodialWallets: CustodialWallet[];
}

@Injectable({
  providedIn: 'root'
})
export class User {
  private user$ = new BehaviorSubject<UserProfile>({
    name: '',
    email: '',
    notifyNewItems: false,
    notifyEmail: false,
    avatar: 'assets/images/avatar/avatar-07.png',
    custodialWallets: []
  });

  setUser(profile: Partial<UserProfile>) {
    const current = this.user$.getValue();
    const updated = { ...current, ...profile };
    this.user$.next(updated);

    // simpan ke localStorage
    localStorage.setItem('userProfile', JSON.stringify(updated));
  }

  getUser(): Observable<UserProfile> {
    return this.user$.asObservable();
  }

  // optional: load dari localStorage saat init service
  loadFromStorage() {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      this.user$.next(JSON.parse(stored));
    }
  }

  private avatar$ = new BehaviorSubject<string>('assets/images/avatar/avatar-07.png');

  setAvatar(url: string) {
    this.avatar$.next(url);
    localStorage.setItem('avatar', url);
  }

  getAvatar(): Observable<string> {
    return this.avatar$.asObservable();
  }
}
