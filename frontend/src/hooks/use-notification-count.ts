'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/auth-context';
import { useApi } from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import { createSharedCountStore } from '@/hooks/create-shared-count-store';

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

const notificationCountStore = createSharedCountStore({
    endpoint: `${API_URL}/notifications?unreadOnly=true&limit=1`,
    getCount: (data) => data.unreadCount ?? data.total ?? 0,
    refreshEventName: NOTIFICATION_BADGE_REFRESH_EVENT,
});

/**
 * Polls the notification endpoint for unread count.
 * Returns `{ unreadCount, refresh }`.
 * Does not poll until the user is authenticated. Restarts cleanly when
 * the auth state changes (e.g. initial load completes, login, logout).
 */
export function useNotificationCount(intervalMs = 60_000) {
    const { accessToken } = useAuth();
    const { apiFetch } = useApi();
    const unreadCount = useSyncExternalStore(
        notificationCountStore.subscribe,
        notificationCountStore.getSnapshot,
        notificationCountStore.getSnapshot,
    );

    useEffect(() => {
        return notificationCountStore.connect({
            accessToken,
            apiFetch,
            intervalMs,
        });
    }, [accessToken, apiFetch, intervalMs]);

    const refresh = useCallback(async () => {
        await notificationCountStore.refresh();
    }, []);

    return { unreadCount, refresh };
}
