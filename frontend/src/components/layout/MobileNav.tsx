'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { useGamification } from '@/context/gamification-context';
import { useTheme } from '@/context/theme-context';
import { useNotificationCount } from '@/hooks/use-notification-count';
import { FiMoreHorizontal } from 'react-icons/fi';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import UserAvatar from '@/components/ui/UserAvatar';
import {
    filterNavItemsByRole,
    filterNavSectionsByRole,
    getMobileMainNavItems,
    getMobileMoreNavSections,
    getWorkspaceMaturity,
    isNavItemActive,
    shouldHideGlobalNav,
} from './nav-config';

export default function MobileNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { stats } = useGamification();
    const { theme } = useTheme();
    const { unreadCount: sharedUnread } = useNotificationCount();
    const navRef = useRef<HTMLElement | null>(null);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [capturePhase, setCapturePhase] = useState(0); // 0=plus, 1=mic, 2=plus, 3=pen
    const isPaper = theme === 'paper';
    const workspaceMaturity = getWorkspaceMaturity({
        role: user?.role ?? null,
        profile: user?.profile ?? null,
        totalEntries: stats?.totalEntries ?? 0,
    });
    const mainNavItems = filterNavItemsByRole(getMobileMainNavItems(workspaceMaturity), user?.role ?? null);
    const moreNavSections = filterNavSectionsByRole(getMobileMoreNavSections(workspaceMaturity), user?.role ?? null);
    const moreSectionItems = useMemo(
        () => moreNavSections.flatMap((section) => section.items),
        [moreNavSections]
    );
    const isMoreSectionActive = moreSectionItems.some((item) => isNavItemActive(pathname, item));
    const currentReturnTo = useMemo(
        () => buildCurrentReturnTo(pathname, typeof window !== 'undefined' ? window.location.search : ''),
        [pathname]
    );
    const writeEntryHref = useMemo(
        () => appendReturnTo('/entry/new?mode=quick', currentReturnTo),
        [currentReturnTo]
    );
    const voiceEntryHref = useMemo(
        () => appendReturnTo('/entry/new?mode=quick&voiceSession=1&autoRecord=1', currentReturnTo),
        [currentReturnTo]
    );

    useEffect(() => {
        setIsMoreOpen(false);
    }, [pathname]);

    // Alternate icon on the capture FAB: + → mic → + → pen
    useEffect(() => {
        const interval = setInterval(() => setCapturePhase(p => (p + 1) % 4), 1600);
        return () => clearInterval(interval);
    }, []);

    // Prefetch entry route so navigation is near-instant
    useEffect(() => {
        router.prefetch(writeEntryHref);
        router.prefetch(voiceEntryHref);
    }, [router, writeEntryHref, voiceEntryHref]);

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
        const mediaQuery = window.matchMedia('(max-width: 1023px)');
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
            const clearance = Math.max(Math.ceil(occupiedHeight - 10), 72);
            const floatingOffset = Math.max(clearance + 10, 84);

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

    const handleCaptureTap = () => {
        setIsMoreOpen(false);
        // Mic phase → voice mode; all other phases → text mode
        if (capturePhase === 1) {
            router.push(voiceEntryHref);
        } else {
            router.push(writeEntryHref);
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
                        className="fixed bottom-28 right-6 z-[90] w-[260px] rounded-2xl glass-nav p-3 shadow-xl lg:hidden"
                    >
                        {moreNavSections.map((section) => (
                            <div key={section.id} className="mb-2 last:mb-0">
                                <div className="type-overline px-2 pb-1 text-muted">
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
                                                className={`type-label-md flex items-center gap-3 rounded-xl border p-3 transition-colors ${isActive
                                                    ? 'border-primary/25 bg-primary/14 text-strong'
                                                    : 'border-white/10 text-soft hover:bg-white/10 hover:text-strong'
                                                    }`}
                                            >
                                                {item.icon}
                                                <span>{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {user && (
                            <div className="mt-3 border-t border-white/10 pt-3">
                                <div className="type-overline px-2 pb-2 text-muted">
                                    Session
                                </div>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="type-label-md w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-3 text-left text-soft disabled:cursor-not-allowed disabled:opacity-60"
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
                        className={`fixed inset-0 z-[80] lg:hidden backdrop-blur-sm ${isPaper ? 'bg-[rgba(41,32,22,0.34)]' : 'bg-black/50'}`}
                    />
                )}
            </AnimatePresence>

            <nav
                ref={navRef}
                className="fixed left-3 right-3 z-50 lg:hidden"
                style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
                aria-label="Mobile navigation"
            >
                <div className="glass-nav relative flex items-center justify-around rounded-[2.2rem] px-3 py-2.5 shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-secondary/10 pointer-events-none" />

                    {mainNavItems.map((item) => {
                        const isActive = isNavItemActive(pathname, item);

                        if (item.isMain) {
                            return (
                                <div key={item.href} className="relative z-10 mx-1.5 flex flex-col items-center">
                                    <motion.button
                                        type="button"
                                        onClick={handleCaptureTap}
                                        whileTap={{ scale: 0.92 }}
                                        aria-label="Quick Capture"
                                        className="capture-fab relative flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-[1.7rem]"
                                    >
                                        {/* Multi-layer background for depth */}
                                        <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-[#A3B87F] via-[#8A9A6F] to-[#6B7D52] shadow-[0_8px_28px_rgba(107,125,82,0.45),inset_0_1px_1px_rgba(255,255,255,0.25)]" />
                                        {/* Glass highlight on top-left */}
                                        <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-80" />
                                        {/* Subtle inner ring */}
                                        <div className="absolute inset-[3px] rounded-[1.4rem] border border-white/15" />
                                        {/* Breathing glow ring */}
                                        <motion.div
                                            className="absolute -inset-1 rounded-[2rem] border-2 border-[#A3B87F]/40"
                                            animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.15, 0.5] }}
                                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                        />

                                        <div className="relative z-10 flex h-8 w-8 items-center justify-center">
                                            <AnimatePresence mode="wait">
                                                {(capturePhase === 0 || capturePhase === 2) ? (
                                                    <motion.div
                                                        key="plus"
                                                        initial={{ opacity: 0, scale: 0.6 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.6 }}
                                                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                                        className="absolute inset-0 flex items-center justify-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                                                    >
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" color="#FFFFFF" className="drop-shadow-sm">
                                                            <path d="M12 5v14M5 12h14" />
                                                        </svg>
                                                    </motion.div>
                                                ) : capturePhase === 1 ? (
                                                    <motion.div
                                                        key="mic"
                                                        initial={{ opacity: 0, scale: 0.6 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.6 }}
                                                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                                        className="absolute inset-0 flex items-center justify-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                                                    >
                                                        <NotebookDoodle name="mic" accent="sage" size={22} color="#FFFFFF" />
                                                    </motion.div>
                                                ) : (
                                                    <motion.div
                                                        key="pen"
                                                        initial={{ opacity: 0, scale: 0.6 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.6 }}
                                                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                                        className="absolute inset-0 flex items-center justify-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                                                    >
                                                        <NotebookDoodle name="pen" accent="sage" size={22} color="#FFFFFF" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </motion.button>
                                </div>
                            );
                        }

                        const isProfileTab = item.href === '/profile';

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={`relative z-10 flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-2xl px-2 py-1.5 transition-all ${isActive ? 'text-accent' : 'text-muted hover:text-strong'}`}
                            >
                                <div className={`relative ${isActive ? 'opacity-100 scale-110' : 'opacity-70'} transition-transform duration-200`}>
                                    {isProfileTab ? (
                                        <UserAvatar
                                            avatarUrl={user?.avatarUrl}
                                            name={user?.name}
                                            size={24}
                                            className={`ring-2 transition-all ${isActive ? 'ring-accent' : 'ring-transparent'}`}
                                        />
                                    ) : (
                                        <>
                                            {React.cloneElement(item.icon as React.ReactElement, {
                                                size: 22,
                                                strokeWidth: isActive ? 2.5 : 2
                                            })}
                                            {item.href === '/timeline' && sharedUnread > 0 && (
                                                <span className="absolute -top-0.5 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[rgb(107,143,113)] text-white text-[10px] font-bold leading-none px-1 shadow-sm">
                                                    {sharedUnread > 99 ? '99+' : sharedUnread}
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                                <span className={`type-micro mt-0.5 ${isActive ? 'text-strong opacity-100' : 'opacity-75'}`}>
                                    {item.shortLabel || item.label}
                                </span>
                            </Link>
                        );
                    })}

                    {/* More Button — only visible for admin users */}
                    {moreSectionItems.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsMoreOpen(!isMoreOpen)}
                            aria-expanded={isMoreOpen}
                            aria-controls="mobile-more-drawer"
                            aria-current={isMoreSectionActive ? 'page' : undefined}
                            aria-label="Open more navigation"
                            className={`relative z-10 flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-2xl px-2 py-1.5 transition-all ${(isMoreOpen || isMoreSectionActive) ? 'text-strong' : 'text-muted hover:text-strong'}`}
                        >
                            <div className={`${(isMoreOpen || isMoreSectionActive) ? 'opacity-100 scale-110' : 'opacity-70'} transition-transform duration-200`}>
                                <FiMoreHorizontal size={22} aria-hidden="true" />
                            </div>
                            <span className={`type-micro mt-0.5 ${(isMoreOpen || isMoreSectionActive) ? 'text-strong opacity-100' : 'opacity-75'}`}>
                                More
                            </span>
                        </button>
                    )}
                </div>
            </nav>
        </>
    );
}


