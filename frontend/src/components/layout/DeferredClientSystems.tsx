'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const BackgroundSyncCoordinator = dynamic(() => import('@/components/layout/BackgroundSyncCoordinator'), { ssr: false });
const GlobalSearchOverlay = dynamic(() => import('@/components/search/GlobalSearchOverlay'), { ssr: false });
const PushNotificationPermissionPrompt = dynamic(
    () => import('@/components/push-notification-permission-prompt').then((module) => module.PushNotificationPermissionPrompt),
    { ssr: false }
);

const scheduleIdle = (callback: () => void, timeout = 1800) => {
    if (typeof window === 'undefined') return () => {};

    const idleCallback = window.requestIdleCallback;
    if (idleCallback) {
        const id = idleCallback(callback, { timeout });
        return () => window.cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(callback, Math.min(timeout, 900));
    return () => window.clearTimeout(id);
};

export default function DeferredClientSystems() {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => scheduleIdle(() => setIsReady(true)), []);

    if (!isReady) return null;

    return (
        <>
            <BackgroundSyncCoordinator />
            <GlobalSearchOverlay />
            <PushNotificationPermissionPrompt />
        </>
    );
}
