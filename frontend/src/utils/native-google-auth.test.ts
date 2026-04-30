import { describe, expect, it } from 'vitest';
import { normalizeNativeGoogleSsoError } from './native-google-auth';

describe('normalizeNativeGoogleSsoError', () => {
    it('treats status code 16 as a canceled sign-in instead of account reauth', () => {
        expect(
            normalizeNativeGoogleSsoError({ code: 16, message: 'Google Sign-In failed: 16' }).message
        ).toBe('Google sign-in did not finish on this device. Choose the account again and try once more.');
    });

    it('maps explicit reauthentication errors to the device-account guidance', () => {
        expect(
            normalizeNativeGoogleSsoError(new Error('Account reauth failed for selected Google account')).message
        ).toBe(
            'Google needs you to re-check that account on this device. Update Google Play services or remove and re-add the Google account in Android settings, then try again.'
        );
    });
});
