'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FiBell } from 'react-icons/fi';
import { useAuth } from '@/context/auth-context';
import { useNotificationCount } from '@/hooks/use-notification-count';
import useHasMounted from '@/hooks/use-has-mounted';
import { hapticTap } from '@/services/haptics.service';
import { shouldHideGlobalNav } from '@/components/layout/nav-config';

/**
 * Persistent bell in the top-right corner that opens /notifications.
 *
 * - Mobile only (desktop already shows the count in the sidebar).
 * - Respects Android status-bar safe area via env(safe-area-inset-top).
 * - Hides on auth flows, onboarding, and the entry editor so it does not
 *   compete with those focused surfaces.
 */
export default function NotificationBell() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { unreadCount } = useNotificationCount();
    const hasMounted = useHasMounted();
    const reducedMotionPreference = useReducedMotion();
    const prefersReducedMotion = hasMounted && !!reducedMotionPreference;

    if (!user) return null;
    if (shouldHideGlobalNav(pathname)) return null;
    if (pathname?.startsWith('/entry/new') || pathname?.startsWith('/entry/edit')) return null;
    if (pathname?.startsWith('/notifications')) return null;

    const hasUnread = unreadCount > 0;
    const ariaLabel = hasUnread
        ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
        : 'Notifications';

    return (
        <div
            className="fixed right-3 z-40 lg:hidden"
            style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
            <Link
                href="/notifications"
                aria-label={ariaLabel}
                onClick={() => hapticTap()}
                className="glass-nav relative flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
            >
                <FiBell size={20} aria-hidden="true" className="text-strong" />
                <AnimatePresence>
                    {hasUnread && (
                        <motion.span
                            key="badge"
                            initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute -top-0.5 -right-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-[rgb(107,143,113)] px-1 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-[#F8F4ED]"
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </motion.span>
                    )}
                </AnimatePresence>
                {hasUnread && !prefersReducedMotion && (
                    <motion.span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full border-2 border-[rgb(107,143,113)]/40 pointer-events-none"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                )}
            </Link>
        </div>
    );
}
