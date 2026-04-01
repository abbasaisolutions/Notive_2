'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { API_URL } from '@/constants/config';

/**
 * Polls the notification endpoint for unread count.
 * Returns `{ unreadCount, refresh }`.
 */
export function useNotificationCount(intervalMs = 60_000) {
    const { apiFetch } = useApi();
    const [unreadCount, setUnreadCount] = useState(0);
    const timer = useRef<ReturnType<typeof setInterval>>();

    const refresh = useCallback(async () => {
        try {
            const r = await apiFetch(`${API_URL}/notifications?unreadOnly=true&limit=1`);
            if (r.ok) {
                const data = await r.json();
                setUnreadCount(data.unreadCount ?? data.total ?? 0);
            }
        } catch { /* ignore */ }
    }, [apiFetch]);

    useEffect(() => {
        refresh();
        timer.current = setInterval(refresh, intervalMs);
        return () => { if (timer.current) clearInterval(timer.current); };
    }, [refresh, intervalMs]);

    return { unreadCount, refresh };
}
