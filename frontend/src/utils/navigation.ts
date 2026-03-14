import { sanitizeReturnTo } from '@/utils/redirect';

type SearchLike = {
    toString(): string;
} | null | undefined;

const normalizeHash = (hash: string | undefined): string => {
    if (!hash) return '';
    return hash.startsWith('#') ? hash : `#${hash}`;
};

export const buildSearchString = (searchParams: SearchLike): string => {
    const query = searchParams?.toString() || '';
    return query ? `?${query}` : '';
};

export const buildCurrentReturnTo = (
    pathname: string | null | undefined,
    search: string | null | undefined
): string => sanitizeReturnTo(`${pathname || '/dashboard'}${search || ''}`) || '/dashboard';

export const appendReturnTo = (href: string, returnTo: string | null | undefined): string => {
    const safeReturnTo = sanitizeReturnTo(returnTo);
    if (!safeReturnTo) return href;
    if (!href.startsWith('/') || href.startsWith('//')) return href;

    const hashIndex = href.indexOf('#');
    const rawHash = hashIndex >= 0 ? href.slice(hashIndex + 1) : '';
    const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
    const queryIndex = withoutHash.indexOf('?');
    const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
    const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '';
    const params = new URLSearchParams(query);

    params.set('returnTo', safeReturnTo);

    const nextQuery = params.toString();
    return `${pathname}${nextQuery ? `?${nextQuery}` : ''}${normalizeHash(rawHash)}`;
};

export const canUseHistoryBack = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (window.history.length <= 1) return false;

    const { referrer } = document;
    if (!referrer) return false;

    try {
        return new URL(referrer).origin === window.location.origin;
    } catch {
        return false;
    }
};
