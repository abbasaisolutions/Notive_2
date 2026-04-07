'use client';

import { useEffect, useState } from 'react';
import { FiWifiOff, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '@/context/auth-context';
import { hasPendingSyncDraft } from '@/hooks/use-entry-draft';

type BannerState = 'offline' | 'syncing' | null;

export default function OfflineBanner() {
    const [state, setState] = useState<BannerState>(null);
    const { user } = useAuth();

    useEffect(() => {
        const goOffline = () => setState('offline');
        const goOnline = () => {
            // When reconnecting, check if there's a draft waiting to sync
            if (hasPendingSyncDraft(user?.id)) {
                setState('syncing');
                // Auto-dismiss after 6s — the entry page's own onOnline handler
                // does the actual sync, so this is just informational.
                const t = setTimeout(() => setState(null), 6000);
                return () => clearTimeout(t);
            }
            setState(null);
        };

        if (!navigator.onLine) setState('offline');

        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, [user?.id]);

    if (!state) return null;

    const isOffline = state === 'offline';

    return (
        <div
            role="status"
            aria-live="polite"
            className={`fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white shadow-md transition-colors ${
                isOffline ? 'bg-amber-600' : 'bg-[rgb(var(--paper-sage))]'
            }`}
        >
            {isOffline ? (
                <>
                    <FiWifiOff size={14} aria-hidden="true" />
                    You are offline. Your draft is saved locally.
                </>
            ) : (
                <>
                    <FiRefreshCw size={14} className="animate-spin" aria-hidden="true" />
                    Back online — syncing your draft&hellip;
                </>
            )}
        </div>
    );
}
