import type { CapacitorConfig } from '@capacitor/cli';

const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.notive.app',
  appName: 'Notive',
  webDir: 'out',
  ...(devServerUrl
    ? {
        server: {
          // Only use a live dev server when explicitly provided.
          url: devServerUrl,
          cleartext: /^http:\/\//i.test(devServerUrl),
        },
      }
    : {}),
};

export default config;
