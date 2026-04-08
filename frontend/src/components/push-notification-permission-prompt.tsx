'use client';

import React, { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAuth } from '@/context/auth-context';
import logger from '@/utils/logger';

const DISMISS_KEY = 'notive_push_prompt_dismissed';
const DISMISS_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // re-show after 7 days

function wasDismissedRecently(): boolean {
    try {
        const ts = localStorage.getItem(DISMISS_KEY);
        if (!ts) return false;
        return Date.now() - Number(ts) < DISMISS_EXPIRY_MS;
    } catch { return false; }
}

function persistDismissal(): void {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* noop */ }
}

/**
 * Component that handles push notification permission requests
 * Shows a subtle prompt to enable push notifications
 */
export function PushNotificationPermissionPrompt() {
    const { isSupported, isPermissionGranted, isLoading, requestPushPermission } = usePushNotifications();
    const { user } = useAuth();
    const [showPrompt, setShowPrompt] = useState(false);
    const [dismissed, setDismissed] = useState(() => wasDismissedRecently());

    useEffect(() => {
        // Only show for authenticated native users without push permission
        if (user && isSupported && !isPermissionGranted && !isLoading && !dismissed) {
            // Delay longer to let users interact first before prompting
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 6000);

            return () => clearTimeout(timer);
        }
        // If permission was granted while this component is mounted, hide it
        if (isPermissionGranted && showPrompt) {
            setShowPrompt(false);
        }
    }, [user, isSupported, isPermissionGranted, isLoading, dismissed, showPrompt]);

    const handleRequestPermission = async () => {
        try {
            const granted = await requestPushPermission();
            if (granted) {
                logger.debug('Push notification permission granted');
                setShowPrompt(false);
                // Clear any previous dismissal so we don't have stale state
                try { localStorage.removeItem(DISMISS_KEY); } catch { /* noop */ }
            } else {
                // User denied at OS level — treat like a dismiss so we don't nag
                handleDismiss();
                logger.debug('Push notification permission denied');
            }
        } catch (error) {
            logger.error('Failed to request push permission:', error);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        setDismissed(true);
        persistDismissal();
    };

    if (!showPrompt) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleDismiss} />

            {/* Card */}
            <div className="relative mx-4 mb-6 sm:mb-0 w-full max-w-sm animate-in slide-in-from-bottom-6 duration-300">
                <div className="workspace-panel rounded-2xl shadow-2xl p-6">
                    {/* Bell icon */}
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <svg
                                className="h-6 w-6 text-primary"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                            </svg>
                        </div>
                    </div>

                    <h3 className="text-base font-semibold text-[rgb(var(--text-primary))] text-center">
                        Stay in the loop
                    </h3>

                    <p className="text-sm text-ink-secondary text-center mt-2 leading-relaxed">
                        Get gentle reminders to reflect, see when friends share memories with you, and know when your insights are ready.
                    </p>

                    <div className="flex flex-col gap-2 mt-5">
                        <button
                            onClick={handleRequestPermission}
                            className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl primary-cta text-white transition-all"
                        >
                            Enable notifications
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="w-full px-4 py-2.5 text-sm font-medium rounded-xl text-ink-secondary hover:text-[rgb(var(--text-primary))] hover:bg-white/5 transition-all"
                        >
                            Maybe later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PushNotificationPermissionPrompt;
