'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useApi } from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import { NOTIFICATION_BADGE_REFRESH_EVENT } from '@/hooks/use-notification-count';

export function useSharedUnreadCount(intervalMs = 60_000) {
    const { accessToken } = useAuth();
    const { apiFetch } = useApi();
    const [unreadCount, setUnreadCount] = useState(0);
    const timer = useRef<ReturnType<typeof setInterval>>();
    const apiFetchRef = useRef(apiFetch);
    const stoppedRef = useRef(false);

    apiFetchRef.current = apiFetch;

    const refresh = useCallback(async () => {
        if (stoppedRef.current) return;

        try {
            const response = await apiFetchRef.current(`${API_URL}/memory-share/received?limit=1`, {
                retryOnUnauthorized: false,
            });

            if (response.ok) {
                const data = await response.json();
                setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
            } else if (response.status === 401) {
                stoppedRef.current = true;
                if (timer.current) clearInterval(timer.current);
            }
        } catch {
            // Keep polling and retry next interval.
        }
    }, []);

    useEffect(() => {
        if (!accessToken) {
            setUnreadCount(0);
            stoppedRef.current = false;
            if (timer.current) clearInterval(timer.current);
            return;
        }

        stoppedRef.current = false;
        void refresh();
        timer.current = setInterval(refresh, intervalMs);
        return () => { if (timer.current) clearInterval(timer.current); };
    }, [accessToken, intervalMs, refresh]);

    useEffect(() => {
        const handler = () => { void refresh(); };
        window.addEventListener(NOTIFICATION_BADGE_REFRESH_EVENT, handler);
        return () => window.removeEventListener(NOTIFICATION_BADGE_REFRESH_EVENT, handler);
    }, [refresh]);

    return { unreadCount, refresh };
}
