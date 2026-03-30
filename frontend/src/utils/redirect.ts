const ALLOWED_RETURN_TO_PREFIXES = [
    '/dashboard',
    '/onboarding',
    '/entry',
    '/timeline',
    '/insights',
    '/chapters',
    '/chat',
    '/portfolio',
    '/profile',
    '/admin',
];

const AUTH_SETUP_PREFIXES = [
    '/onboarding',
    '/profile/complete',
];

const normalizeReturnTo = (value: string): string => {
    if (value === '/') return '/dashboard';
    return value;
};

const parseRelativeUrl = (value: string): URL | null => {
    try {
        return new URL(value, 'https://notive.local');
    } catch {
        return null;
    }
};

export function sanitizeReturnTo(value: string | null | undefined): string | null {
    if (!value || typeof value !== 'string') return null;
    if (value.length > 1024) return null;
    if (!value.startsWith('/') || value.startsWith('//')) return null;

    const isAllowed = ALLOWED_RETURN_TO_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`));
    if (!isAllowed) return null;

    return normalizeReturnTo(value);
}

export function isAuthSetupPath(value: string | null | undefined): boolean {
    const safeValue = sanitizeReturnTo(value);
    if (!safeValue) return false;

    const parsed = parseRelativeUrl(safeValue);
    const pathname = parsed?.pathname || safeValue;

    return AUTH_SETUP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function unwrapSetupReturnTo(value: string | null | undefined): string | null {
    let current = sanitizeReturnTo(value);
    const seen = new Set<string>();

    for (let depth = 0; depth < 8 && current; depth += 1) {
        if (seen.has(current)) {
            return null;
        }
        seen.add(current);

        const parsed = parseRelativeUrl(current);
        if (!parsed) {
            return normalizeReturnTo(current);
        }

        if (!isAuthSetupPath(current)) {
            return normalizeReturnTo(current);
        }

        current = sanitizeReturnTo(parsed.searchParams.get('returnTo'));
    }

    return null;
}

export function buildAuthAwareReturnTo(
    pathname: string | null | undefined,
    search: string | null | undefined
): string | null {
    const current = sanitizeReturnTo(`${pathname || '/dashboard'}${search || ''}`);
    if (!current) return '/dashboard';
    if (!isAuthSetupPath(current)) return current;

    const params = new URLSearchParams((search || '').replace(/^\?/, ''));
    return unwrapSetupReturnTo(params.get('returnTo'));
}

export function buildLoginRedirect(returnTo: string | null | undefined): string {
    return buildLoginRedirectWithReason(returnTo, null);
}

export function buildLoginRedirectWithReason(
    returnTo: string | null | undefined,
    reason: 'session-expired' | null
): string {
    const safeReturnTo = unwrapSetupReturnTo(returnTo);
    const params = new URLSearchParams();
    if (safeReturnTo) {
        params.set('returnTo', safeReturnTo);
    }
    if (reason) {
        params.set('reason', reason);
    }

    const query = params.toString();
    return query ? `/login?${query}` : '/login';
}
