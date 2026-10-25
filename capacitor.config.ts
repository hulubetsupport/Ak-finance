import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.akfinance.paymentdesk',
  appName: 'Ak Finance',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    Keyboard: {
      resize: 'body',
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#14503F',
      showSpinner: false,
    },
  },
};

export default config;
