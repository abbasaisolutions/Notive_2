export type CredentialSsoProvider = 'google';
export type CredentialSsoAvailabilityReason = 'available' | 'missing_client_id' | 'native_webview';

const isValidGoogleClientId = (value?: string | null): value is string =>
    !!value &&
    value !== 'your-google-client-id' &&
    /\.apps\.googleusercontent\.com$/i.test(value);

export const isNativeCapacitorPlatform = (): boolean => {
    if (typeof window === 'undefined') return false;

    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform) return cap.isNativePlatform();
    if (cap?.getPlatform) {
        const platform = cap.getPlatform();
        return platform === 'ios' || platform === 'android';
    }

    return false;
};

export const getCredentialSsoClientId = (provider: CredentialSsoProvider): string | null => {
    switch (provider) {
        case 'google': {
            const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
            return isValidGoogleClientId(clientId) ? clientId : null;
        }
        default:
            return null;
    }
};

export const getCredentialSsoAvailability = (provider: CredentialSsoProvider): {
    enabled: boolean;
    clientId: string | null;
    reason: CredentialSsoAvailabilityReason;
} => {
    const clientId = getCredentialSsoClientId(provider);
    if (!clientId) {
        return { enabled: false, clientId: null, reason: 'missing_client_id' };
    }

    if (isNativeCapacitorPlatform()) {
        return { enabled: false, clientId, reason: 'native_webview' };
    }

    return { enabled: true, clientId, reason: 'available' };
};

export const isCredentialSsoEnabled = (provider: CredentialSsoProvider): boolean =>
    getCredentialSsoAvailability(provider).enabled;
