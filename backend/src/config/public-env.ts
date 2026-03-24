const DEV_CLIENT_URL = 'http://localhost:3000';
const DEV_API_URL = 'http://localhost:8000/api/v1';

const isProduction = process.env.NODE_ENV === 'production';

const normalizeHttpUrl = (value: string | undefined | null): string | null => {
    const normalized = value?.trim();
    if (!normalized) return null;

    try {
        const parsed = new URL(normalized);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }

        return parsed.toString().replace(/\/$/, '');
    } catch {
        return null;
    }
};

export const getConfiguredClientUrl = (): string | null => {
    const configured = normalizeHttpUrl(process.env.CLIENT_URL || process.env.FRONTEND_URL);
    if (configured) return configured;
    return isProduction ? null : DEV_CLIENT_URL;
};

export const getConfiguredClientOrigin = (): string | null => {
    const clientUrl = getConfiguredClientUrl();
    if (!clientUrl) return null;

    try {
        return new URL(clientUrl).origin;
    } catch {
        return null;
    }
};

export const getConfiguredApiUrl = (): string | null => {
    const configured = normalizeHttpUrl(process.env.API_URL);
    if (configured) return configured;
    return isProduction ? null : DEV_API_URL;
};

export const getConfiguredApiBaseUrl = (): string | null => {
    const apiUrl = getConfiguredApiUrl();
    return apiUrl ? apiUrl.replace(/\/api\/v1\/?$/, '') : null;
};

export const getGoogleFitRedirectUri = (): string | null => {
    const explicit = normalizeHttpUrl(process.env.GOOGLE_FIT_REDIRECT_URI);
    if (explicit) return explicit;

    const apiBaseUrl = getConfiguredApiBaseUrl();
    return apiBaseUrl ? `${apiBaseUrl}/api/v1/health/google-fit/callback` : null;
};
