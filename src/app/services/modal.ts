import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

@Injectable({ 
  providedIn: 'root' 
})
export class Modal {
  private accountsModalSubject = new BehaviorSubject<boolean>(false);
  accountsModal$ = this.accountsModalSubject.asObservable();

  openAccountsModal() { this.accountsModalSubject.next(true); }
  closeAccountsModal() { this.accountsModalSubject.next(false); }
}