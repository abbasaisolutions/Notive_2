import { SocialLogin } from '@capgo/capacitor-social-login';
import { getCredentialSsoAvailability, getGoogleIosClientId, getNativeCapacitorPlatform } from '@/utils/sso';

let googleInitPromise: Promise<void> | null = null;

const NATIVE_GOOGLE_CANCELED_FALLBACK =
    'Google sign-in did not finish on this device. Choose the account again and try once more.';
const NATIVE_GOOGLE_REAUTH_FALLBACK =
    'Google needs you to re-check that account on this device. Update Google Play services or remove and re-add the Google account in Android settings, then try again.';

const buildNativeGoogleConfig = () => {
    const availability = getCredentialSsoAvailability('google');
    const platform = getNativeCapacitorPlatform();

    if (!availability.enabled || availability.surface !== 'native' || !availability.clientId) {
        throw new Error('Google sign-in is not configured for this mobile build yet.');
    }

    return {
        webClientId: availability.clientId,
        ...(platform === 'ios' && getGoogleIosClientId()
            ? {
                iOSClientId: getGoogleIosClientId()!,
                iOSServerClientId: availability.clientId,
            }
            : {}),
        mode: 'online' as const,
    };
};

export const ensureNativeGoogleSsoInitialized = async (): Promise<void> => {
    if (googleInitPromise) {
        return googleInitPromise;
    }

    googleInitPromise = SocialLogin.initialize({
        google: buildNativeGoogleConfig(),
    }).catch((error) => {
        googleInitPromise = null;
        throw error;
    });

    return googleInitPromise;
};

const toErrorMessage = (error: unknown): string => {
    if (typeof error === 'string') {
        return error;
    }

    if (error instanceof Error) {
        return error.message;
    }

    if (error && typeof error === 'object') {
        const record = error as Record<string, unknown>;
        for (const key of ['message', 'errorMessage', 'error', 'localizedMessage']) {
            const value = record[key];
            if (typeof value === 'string' && value.trim()) {
                return value;
            }
        }
    }

    return '';
};

const toErrorCode = (error: unknown): number | null => {
    if (!error || typeof error !== 'object') {
        return null;
    }

    const record = error as Record<string, unknown>;
    for (const key of ['code', 'status', 'statusCode', 'errorCode']) {
        const value = record[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) {
            return Number.parseInt(value, 10);
        }
    }

    return null;
};

export const normalizeNativeGoogleSsoError = (error: unknown): Error => {
    const message = toErrorMessage(error);
    const code = toErrorCode(error);

    if (
        code === 16
        || /\bcancel(?:led|ed)?\b|dismiss(?:ed|al)|interrupted/i.test(message)
        || /\b12501\b/.test(message)
    ) {
        return new Error(NATIVE_GOOGLE_CANCELED_FALLBACK);
    }

    if (/account reauth|reauth failed|needs reauthentication|recoverable auth/i.test(message)) {
        return new Error(NATIVE_GOOGLE_REAUTH_FALLBACK);
    }

    return error instanceof Error ? error : new Error(message || 'Google sign-in failed. Please try again.');
};

export const signInWithNativeGoogleCredential = async (): Promise<string> => {
    await ensureNativeGoogleSsoInitialized();

    try {
        const response = await SocialLogin.login({
            provider: 'google',
            options: {
                style: 'standard',
                filterByAuthorizedAccounts: false,
                autoSelectEnabled: false,
            },
        });

        if (response.result.responseType !== 'online' || !response.result.idToken) {
            throw new Error('Google sign-in did not return a usable identity token.');
        }

        return response.result.idToken;
    } catch (error) {
        throw normalizeNativeGoogleSsoError(error);
    }
};

export const logoutNativeGoogleSession = async (): Promise<void> => {
    if (getNativeCapacitorPlatform() === 'web') {
        return;
    }

    try {
        await ensureNativeGoogleSsoInitialized();
        await SocialLogin.logout({ provider: 'google' });
    } catch {
        // Native Google logout is best-effort; app session logout still clears Notive auth.
    }
};
