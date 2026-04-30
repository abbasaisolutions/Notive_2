import { afterEach, describe, expect, it } from 'vitest';
import {
    BUNDLED_GOOGLE_ANDROID_CLIENT_IDS,
    BUNDLED_GOOGLE_WEB_CLIENT_IDS,
} from '../config/google-oauth-clients';
import { resolveGoogleClientIds } from './google-auth';

const ENV_KEYS = [
    'GOOGLE_CLIENT_IDS',
    'GOOGLE_ANDROID_CLIENT_IDS',
    'GOOGLE_IOS_CLIENT_IDS',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_WEB_CLIENT_ID',
    'GOOGLE_ANDROID_CLIENT_ID',
    'GOOGLE_IOS_CLIENT_ID',
    'NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
    'NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID',
    'GOOGLE_INCLUDE_BUNDLED_CLIENT_IDS',
] as const;

const originalEnv = new Map<string, string | undefined>(
    ENV_KEYS.map((key) => [key, process.env[key]])
);

const restoreEnv = () => {
    for (const key of ENV_KEYS) {
        const originalValue = originalEnv.get(key);
        if (originalValue === undefined) {
            delete process.env[key];
            continue;
        }

        process.env[key] = originalValue;
    }
};

afterEach(() => {
    restoreEnv();
});

describe('resolveGoogleClientIds', () => {
    it('includes bundled Notive web and Android OAuth clients by default', () => {
        for (const key of ENV_KEYS) {
            delete process.env[key];
        }

        expect(resolveGoogleClientIds()).toEqual([
            ...BUNDLED_GOOGLE_WEB_CLIENT_IDS,
            ...BUNDLED_GOOGLE_ANDROID_CLIENT_IDS,
        ]);
    });

    it('accepts Android-specific env client IDs and de-duplicates values', () => {
        process.env.GOOGLE_INCLUDE_BUNDLED_CLIENT_IDS = 'false';
        process.env.GOOGLE_CLIENT_IDS = '1234567890-webslug.apps.googleusercontent.com';
        process.env.GOOGLE_ANDROID_CLIENT_IDS = [
            '1234567890-androidone.apps.googleusercontent.com',
            '1234567890-webslug.apps.googleusercontent.com',
        ].join(',');

        expect(resolveGoogleClientIds()).toEqual([
            '1234567890-webslug.apps.googleusercontent.com',
            '1234567890-androidone.apps.googleusercontent.com',
        ]);
    });

    it('splits comma-separated singular env values for Railway misconfiguration tolerance', () => {
        process.env.GOOGLE_INCLUDE_BUNDLED_CLIENT_IDS = 'false';
        process.env.GOOGLE_CLIENT_ID = [
            '1234567890-webone.apps.googleusercontent.com',
            '1234567890-webtwo.apps.googleusercontent.com',
        ].join(',');

        expect(resolveGoogleClientIds()).toEqual([
            '1234567890-webone.apps.googleusercontent.com',
            '1234567890-webtwo.apps.googleusercontent.com',
        ]);
    });

    it('can be restricted to env-provided OAuth clients', () => {
        for (const key of ENV_KEYS) {
            delete process.env[key];
        }
        process.env.GOOGLE_INCLUDE_BUNDLED_CLIENT_IDS = 'false';
        process.env.GOOGLE_CLIENT_ID = '1234567890-webonly.apps.googleusercontent.com';

        expect(resolveGoogleClientIds()).toEqual([
            '1234567890-webonly.apps.googleusercontent.com',
        ]);
    });
});
