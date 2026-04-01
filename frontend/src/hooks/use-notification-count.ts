'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { API_URL } from '@/constants/config';

/**
 * Polls the notification endpoint for unread count.
 * Returns `{ unreadCount, refresh }`.
 * Stops polling on 401 to prevent infinite re-render loops.
 */
export function useNotificationCount(intervalMs = 60_000) {
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
                // Auth is invalid — stop polling to avoid infinite loop
                stoppedRef.current = true;
                if (timer.current) clearInterval(timer.current);
            }
        } catch { /* network error — keep polling, will retry next interval */ }
    }, []);

    useEffect(() => {
        stoppedRef.current = false;
        refresh();
        timer.current = setInterval(refresh, intervalMs);
        return () => { if (timer.current) clearInterval(timer.current); };
    }, [refresh, intervalMs]);

    return { unreadCount, refresh };
}
