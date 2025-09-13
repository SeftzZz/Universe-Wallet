import { Injectable } from '@angular/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

@Injectable({ 
  providedIn: 'root' 
})
export class GoogleLoginService {
  async loginWithGoogle() {
    try {
      const user: any = await GoogleAuth.signIn();
      console.log('✅ Google login success:', user);

      // Di mobile, langsung dapat idToken
      // Di web, token ada di authentication.id_token
      const idToken =
        user.authentication?.idToken || user.authentication?.id_token;

      return {
        name: user.name,
        email: user.email,
        photo: user.imageUrl,
        idToken,
      };
    } catch (err) {
      console.error('❌ Google login failed', err);
      throw err;
    }
  }

  async logout() {
    await GoogleAuth.signOut();
  }
}
