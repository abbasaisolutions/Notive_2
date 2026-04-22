/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.notive.app',
  appName: 'Notive',
  webDir: 'out',
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Body,
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notive',
      iconColor: '#8A9A6F',
    },
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
