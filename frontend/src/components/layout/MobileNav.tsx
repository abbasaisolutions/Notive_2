'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { useGamification } from '@/context/gamification-context';
import { buildProfileContextSummary } from '@/services/profile-context.service';
import { FiMoreHorizontal } from 'react-icons/fi';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import {
    filterNavItemsByRole,
    filterNavSectionsByRole,
    getMobileMainNavItems,
    getMobileMoreNavSections,
    getProfileReadinessAction,
    getWorkspaceMaturity,
    isNavItemActive,
    shouldHideGlobalNav,
} from './nav-config';

export default function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { stats } = useGamification();
    const navRef = useRef<HTMLElement | null>(null);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const profileSummary = buildProfileContextSummary(user?.profile ?? null);
    const workspaceMaturity = getWorkspaceMaturity({
        role: user?.role ?? null,
        profile: user?.profile ?? null,
        totalEntries: stats?.totalEntries ?? 0,
    });
    const mainNavItems = filterNavItemsByRole(getMobileMainNavItems(workspaceMaturity), user?.role ?? null);
    const moreNavSections = filterNavSectionsByRole(getMobileMoreNavSections(workspaceMaturity), user?.role ?? null);
    const readinessAction = getProfileReadinessAction(profileSummary.completionScore);
    const moreSectionItems = useMemo(
        () => moreNavSections.flatMap((section) => section.items),
        [moreNavSections]
    );
    const isMoreSectionActive = moreSectionItems.some((item) => isNavItemActive(pathname, item));
    const currentReturnTo = useMemo(
        () => buildCurrentReturnTo(pathname, typeof window !== 'undefined' ? window.location.search : ''),
        [pathname]
    );

    useEffect(() => {
        setIsMoreOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!isMoreOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMoreOpen(false);
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isMoreOpen]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const root = document.documentElement;
        const mediaQuery = window.matchMedia('(max-width: 767px)');
        let animationFrameId = 0;
        let resizeObserver: ResizeObserver | null = null;

        const clearOffsets = () => {
            root.style.removeProperty('--app-bottom-clearance');
            root.style.removeProperty('--app-floating-voice-bottom');
        };

        const updateOffsets = () => {
            if (!mediaQuery.matches || !navRef.current) {
                clearOffsets();
                return;
            }

            const rect = navRef.current.getBoundingClientRect();
            const occupiedHeight = Math.max(window.innerHeight - rect.top, 0);
            const clearance = Math.ceil(occupiedHeight + 16);
            const floatingOffset = Math.ceil(occupiedHeight + 20);

            root.style.setProperty('--app-bottom-clearance', `${clearance}px`);
            root.style.setProperty('--app-floating-voice-bottom', `${floatingOffset}px`);
        };

        const scheduleOffsetUpdate = () => {
            if (animationFrameId) {
                window.cancelAnimationFrame(animationFrameId);
            }

            animationFrameId = window.requestAnimationFrame(() => {
                animationFrameId = 0;
                updateOffsets();
            });
        };

        scheduleOffsetUpdate();
        mediaQuery.addEventListener('change', scheduleOffsetUpdate);
        window.addEventListener('resize', scheduleOffsetUpdate);

        if (typeof ResizeObserver !== 'undefined' && navRef.current) {
            resizeObserver = new ResizeObserver(() => {
                scheduleOffsetUpdate();
            });
            resizeObserver.observe(navRef.current);
        }

        return () => {
            mediaQuery.removeEventListener('change', scheduleOffsetUpdate);
            window.removeEventListener('resize', scheduleOffsetUpdate);
            if (animationFrameId) {
                window.cancelAnimationFrame(animationFrameId);
            }
            resizeObserver?.disconnect();
            clearOffsets();
        };
    }, []);

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            await logout();
            setIsMoreOpen(false);
            router.replace('/login');
        } finally {
            setIsLoggingOut(false);
        }
    };

    if (shouldHideGlobalNav(pathname)) {
        return null;
    }

    return (
        <>
            {/* More Drawer */}
            <AnimatePresence>
                {isMoreOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        id="mobile-more-drawer"
                        role="dialog"
                        aria-modal="true"
                        aria-label="More navigation"
                        className="fixed bottom-28 right-6 z-50 w-[260px] rounded-2xl border border-white/15 bg-surface-1/95 p-3 shadow-xl backdrop-blur-xl md:hidden"
                    >
                        {user && workspaceMaturity !== 'new' && (
                            <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Profile Readiness</p>
                                    <span className="text-xs font-semibold text-white">{profileSummary.completionScore}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-secondary"
                                        style={{ width: `${profileSummary.completionScore}%` }}
                                    />
                                </div>
                                <Link
                                    href={readinessAction.href}
                                    onClick={() => setIsMoreOpen(false)}
                                    className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-primary/30 bg-primary/12 px-2 py-1.5 text-xs uppercase tracking-[0.12em] text-primary"
                                >
                                    {readinessAction.label}
                                </Link>
                            </div>
                        )}
                        {moreNavSections.map((section) => (
                            <div key={section.id} className="mb-2 last:mb-0">
                                <div className="px-2 pb-1 text-xs uppercase tracking-[0.18em] text-ink-muted">
                                    {section.label}
                                </div>
                                <div className="space-y-1">
                                    {section.items.map((item) => {
                                        const isActive = isNavItemActive(pathname, item);
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setIsMoreOpen(false)}
                                                aria-current={isActive ? 'page' : undefined}
                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isActive
                                                    ? 'border-primary/35 bg-primary/15 text-white'
                                                    : 'border-white/10 text-ink-secondary hover:text-white hover:bg-white/10'
                                                    }`}
                                            >
                                                {item.icon}
                                                <span className="text-sm font-semibold">{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {user && (
                            <div className="mt-3 border-t border-white/10 pt-3">
                                <div className="px-2 pb-2 text-xs uppercase tracking-[0.18em] text-ink-muted">
                                    Session
                                </div>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-3 text-left text-sm font-semibold text-ink-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isLoggingOut ? 'Signing out...' : 'Sign out'}
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isMoreOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMoreOpen(false)}
                        className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    />
                )}
            </AnimatePresence>

            <nav
                ref={navRef}
                className="fixed left-4 right-4 z-50 md:hidden"
                style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                aria-label="Mobile navigation"
            >
                <div className="bg-surface-1/80 backdrop-blur-2xl border border-white/15 rounded-[2.5rem] px-4 py-3 shadow-2xl flex items-center justify-around relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-secondary/10 pointer-events-none" />

                    {mainNavItems.map((item) => {
                        const isActive = isNavItemActive(pathname, item);

                        if (item.isMain) {
                            const quickCaptureHref = item.href === '/entry/new'
                                ? appendReturnTo('/entry/new?mode=quick', currentReturnTo)
                                : appendReturnTo(item.href, currentReturnTo);
                            return (
                                <Link
                                    key={item.href}
                                    href={quickCaptureHref}
                                    aria-label={item.label}
                                    className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-xl shadow-primary/40 hover:scale-110 active:scale-95 transition-all relative z-10 mx-2"
                                >
                                    {item.icon}
                                </Link>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all relative z-10 flex-1 ${isActive ? 'text-primary' : 'text-ink-muted hover:text-white'
                                    }`}
                            >
                                <div className={`${isActive ? 'opacity-100 scale-110' : 'opacity-70'} transition-transform duration-200`}>
                                    {React.cloneElement(item.icon as React.ReactElement, {
                                        size: 24, // Increased size for touch targets
                                        strokeWidth: isActive ? 2.5 : 2
                                    })}
                                </div>
                                <span className={`text-xs mt-1 font-bold uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                    {item.shortLabel || item.label}
                                </span>
                            </Link>
                        );
                    })}

                    {/* More Button */}
                    <button
                        type="button"
                        onClick={() => setIsMoreOpen(!isMoreOpen)}
                        aria-expanded={isMoreOpen}
                        aria-controls="mobile-more-drawer"
                        aria-current={isMoreSectionActive ? 'page' : undefined}
                        aria-label="Open more navigation"
                        className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all relative z-10 flex-1 ${(isMoreOpen || isMoreSectionActive) ? 'text-white' : 'text-ink-muted hover:text-white'}`}
                    >
                        <div className={`${(isMoreOpen || isMoreSectionActive) ? 'opacity-100 scale-110' : 'opacity-70'} transition-transform duration-200`}>
                            <FiMoreHorizontal size={24} aria-hidden="true" />
                        </div>
                        <span className={`text-xs mt-1 font-bold uppercase tracking-widest ${(isMoreOpen || isMoreSectionActive) ? 'opacity-100' : 'opacity-40'}`}>
                            More
                        </span>
                    </button>
                </div>
            </nav>
        </>
    );
}


