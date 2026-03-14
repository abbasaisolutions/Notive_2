'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { hasCompletedOnboardingFromProfile } from '@/utils/onboarding';
import { sanitizeReturnTo } from '@/utils/redirect';

const PUBLIC_PREFIXES = [
    '/login',
    '/register',
    '/onboarding',
    '/forgot-password',
    '/reset-password',
    '/terms',
    '/privacy',
    '/share',
];

const PUBLIC_EXACT_PATHS = new Set(['/']);

const isPublicPath = (pathname: string | null | undefined): boolean => {
    if (!pathname) return true;
    if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
    return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

export default function OnboardingGuard() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isLoading } = useAuth();

    useEffect(() => {
        if (isLoading) return;
        if (!user) return;
        if (isPublicPath(pathname)) return;
        if (hasCompletedOnboardingFromProfile(user.profile ?? null)) return;

        const currentQuery = typeof window !== 'undefined' ? window.location.search : '';
        const safeReturnTo = sanitizeReturnTo(`${pathname || '/dashboard'}${currentQuery}`);
        const destination = safeReturnTo
            ? `/onboarding?returnTo=${encodeURIComponent(safeReturnTo)}`
            : '/onboarding';

        router.replace(destination);
    }, [isLoading, pathname, router, user]);

    return null;
}
