const ALLOWED_RETURN_TO_PREFIXES = [
    '/dashboard',
    '/onboarding',
    '/entry',
    '/timeline',
    '/insights',
    '/chapters',
    '/chat',
    '/portfolio',
    '/legacy',
    '/profile',
    '/admin',
];

const normalizeReturnTo = (value: string): string => {
    if (value === '/') return '/dashboard';
    return value;
};

export function sanitizeReturnTo(value: string | null | undefined): string | null {
    if (!value || typeof value !== 'string') return null;
    if (!value.startsWith('/') || value.startsWith('//')) return null;

    const isAllowed = ALLOWED_RETURN_TO_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`));
    if (!isAllowed) return null;

    return normalizeReturnTo(value);
}

export function buildLoginRedirect(returnTo: string | null | undefined): string {
    return buildLoginRedirectWithReason(returnTo, null);
}

export function buildLoginRedirectWithReason(
    returnTo: string | null | undefined,
    reason: 'session-expired' | null
): string {
    const safeReturnTo = sanitizeReturnTo(returnTo);
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
