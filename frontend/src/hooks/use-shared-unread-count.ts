'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/auth-context';
import { useApi } from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import { createSharedCountStore } from '@/hooks/create-shared-count-store';
import { NOTIFICATION_BADGE_REFRESH_EVENT } from '@/hooks/use-notification-count';

const sharedUnreadCountStore = createSharedCountStore({
    endpoint: `${API_URL}/memory-share/received?limit=1`,
    getCount: (data) => typeof data.unreadCount === 'number' ? data.unreadCount : 0,
    refreshEventName: NOTIFICATION_BADGE_REFRESH_EVENT,
});

export function useSharedUnreadCount(intervalMs = 60_000) {
    const { accessToken } = useAuth();
    const { apiFetch } = useApi();
    const unreadCount = useSyncExternalStore(
        sharedUnreadCountStore.subscribe,
        sharedUnreadCountStore.getSnapshot,
        sharedUnreadCountStore.getSnapshot,
    );

    useEffect(() => {
        return sharedUnreadCountStore.connect({
            accessToken,
            apiFetch,
            intervalMs,
        });
    }, [accessToken, apiFetch, intervalMs]);

    const refresh = useCallback(async () => {
        await sharedUnreadCountStore.refresh();
    }, []);

    return { unreadCount, refresh };
}
