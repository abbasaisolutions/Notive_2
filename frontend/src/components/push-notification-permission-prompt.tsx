'use client';

import React, { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAuth } from '@/context/auth-context';
import logger from '@/utils/logger';

/**
 * Component that handles push notification permission requests
 * Shows a subtle prompt to enable push notifications
 */
export function PushNotificationPermissionPrompt() {
    const { isSupported, isPermissionGranted, isLoading, requestPushPermission } = usePushNotifications();
    const { user } = useAuth();
    const [showPrompt, setShowPrompt] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Only show for authenticated native users without push permission
        if (user && isSupported && !isPermissionGranted && !isLoading && !dismissed) {
            // Show prompt after a delay to avoid interruption on initial load
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [user, isSupported, isPermissionGranted, isLoading, dismissed]);

    const handleRequestPermission = async () => {
        try {
            const granted = await requestPushPermission();
            if (granted) {
                logger.debug('Push notification permission granted');
                setShowPrompt(false);
            } else {
                logger.debug('Push notification permission denied');
            }
        } catch (error) {
            logger.error('Failed to request push permission:', error);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        setDismissed(true);
    };

    if (!showPrompt) {
        return null;
    }

    return (
        <div className="fixed bottom-20 right-4 max-w-xs z-40 animate-in slide-in-from-bottom-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                        <svg
                            className="h-5 w-5 text-blue-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path d="M10 2a6 6 0 00-6 6v3.586L4.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414L5 11.586V8a5 5 0 0110 0v3.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414L14 11.586V8a6 6 0 00-6-6zM9 16a1 1 0 112 0 1 1 0 01-2 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Enable notifications
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Get real-time updates and insights on your mobile device
                        </p>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleRequestPermission}
                                className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                            >
                                Enable
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="flex-1 px-3 py-1.5 text-sm font-medium rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                Later
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PushNotificationPermissionPrompt;
