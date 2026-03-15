export type CredentialSsoProvider = 'google';

const isValidGoogleClientId = (value?: string | null): value is string =>
    !!value &&
    value !== 'your-google-client-id' &&
    /\.apps\.googleusercontent\.com$/i.test(value);

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

export const isCredentialSsoEnabled = (provider: CredentialSsoProvider): boolean =>
    getCredentialSsoClientId(provider) !== null;
