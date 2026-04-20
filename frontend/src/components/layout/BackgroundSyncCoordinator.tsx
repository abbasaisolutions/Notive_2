'use client';

import { App } from '@capacitor/app';
import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import useApi from '@/hooks/use-api';
import useUploadQueue from '@/hooks/use-upload-queue';
import { syncPendingEntryDraft } from '@/services/pending-entry-draft-sync.service';
import { isNativePlatform } from '@/utils/platform';

export default function BackgroundSyncCoordinator() {
    const pathname = usePathname();
    const { user, isLoading } = useAuth();
    const { apiFetch } = useApi();
    const { processQueue } = useUploadQueue();
    const syncInFlightRef = useRef(false);

    const runSync = useCallback(async () => {
        if (
            syncInFlightRef.current
            || isLoading
            || !user?.id
            || pathname?.startsWith('/entry/new')
            || (typeof navigator !== 'undefined' && !navigator.onLine)
        ) {
            return;
        }

        syncInFlightRef.current = true;

        try {
            await syncPendingEntryDraft(user.id, apiFetch);
            await processQueue();
        } finally {
            syncInFlightRef.current = false;
        }
    }, [apiFetch, isLoading, pathname, processQueue, user?.id]);

    useEffect(() => {
        void runSync();
    }, [runSync]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void runSync();
            }
        };

        const handleWindowSync = () => {
            void runSync();
        };

        window.addEventListener('online', handleWindowSync);
        window.addEventListener('focus', handleWindowSync);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        let removeNativeListener: (() => Promise<void>) | null = null;
        if (isNativePlatform()) {
            void App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    void runSync();
                }
            }).then((listener) => {
                removeNativeListener = () => listener.remove();
            }).catch(() => {});
        }

        return () => {
            window.removeEventListener('online', handleWindowSync);
            window.removeEventListener('focus', handleWindowSync);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (removeNativeListener) {
                void removeNativeListener();
            }
        };
    }, [runSync]);

    return null;
}
