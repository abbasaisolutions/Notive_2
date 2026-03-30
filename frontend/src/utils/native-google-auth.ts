import { SocialLogin } from '@capgo/capacitor-social-login';
import { getCredentialSsoAvailability, getGoogleIosClientId, getNativeCapacitorPlatform } from '@/utils/sso';

let googleInitPromise: Promise<void> | null = null;

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

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

export const signInWithNativeGoogleCredential = async (): Promise<string> => {
    await ensureNativeGoogleSsoInitialized();

    const platform = getNativeCapacitorPlatform();
    const response = await SocialLogin.login({
        provider: 'google',
        options: {
            scopes: GOOGLE_SCOPES,
            style: platform === 'android' ? 'bottom' : 'standard',
            filterByAuthorizedAccounts: false,
            autoSelectEnabled: false,
        },
    });

    if (response.result.responseType !== 'online' || !response.result.idToken) {
        throw new Error('Google sign-in did not return a usable identity token.');
    }

    return response.result.idToken;
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
