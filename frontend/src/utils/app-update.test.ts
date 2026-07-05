import { describe, expect, it } from 'vitest';
import {
    compareVersions,
    fetchAndroidUpdateConfig,
    getPlayStoreIntentUrl,
    getPlayStoreUpdateUrl,
    shouldPromptForUpdate,
} from '@/utils/app-update';

describe('app update helpers', () => {
    it('prompts when the installed version is older than the minimum required', () => {
        expect(shouldPromptForUpdate('1.2.0', { minimumVersion: '1.3.0' })).toBe(true);
    });

    it('does not prompt when the installed version meets the minimum', () => {
        expect(shouldPromptForUpdate('1.3.0', { minimumVersion: '1.3.0' })).toBe(false);
    });

    it('compares dotted versions correctly', () => {
        expect(compareVersions('1.10.0', '1.2.0')).toBeGreaterThan(0);
        expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
        expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0);
    });

    it('builds Play Store urls from the configured package name', () => {
        const config = { packageName: 'com.example.notive' };

        expect(getPlayStoreUpdateUrl(config)).toBe('https://play.google.com/store/apps/details?id=com.example.notive');
        expect(getPlayStoreIntentUrl(config)).toBe('market://details?id=com.example.notive');
    });

    it('uses a configured update url when present', () => {
        expect(getPlayStoreUpdateUrl({ updateUrl: 'https://example.com/update' })).toBe('https://example.com/update');
    });

    it('fetches Android update policy from the runtime API', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => new Response(JSON.stringify({
            android: {
                minimumVersion: '2.0.0',
                packageName: 'com.example.notive',
            },
        }), { status: 200 })) as typeof fetch;

        try {
            await expect(fetchAndroidUpdateConfig('https://api.example.com/api/v1')).resolves.toEqual({
                minimumVersion: '2.0.0',
                packageName: 'com.example.notive',
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
