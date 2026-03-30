// Centralized application configuration
const LOCAL_API_URL = 'http://localhost:8000/api/v1';
const PRODUCTION_API_URL = 'https://notive2-production.up.railway.app/api/v1';

const normalizeUrl = (value: string) => value.replace(/\/$/, '');

const isNativePlatform = () => {
    if (typeof window === 'undefined') return false;

    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform) return cap.isNativePlatform();
    if (cap?.getPlatform) {
        const platform = cap.getPlatform();
        return platform === 'ios' || platform === 'android';
    }

    return false;
};

const isLocalHostname = (hostname: string) =>
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname.endsWith('.local');

export const resolveApiUrl = () => {
    const configuredUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim();
    const nativeConfiguredUrl = (process.env.NEXT_PUBLIC_NATIVE_API_URL || '').trim();

    if (isNativePlatform()) {
        if (nativeConfiguredUrl) {
            return normalizeUrl(nativeConfiguredUrl);
        }

        if (configuredUrl) {
            return normalizeUrl(configuredUrl);
        }

        return PRODUCTION_API_URL;
    }

    if (configuredUrl) {
        return normalizeUrl(configuredUrl);
    }

    if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
        return LOCAL_API_URL;
    }

    return PRODUCTION_API_URL;
};

export const API_URL = resolveApiUrl();

// Performance settings
export const DEBOUNCE_DELAY = 500;
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Display settings
export const MAX_ENTRY_PREVIEW_LENGTH = 100;
export const DEFAULT_ENTRIES_PER_PAGE = 20;
export const MAX_RECENT_ENTRIES = 6;
export const MAX_TOP_THEMES = 5;
export const MAX_GRATITUDE_ITEMS = 5;

// Date settings
export const MS_PER_DAY = 86400000; // 24 * 60 * 60 * 1000

// Gamification
export const XP_PER_ENTRY = 10;
export const XP_PER_STREAK_DAY = 5;
export const STREAK_GOAL = 7;
