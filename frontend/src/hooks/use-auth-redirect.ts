'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { buildAuthAwareReturnTo, buildLoginRedirect, buildLoginRedirectWithReason } from '@/utils/redirect';
import { buildBirthDateCollectionRedirect, needsBirthDateCollection } from '@/utils/auth-routing';

export function useAuthRedirect() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isLoading } = useAuth();

    useEffect(() => {
        if (isLoading) return;

        const query = typeof window !== 'undefined' ? window.location.search : '';
        const returnTo = buildAuthAwareReturnTo(pathname, query);

        if (!user) {
            if (typeof window !== 'undefined' && sessionStorage.getItem('notive_auth_reason') === 'session-expired') {
                sessionStorage.removeItem('notive_auth_reason');
                router.replace(buildLoginRedirectWithReason(returnTo, 'session-expired'));
                return;
            }
            router.replace(buildLoginRedirect(returnTo));
            return;
        }

        if (needsBirthDateCollection(user) && pathname !== '/profile/complete') {
            router.replace(buildBirthDateCollectionRedirect(returnTo));
            return;
        }

    }, [isLoading, user, router, pathname]);

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
    };
}

export default useAuthRedirect;
