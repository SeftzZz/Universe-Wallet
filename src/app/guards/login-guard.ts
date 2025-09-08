// src/app/guards/login-guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Auth } from '../services/auth';

@Injectable({ providedIn: 'root' })
export class LoginGuard implements CanActivate {
  constructor(private auth: Auth, private router: Router) {}

  canActivate(): boolean | UrlTree {
    if (this.auth.isLoggedIn()) {
      console.log('🔄 LoginGuard → sudah login, redirect ke /tabs/home');
      return this.router.parseUrl('/tabs/home');
    }
    return true;
  }
}
