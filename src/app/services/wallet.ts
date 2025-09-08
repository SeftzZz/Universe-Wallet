import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ 
  providedIn: 'root' 
})
export class Wallet {
  private activeWallet$ = new BehaviorSubject<string | null>(
    localStorage.getItem('walletAddress')
  );

  setActiveWallet(addr: string) {
    localStorage.setItem('walletAddress', addr);
    this.activeWallet$.next(addr);
  }

  getActiveWallet(): Observable<string | null> {
    return this.activeWallet$.asObservable();
  }
}