import type { CookieOptions } from 'express';

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

const normalizeOptionalValue = (value: string | undefined): string | undefined => {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
};

const readPositiveInt = (value: string | undefined, fallback: number): number => {
    const normalized = Number.parseInt((value || '').trim(), 10);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
};

const normalizeSameSite = (value: string | undefined): CookieOptions['sameSite'] => {
    const normalized = (value || '').trim().toLowerCase();
    if (normalized === 'strict' || normalized === 'lax' || normalized === 'none') {
        return normalized;
    }
    return 'lax';
};

const parseTrustProxy = (value: string | undefined): boolean | number | string => {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized) return process.env.NODE_ENV === 'production' ? 1 : false;
    if (normalized === 'true') return 1;
    if (normalized === 'false') return false;

    const numeric = Number.parseInt(normalized, 10);
    if (Number.isFinite(numeric) && numeric >= 0) {
        return numeric;
    }

    return value!.trim();
};

const isProduction = process.env.NODE_ENV === 'production';
const authCookieSameSite = normalizeSameSite(process.env.AUTH_COOKIE_SAME_SITE);
const authCookieDomain = normalizeOptionalValue(process.env.AUTH_COOKIE_DOMAIN);

export const securityConfig = {
    isProduction,
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    contentSecurityPolicy: normalizeOptionalValue(process.env.CONTENT_SECURITY_POLICY),
    requestLoggingEnabled: process.env.REQUEST_LOGGING_ENABLED !== 'false',
    requestLoggingVerbose: process.env.REQUEST_LOGGING_VERBOSE === 'true',
    refreshTokenCookieOptions: {
        httpOnly: true,
        secure: isProduction || authCookieSameSite === 'none',
        sameSite: authCookieSameSite,
        maxAge: 7 * ONE_DAY_MS,
        path: '/',
        ...(authCookieDomain ? { domain: authCookieDomain } : {}),
    } satisfies CookieOptions,
    refreshTokenCookieClearOptions: {
        httpOnly: true,
        secure: isProduction || authCookieSameSite === 'none',
        sameSite: authCookieSameSite,
        path: '/',
        ...(authCookieDomain ? { domain: authCookieDomain } : {}),
    } satisfies CookieOptions,
    rateLimits: {
        auth: {
            windowMs: readPositiveInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 10 * ONE_MINUTE_MS),
            max: readPositiveInt(process.env.RATE_LIMIT_AUTH_MAX, 12),
        },
        authRefresh: {
            windowMs: readPositiveInt(process.env.RATE_LIMIT_AUTH_REFRESH_WINDOW_MS, 5 * ONE_MINUTE_MS),
            max: readPositiveInt(process.env.RATE_LIMIT_AUTH_REFRESH_MAX, 30),
        },
        search: {
            windowMs: readPositiveInt(process.env.RATE_LIMIT_SEARCH_WINDOW_MS, 5 * ONE_MINUTE_MS),
            max: readPositiveInt(process.env.RATE_LIMIT_SEARCH_MAX, 120),
        },
        ai: {
            windowMs: readPositiveInt(process.env.RATE_LIMIT_AI_WINDOW_MS, 5 * ONE_MINUTE_MS),
            max: readPositiveInt(process.env.RATE_LIMIT_AI_MAX, 45),
        },
        voiceTranscription: {
            windowMs: readPositiveInt(process.env.RATE_LIMIT_VOICE_WINDOW_MS, 5 * ONE_MINUTE_MS),
            max: readPositiveInt(process.env.RATE_LIMIT_VOICE_MAX, 12),
        },
        import: {
            windowMs: readPositiveInt(process.env.RATE_LIMIT_IMPORT_WINDOW_MS, 10 * ONE_MINUTE_MS),
            max: readPositiveInt(process.env.RATE_LIMIT_IMPORT_MAX, 20),
        },
        archiveUpload: {
            windowMs: readPositiveInt(process.env.RATE_LIMIT_ARCHIVE_WINDOW_MS, ONE_HOUR_MS),
            max: readPositiveInt(process.env.RATE_LIMIT_ARCHIVE_MAX, 6),
        },
        socialImport: {
            windowMs: readPositiveInt(process.env.RATE_LIMIT_SOCIAL_IMPORT_WINDOW_MS, 10 * ONE_MINUTE_MS),
            max: readPositiveInt(process.env.RATE_LIMIT_SOCIAL_IMPORT_MAX, 20),
        },
        accountDeletion: {
            windowMs: readPositiveInt(process.env.RATE_LIMIT_ACCOUNT_DELETION_WINDOW_MS, ONE_HOUR_MS),
            max: readPositiveInt(process.env.RATE_LIMIT_ACCOUNT_DELETION_MAX, 6),
        },
    },
};
