// src/app/guards/auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Auth } from '../services/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private auth: Auth, private router: Router) {}

  canActivate(): boolean | UrlTree {
    const loggedIn = this.auth.isLoggedIn();
    console.log('🛡️ canActivate() check →', loggedIn);

    if (loggedIn) {
      return true; // ✅ user punya token → boleh masuk
    }

    console.warn('❌ canActivate() → redirect ke /login');
    return this.router.parseUrl('/login');
  }
}
