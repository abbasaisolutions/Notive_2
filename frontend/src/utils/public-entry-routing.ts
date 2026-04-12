import { resolvePostAuthDestination } from '@/utils/auth-routing';
import { unwrapSetupReturnTo } from '@/utils/redirect';

type AuthRouteUser = Parameters<typeof resolvePostAuthDestination>[0];

const AUTHENTICATED_PUBLIC_ENTRY_PATHS = new Set([
    '/',
    '/login',
    '/register',
]);

export function isAuthenticatedPublicEntryPath(pathname: string | null | undefined): boolean {
    if (!pathname) return false;
    return AUTHENTICATED_PUBLIC_ENTRY_PATHS.has(pathname);
}

export function resolveAuthenticatedPublicEntryDestination(
    pathname: string | null | undefined,
    search: string | null | undefined,
    user: AuthRouteUser
): string | null {
    if (!isAuthenticatedPublicEntryPath(pathname)) {
        return null;
    }

    const searchParams = new URLSearchParams((search || '').replace(/^\?/, ''));
    const returnTo = unwrapSetupReturnTo(searchParams.get('returnTo')) || '/dashboard';
    const destination = resolvePostAuthDestination(user, returnTo);
    const current = `${pathname}${search || ''}`;

    return destination === current ? null : destination;
}
