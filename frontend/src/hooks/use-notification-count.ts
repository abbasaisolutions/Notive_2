'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useApi } from '@/hooks/use-api';
import { API_URL } from '@/constants/config';

/**
 * Lightweight event bus so any component can request a badge refresh
 * without requiring a shared context. Call `refreshNotificationBadge()`
 * from anywhere and every mounted `useNotificationCount` will re-poll.
 */
export const NOTIFICATION_BADGE_REFRESH_EVENT = 'notive:notification-badge-refresh';

export function refreshNotificationBadge(): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(NOTIFICATION_BADGE_REFRESH_EVENT));
    }
}

/**
 * Polls the notification endpoint for unread count.
 * Returns `{ unreadCount, refresh }`.
 * Does not poll until the user is authenticated. Restarts cleanly when
 * the auth state changes (e.g. initial load completes, login, logout).
 */
export function useNotificationCount(intervalMs = 60_000) {
    const { accessToken } = useAuth();
    const { apiFetch } = useApi();
    const [unreadCount, setUnreadCount] = useState(0);
    const timer = useRef<ReturnType<typeof setInterval>>();
    const apiFetchRef = useRef(apiFetch);
    const stoppedRef = useRef(false);

    // Keep ref current without re-triggering effects
    apiFetchRef.current = apiFetch;

    const refresh = useCallback(async () => {
        if (stoppedRef.current) return;
        try {
            const r = await apiFetchRef.current(`${API_URL}/notifications?unreadOnly=true&limit=1`, {
                retryOnUnauthorized: false,
            });
            if (r.ok) {
                const data = await r.json();
                setUnreadCount(data.unreadCount ?? data.total ?? 0);
            } else if (r.status === 401) {
                // Truly invalid auth — stop polling until accessToken changes
                stoppedRef.current = true;
                if (timer.current) clearInterval(timer.current);
            }
        } catch { /* network error — keep polling, will retry next interval */ }
    }, []);

    useEffect(() => {
        if (!accessToken) {
            // Not authenticated yet — clear badge and wait
            setUnreadCount(0);
            stoppedRef.current = false;
            if (timer.current) clearInterval(timer.current);
            return;
        }
        // Authenticated — start polling fresh
        stoppedRef.current = false;
        refresh();
        timer.current = setInterval(refresh, intervalMs);
        return () => { if (timer.current) clearInterval(timer.current); };
    }, [refresh, intervalMs, accessToken]);

    // Listen for external refresh requests (e.g. after viewing a shared bundle)
    useEffect(() => {
        const handler = () => { void refresh(); };
        window.addEventListener(NOTIFICATION_BADGE_REFRESH_EVENT, handler);
        return () => window.removeEventListener(NOTIFICATION_BADGE_REFRESH_EVENT, handler);
    }, [refresh]);

    return { unreadCount, refresh };
}
