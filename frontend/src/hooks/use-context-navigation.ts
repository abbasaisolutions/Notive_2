'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { sanitizeReturnTo } from '@/utils/redirect';
import { appendReturnTo, buildCurrentReturnTo, canUseHistoryBack } from '@/utils/navigation';

export function useContextNavigation(
    fallbackHref: string,
    fallbackLabel: string
) {
    const router = useRouter();
    const pathname = usePathname();
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const currentReturnTo = useMemo(
        () => buildCurrentReturnTo(pathname, search),
        [pathname, search]
    );
    const explicitReturnTo = useMemo(
        () => sanitizeReturnTo(new URLSearchParams(search).get('returnTo')),
        [search]
    );
    const backHref = explicitReturnTo || fallbackHref;
    const backLabel = explicitReturnTo ? 'Back to previous page' : `Back to ${fallbackLabel}`;

    const navigateBack = useCallback(() => {
        if (explicitReturnTo) {
            router.push(explicitReturnTo);
            return;
        }

        if (canUseHistoryBack()) {
            router.back();
            return;
        }

        router.push(fallbackHref);
    }, [explicitReturnTo, fallbackHref, router]);

    const withCurrentReturnTo = useCallback(
        (href: string) => appendReturnTo(href, currentReturnTo),
        [currentReturnTo]
    );

    return {
        backHref,
        backLabel,
        currentReturnTo,
        navigateBack,
        returnTo: explicitReturnTo,
        withCurrentReturnTo,
    };
}

export default useContextNavigation;
