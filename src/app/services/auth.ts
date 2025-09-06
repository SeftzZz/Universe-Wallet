// src/app/services/auth.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class Auth {

  constructor(private http: HttpClient) {}

  // === Register Local ===
  register(data: { name: string; email: string; password: string; acceptedTerms: boolean }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/register`, data);
  }

  // === Login Local ===
  login(data: { email: string; password: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/login`, data);
  }

  // === Login with Google ===
  loginWithGoogle(data: { googleId: string; email: string; name: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/google`, data);
  }

  // === Login / Import External Wallet ===
  loginWithWallet(data: { provider: string; address: string; name?: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/wallet`, data);
  }

  // === Generate Custodial Wallet ===
  generateCustodialWallet(data: { userId: string; provider: string }): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/custodial`, data);
  }

  // === Contoh endpoint protected (pakai interceptor) ===
  getProfile(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/auth/profile`);
  }

  // === Token Management ===
  setToken(token: string, userId: string) {
    localStorage.setItem('token', token);
    localStorage.setItem('authId', userId);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getAuthId(): string | null {
    return localStorage.getItem('authId');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('authId');
  }
}
