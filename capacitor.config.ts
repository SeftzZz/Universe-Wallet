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
    }
  }
};

export default config;
