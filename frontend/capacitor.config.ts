import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.notive.app',
  appName: 'Notive',
  webDir: 'out',
  server: {
    // Use your computer's LAN IP for development
    url: 'http://192.168.1.101:3000',
    cleartext: true, // Allow HTTP (not HTTPS) for development
  },
};

export default config;
