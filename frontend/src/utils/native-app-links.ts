import { PUBLIC_APP_ORIGIN } from '@/config/site';

const CUSTOM_APP_SCHEME = 'com.notive.app:';

const mergeSearchParams = (base: string, incoming: URLSearchParams): string => {
    const merged = new URLSearchParams(base.startsWith('?') ? base.slice(1) : base);
    incoming.forEach((value, key) => {
        if (!merged.has(key)) merged.set(key, value);
    });
    const serialized = merged.toString();
    return serialized ? `?${serialized}` : '';
};

const remapCustomHost = (url: URL): string | null => {
    const host = url.host.toLowerCase();
    if (host === 'quick-entry') {
        const search = mergeSearchParams('mode=quick', url.searchParams);
        return `/entry/new${search}${url.hash}`;
    }
    return null;
};

const normalizeNativePath = (url: URL): string | null => {
    if (url.protocol === CUSTOM_APP_SCHEME) {
        const remapped = remapCustomHost(url);
        if (remapped) return remapped;
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
