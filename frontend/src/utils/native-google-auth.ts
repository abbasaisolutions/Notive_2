import { SocialLogin } from '@capgo/capacitor-social-login';
import { getCredentialSsoAvailability, getGoogleIosClientId, getNativeCapacitorPlatform } from '@/utils/sso';
import logger from '@/utils/logger';

let googleInitPromise: Promise<void> | null = null;

const NATIVE_GOOGLE_CANCELED_FALLBACK =
    'Google sign-in did not finish on this device. Choose the account again and try once more.';
const NATIVE_GOOGLE_ANDROID_BUILD_FALLBACK =
    "Google sign-in is temporarily unavailable on this Android build because the app's Google connection needs to be refreshed. Use email and password for now.";
const NATIVE_GOOGLE_REAUTH_FALLBACK =
    'Google sign-in still needs the Google account on this device to be active. Open Android Settings, confirm the Google account is signed in, then try again.';
type NativeGoogleLoginStyle = 'bottom' | 'standard';

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

const serializeNativeGoogleError = (error: unknown) => {
    const message = toErrorMessage(error);
    const code = toErrorCode(error);

    if (!error || typeof error !== 'object') {
        return {
            code,
            message,
            raw: error,
        };
    }

    const record = error as Record<string, unknown>;
    return {
        code,
        message,
        name: typeof record.name === 'string' ? record.name : undefined,
        type: typeof record.type === 'string' ? record.type : undefined,
        error: typeof record.error === 'string' ? record.error : undefined,
        localizedMessage: typeof record.localizedMessage === 'string' ? record.localizedMessage : undefined,
    };
};

export const normalizeNativeGoogleSsoError = (error: unknown): Error => {
    const message = toErrorMessage(error);
    const code = toErrorCode(error);

    if (/account reauth failed|unable to get sync account/i.test(message)) {
        return new Error(NATIVE_GOOGLE_ANDROID_BUILD_FALLBACK);
    }

    if (
        code === 16
        || /\bcancel(?:led|ed)?\b|dismiss(?:ed|al)|interrupted/i.test(message)
        || /getcredentialcancellationexception|activity is cancelled by the user/i.test(message)
        || /\b12501\b/.test(message)
    ) {
        return new Error(NATIVE_GOOGLE_CANCELED_FALLBACK);
    }

    if (/needs reauthentication|recoverable auth/i.test(message)) {
        return new Error(NATIVE_GOOGLE_REAUTH_FALLBACK);
    }

    return error instanceof Error ? error : new Error(message || 'Google sign-in failed. Please try again.');
};

const clearNativeGoogleCredentialState = async (reason: string): Promise<void> => {
    if (getNativeCapacitorPlatform() === 'web') {
        return;
    }

    try {
        await ensureNativeGoogleSsoInitialized();
        await SocialLogin.logout({ provider: 'google' });
    } catch (error) {
        logger.warn(`Native Google credential state clear failed (${reason})`, serializeNativeGoogleError(error));
    }
};

const isAndroidCredentialRetryableError = (error: unknown): boolean => {
    const message = toErrorMessage(error);
    const code = toErrorCode(error);

    if (/activity is cancelled by the user|dismiss(?:ed|al)|\bcancel(?:led|ed)?\b/i.test(message)
        && !/account reauth failed|interrupted|\b16\b/i.test(message)) {
        return false;
    }

    return (
        code === 16
        || /account reauth failed|unable to get sync account|interrupted|\b16\b/i.test(message)
    );
};

const buildNativeGoogleLoginOptions = (style: NativeGoogleLoginStyle) => ({
    style,
    filterByAuthorizedAccounts: false,
    autoSelectEnabled: false,
});

const loginWithNativeGoogle = async () => {
    const platform = getNativeCapacitorPlatform();
    const styles: NativeGoogleLoginStyle[] = platform === 'android'
        ? ['bottom', 'standard']
        : ['standard'];
    let lastError: unknown;

    for (const style of styles) {
        try {
            return await SocialLogin.login({
                provider: 'google',
                options: buildNativeGoogleLoginOptions(style),
            });
        } catch (error) {
            lastError = error;

            if (platform === 'android' && style === 'bottom' && isAndroidCredentialRetryableError(error)) {
                logger.warn('Native Google bottom-sheet sign-in failed; retrying standard flow', serializeNativeGoogleError(error));
                continue;
            }

            throw error;
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Google sign-in failed. Please try again.');
};

export const signInWithNativeGoogleCredential = async (): Promise<string> => {
    await ensureNativeGoogleSsoInitialized();

    try {
        const response = await loginWithNativeGoogle();

        if (response.result.responseType !== 'online' || !response.result.idToken) {
            throw new Error('Google sign-in did not return a usable identity token.');
        }

        return response.result.idToken;
    } catch (error) {
        logger.warn('Native Google sign-in failed', serializeNativeGoogleError(error));
        throw normalizeNativeGoogleSsoError(error);
    }
};

export const logoutNativeGoogleSession = async (): Promise<void> => {
    await clearNativeGoogleCredentialState('during logout');
};
