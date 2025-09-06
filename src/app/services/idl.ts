// src/app/services/idl.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class Idl {
  constructor(private http: HttpClient) {}

  async loadProgram(): Promise<any> {
    console.log('🔄 Fetching IDL...');
    const idl = await this.http
      .get('assets/idl/uog_marketplace.json', {
        headers: { 'Cache-Control': 'no-cache' }
      })
      .toPromise();
    console.log('✅ IDL fetched:', idl);
    return {
      ...idl,
      address: environment.programId
    };
  }
}
