import { describe, expect, it } from 'vitest';
import { normalizeNativeGoogleSsoError } from './native-google-auth';

describe('normalizeNativeGoogleSsoError', () => {
    it('treats status code 16 as a canceled sign-in instead of account reauth', () => {
        expect(
            normalizeNativeGoogleSsoError({ code: 16, message: 'Google Sign-In failed: 16' }).message
        ).toBe('Google sign-in did not finish on this device. Choose the account again and try once more.');
    });

    it('treats Android account reauth failed messages as an Android build configuration problem', () => {
        expect(
            normalizeNativeGoogleSsoError(new Error('GetCredentialCancellationException: [16] Account reauth failed')).message
        ).toBe("Google sign-in is temporarily unavailable on this Android build because the app's Google connection needs to be refreshed. Please try again in a moment or contact support.");
    });

    it('treats sync-account failures as an Android build configuration problem', () => {
        expect(
            normalizeNativeGoogleSsoError(new Error('Unable to get sync account')).message
        ).toBe("Google sign-in is temporarily unavailable on this Android build because the app's Google connection needs to be refreshed. Please try again in a moment or contact support.");
    });

    it('turns no-credential failures into device-account guidance', () => {
        expect(
            normalizeNativeGoogleSsoError(new Error('Google Sign-In failed: No credentials available')).message
        ).toBe('No Google account was available for this device. Add a Google account in Android Settings, then try again.');
    });

    it('keeps explicit recoverable-auth messaging as device-account guidance', () => {
        expect(
            normalizeNativeGoogleSsoError(new Error('Recoverable auth required for selected Google account')).message
        ).toBe(
            'Google sign-in still needs the Google account on this device to be active. Open Android Settings, confirm the Google account is signed in, then try again.'
        );
    });
});
