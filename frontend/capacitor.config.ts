import type { CapacitorConfig } from '@capacitor/cli';

const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.notive.app',
  appName: 'Notive',
  webDir: 'out',
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
      logLevel: 1,
    },
  },
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
