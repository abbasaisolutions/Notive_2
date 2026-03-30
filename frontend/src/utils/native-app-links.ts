import { PUBLIC_APP_ORIGIN } from '@/config/site';

const CUSTOM_APP_SCHEME = 'com.notive.app:';

const normalizeNativePath = (url: URL): string | null => {
    if (url.protocol === CUSTOM_APP_SCHEME) {
        const path = url.pathname && url.pathname !== '/' ? url.pathname : `/${url.host}`;
        return `${path}${url.search}${url.hash}`;
    }

    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.host === PUBLIC_APP_ORIGIN.host) {
        return `${url.pathname}${url.search}${url.hash}`;
    }

    return null;
};

export const extractNativeAppPath = (value: string): string | null => {
    if (!value) return null;

    try {
        return normalizeNativePath(new URL(value));
    } catch {
        return null;
    }
};
