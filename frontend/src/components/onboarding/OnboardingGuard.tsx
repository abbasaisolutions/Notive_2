'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import useApi from '@/hooks/use-api';
import { hasCompletedOnboardingFromProfile } from '@/utils/onboarding';
import { buildAuthAwareReturnTo } from '@/utils/redirect';
import { buildBirthDateCollectionRedirect, needsBirthDateCollection } from '@/utils/auth-routing';
import {
    hasSatisfiedFirstMemoryGate,
    markFirstMemorySatisfied,
    requiresFirstMemoryGate,
} from '@/utils/first-memory-gate';

const PUBLIC_PREFIXES = [
    '/login',
    '/register',
    '/onboarding',
    '/profile/complete',
    '/forgot-password',
    '/reset-password',
    '/terms',
    '/privacy',
    '/share',
];

const PUBLIC_EXACT_PATHS = new Set(['/']);

const FIRST_MEMORY_GATE_DESTINATION = '/entry/new?mode=quick&source=first_memory_gate';
const FIRST_MEMORY_GATE_PATH = '/entry/new';

const isPublicPath = (pathname: string | null | undefined): boolean => {
    if (!pathname) return true;
    if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
    return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

export default function OnboardingGuard() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, isLoading, logout } = useAuth();
    const { apiFetch } = useApi();

    // null = not yet checked, true/false = resolved. Only fetched once per app
    // session (see hasFetchedRef) so bouncing between routes doesn't re-hit the
    // backend on every navigation.
    const [hasEntry, setHasEntry] = useState<boolean | null>(null);
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        if (isLoading) return;
        if (!user) return;
        if (isPublicPath(pathname)) return;

        const currentQuery = typeof window !== 'undefined' ? window.location.search : '';
        const safeReturnTo = buildAuthAwareReturnTo(pathname, currentQuery);

        if (needsBirthDateCollection(user)) {
            router.replace(buildBirthDateCollectionRedirect(safeReturnTo));
            return;
        }

        if (!hasCompletedOnboardingFromProfile(user.profile ?? null)) {
            const destination = safeReturnTo
                ? `/onboarding?returnTo=${encodeURIComponent(safeReturnTo)}`
                : '/onboarding';
            router.replace(destination);
            return;
        }

        if (!requiresFirstMemoryGate(user) || hasSatisfiedFirstMemoryGate(user.id)) return;

        if (hasEntry === true) return;

        if (hasEntry === null) {
            if (!hasFetchedRef.current) {
                hasFetchedRef.current = true;
                void (async () => {
                    try {
                        const response = await apiFetch('/entries?page=1&limit=1');
                        const data = await response.json();
                        const total = Number(data?.pagination?.total ?? 0);
                        if (total >= 1) {
                            markFirstMemorySatisfied(user.id);
                            setHasEntry(true);
                        } else {
                            setHasEntry(false);
                        }
                    } catch {
                        // Fail open — a transient network error shouldn't trap the user.
                        setHasEntry(true);
                    }
                })();
            }
            return;
        }

        if (pathname !== FIRST_MEMORY_GATE_PATH) {
            router.replace(FIRST_MEMORY_GATE_DESTINATION);
        }
    }, [isLoading, pathname, router, user, hasEntry, apiFetch]);

    const showFirstMemoryBanner = Boolean(
        user
        && !isLoading
        && pathname === FIRST_MEMORY_GATE_PATH
        && hasEntry === false
        && requiresFirstMemoryGate(user)
        && !hasSatisfiedFirstMemoryGate(user.id)
    );

    if (!showFirstMemoryBanner) return null;

    return (
        <div
            className="fixed top-0 inset-x-0 z-[150] flex items-center justify-between gap-3 bg-[rgb(var(--brand))] px-4 py-2.5 text-white shadow-md"
            style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
        >
            <p className="text-xs font-medium leading-5 sm:text-sm">
                Write and save one memory to finish setting up your account.
            </p>
            <button
                type="button"
                onClick={() => void logout()}
                className="shrink-0 rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] transition-colors hover:bg-white/10"
            >
                Log out
            </button>
        </div>
    );
}
