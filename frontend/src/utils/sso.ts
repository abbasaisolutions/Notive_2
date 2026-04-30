export type CredentialSsoProvider = 'google';
export type CredentialSsoAvailabilityReason = 'available' | 'missing_client_id' | 'missing_ios_client_id';
export type CredentialSsoSurface = 'web' | 'native' | 'unavailable';

const isValidGoogleClientId = (value?: string | null): value is string =>
    !!value &&
    value !== 'your-google-client-id' &&
    /\.apps\.googleusercontent\.com$/i.test(value);

export const getNativeCapacitorPlatform = (): 'web' | 'ios' | 'android' => {
    if (typeof window === 'undefined') return 'web';

    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform && !cap.isNativePlatform()) return 'web';
    if (cap?.getPlatform) {
        const platform = cap.getPlatform();
        if (platform === 'ios' || platform === 'android') {
            return platform;
        }
    }

    return 'web';
};

export const isNativeCapacitorPlatform = (): boolean => getNativeCapacitorPlatform() !== 'web';

const getGoogleWebClientId = (): string | null => {
    const clientId = (
        process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
        || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        || ''
    ).trim();

    return isValidGoogleClientId(clientId) ? clientId : null;
};

const getGoogleAndroidServerClientId = (): string | null => {
    const clientId = (process.env.NEXT_PUBLIC_GOOGLE_ANDROID_SERVER_CLIENT_ID || '').trim();
    return isValidGoogleClientId(clientId) ? clientId : null;
};

export const getGoogleIosClientId = (): string | null => {
    const clientId = (process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();
    return isValidGoogleClientId(clientId) ? clientId : null;
};

export const getCredentialSsoClientId = (provider: CredentialSsoProvider): string | null => {
    switch (provider) {
        case 'google': {
            if (getNativeCapacitorPlatform() === 'android') {
                return getGoogleAndroidServerClientId() || getGoogleWebClientId();
            }
            return getGoogleWebClientId();
        }
        default:
            return null;
    }
};

export const getCredentialSsoAvailability = (provider: CredentialSsoProvider): {
    enabled: boolean;
    clientId: string | null;
    reason: CredentialSsoAvailabilityReason;
    surface: CredentialSsoSurface;
} => {
    const clientId = getCredentialSsoClientId(provider);
    if (!clientId) {
        return { enabled: false, clientId: null, reason: 'missing_client_id', surface: 'unavailable' };
    }

    const nativePlatform = getNativeCapacitorPlatform();
    if (nativePlatform === 'ios' && !getGoogleIosClientId()) {
        return { enabled: false, clientId, reason: 'missing_ios_client_id', surface: 'unavailable' };
    }

    if (nativePlatform === 'ios' || nativePlatform === 'android') {
        return { enabled: true, clientId, reason: 'available', surface: 'native' };
    }

    return { enabled: true, clientId, reason: 'available', surface: 'web' };
};

export const isCredentialSsoEnabled = (provider: CredentialSsoProvider): boolean =>
    getCredentialSsoAvailability(provider).enabled;
