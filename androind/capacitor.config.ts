import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.navalbrainarena.mobile',
  appName: 'androind',
  webDir: 'www',
  server: {
    cleartext: true,
    androidScheme: 'http',
    allowNavigation: ['192.168.1.176', 'localhost']
  }
};

export default config;
