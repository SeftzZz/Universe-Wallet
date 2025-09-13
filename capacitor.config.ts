import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.universeofgamers.wallet',
  appName: 'universe-wallet',
  webDir: 'www',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    App: {
      urlSchemes: ['universeofgamers']
    },
    StatusBar: {
      overlaysWebView: false
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '542126096811-asmbfaoqgk3itq0amjjn85q4qvabl3aa.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  }
};

export default config;
