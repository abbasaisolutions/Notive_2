'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { unwrapSetupReturnTo } from '@/utils/redirect';
import { appendReturnTo, buildCurrentReturnTo, canUseHistoryBack } from '@/utils/navigation';

export function useContextNavigation(
    fallbackHref: string,
    fallbackLabel: string
) {
    const router = useRouter();
    const pathname = usePathname();
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setSearch(window.location.search);
    }, [pathname]);

    const currentReturnTo = useMemo(
        () => buildCurrentReturnTo(pathname, search),
        [pathname, search]
    );
    const explicitReturnTo = useMemo(
        () => unwrapSetupReturnTo(new URLSearchParams(search).get('returnTo')),
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
