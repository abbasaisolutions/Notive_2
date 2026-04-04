'use client';

import { useEffect, useState } from 'react';
import { FiWifiOff } from 'react-icons/fi';

export default function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const goOffline = () => setIsOffline(true);
        const goOnline = () => setIsOffline(false);

        setIsOffline(!navigator.onLine);

        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-xs font-medium text-white shadow-md"
        >
            <FiWifiOff size={14} aria-hidden="true" />
            You are offline. Some features may be unavailable.
        </div>
    );
}
