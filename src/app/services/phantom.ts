// phantom.service.ts
import { Injectable } from '@angular/core';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

@Injectable({ providedIn: 'root' })
export class Phantom {
  private dappKeys: nacl.BoxKeyPair | null = null;
  private nonce: Uint8Array | null = null;

  generateSession() {
    this.dappKeys = nacl.box.keyPair();
    this.nonce = nacl.randomBytes(24);

    console.log("🔑 [Phantom] Session generated");

    // ✅ raw array
    console.log("   > PublicKey (raw array):", Array.from(this.dappKeys.publicKey));
    console.log("   > Nonce (raw array):", Array.from(this.nonce));

    // ✅ hex
    console.log("   > PublicKey (hex):", Buffer.from(this.dappKeys.publicKey).toString("hex"));
    console.log("   > Nonce (hex):", Buffer.from(this.nonce).toString("hex"));

    // ✅ base58
    console.log("   > PublicKey (b58):", bs58.encode(this.dappKeys.publicKey));
    console.log("   > Nonce (b58):", bs58.encode(this.nonce));

    console.log("   > SecretKey (len):", this.dappKeys.secretKey.length);

    localStorage.setItem("dappSecretKey", bs58.encode(this.dappKeys.secretKey));
    localStorage.setItem("dappNonce", bs58.encode(this.nonce));

    console.log("   > Saving dappSecretKey and dappNonce to localStorage");
  }

  getPublicKeyB58() {
    if (!this.dappKeys) {
      console.error("❌ [Phantom] Tried to getPublicKeyB58 but session not initialized");
      throw new Error('Session not initialized');
    }
    const pubKeyB58 = bs58.encode(this.dappKeys.publicKey);
    console.log("📤 [Phantom] getPublicKeyB58:", pubKeyB58);
    return pubKeyB58;
  }

  getNonceB58() {
    if (!this.nonce) {
      console.error("❌ [Phantom] Tried to getNonceB58 but session not initialized");
      throw new Error('Session not initialized');
    }
    const nonceB58 = bs58.encode(this.nonce);
    console.log("📤 [Phantom] getNonceB58:", nonceB58);
    return nonceB58;
  }

  getSecretKey() {
    if (!this.dappKeys) {
      console.error("❌ [Phantom] Tried to getSecretKey but session not initialized");
      throw new Error('Session not initialized');
    }
    console.log("🔐 [Phantom] getSecretKey called (not logging value for safety)");
    return this.dappKeys.secretKey;
  }
}
