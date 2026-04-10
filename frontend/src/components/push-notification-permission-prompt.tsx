'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAuth } from '@/context/auth-context';
import { hasCompletedPermissionsOnboarding } from '@/services/device-permissions.service';
import { openNativeNotificationSettings } from '@/services/native-notification-settings.service';
import logger from '@/utils/logger';

const PROMPT_DISMISSED_KEY = 'notive_push_prompt_dismissed';

/** Once the user dismisses the prompt it stays dismissed permanently.
 *  They can always enable notifications from Profile → Settings. */
function isPromptDismissed(): boolean {
    try { return localStorage.getItem(PROMPT_DISMISSED_KEY) === '1'; } catch { return false; }
}

function persistPromptDismissed(): void {
    try { localStorage.setItem(PROMPT_DISMISSED_KEY, '1'); } catch { /* noop */ }
}

function clearPromptDismissed(): void {
    try { localStorage.removeItem(PROMPT_DISMISSED_KEY); } catch { /* noop */ }
}

/**
 * Component that handles push notification permission requests
 * Shows a subtle prompt to enable push notifications
 */
export function PushNotificationPermissionPrompt() {
    const {
        isSupported,
        isPermissionGranted,
        permissionState,
        isLoading,
        requestPushPermission,
    } = usePushNotifications();
    const { user } = useAuth();
    const pathname = usePathname();
    const [showPrompt, setShowPrompt] = useState(false);
    const [dismissed, setDismissed] = useState(() => isPromptDismissed());
    const canRequestInApp = permissionState === 'prompt' || permissionState === 'prompt-with-rationale';
    const hasCompletedOnboarding = Boolean(user?.profile?.onboardingCompletedAt) || hasCompletedPermissionsOnboarding();
    const shouldSuppressPrompt = pathname?.startsWith('/onboarding');
    const shouldAutoPrompt = Boolean(
        user
        && hasCompletedOnboarding
        && !shouldSuppressPrompt
        && isSupported
        && !isPermissionGranted
        && !isLoading
        && canRequestInApp,
    );

    useEffect(() => {
        if (isPermissionGranted) {
            setShowPrompt(false);
            setDismissed(false);
            clearPromptDismissed();
            return;
        }

        // Only auto-show while the OS still says we can request in-app.
        if (!shouldAutoPrompt) {
            if (!canRequestInApp && showPrompt) {
                setShowPrompt(false);
            }
            return;
        }

        if (showPrompt || dismissed) {
            return;
        }

        const timer = setTimeout(() => {
            setShowPrompt(true);
        }, 6000);

        return () => clearTimeout(timer);
    }, [canRequestInApp, dismissed, isPermissionGranted, shouldAutoPrompt, showPrompt]);

    useEffect(() => {
        if (isPermissionGranted && showPrompt) {
            setShowPrompt(false);
        }
    }, [isPermissionGranted, showPrompt]);

    const handleRequestPermission = async () => {
        try {
            const granted = await requestPushPermission();
            if (granted) {
                logger.debug('Push notification permission granted');
                setShowPrompt(false);
                setDismissed(false);
                clearPromptDismissed();
            } else {
                // User denied at OS level — dismiss permanently
                handleDismiss();
                logger.debug('Push notification permission denied');
            }
        } catch (error) {
            logger.error('Failed to request push permission:', error);
        }
    };

    const handleOpenSettings = async () => {
        const opened = await openNativeNotificationSettings();
        if (!opened) {
            handleDismiss();
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        setDismissed(true);
        persistPromptDismissed();
    };

    if (!showPrompt) {
        return null;
    }

    const title = canRequestInApp ? 'Stay in the loop' : 'Notifications are off';
    const body = canRequestInApp
        ? 'Get reminders to write, know when friends share memories with you, and see when insights are ready.'
        : 'Notifications are turned off in your device settings. Tap below to open settings and turn them back on.';

    return (
        <div
            className="fixed inset-0 z-40 flex items-end justify-center sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-permission-title"
            aria-describedby="push-permission-description"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleDismiss} />

            {/* Card */}
            <div className="relative mx-4 mb-6 sm:mb-0 w-full max-w-sm animate-in slide-in-from-bottom-6 duration-300">
                <div className="workspace-panel rounded-2xl shadow-2xl p-6">
                    {/* Icon — bell for prompt, alert for denied */}
                    <div className="flex justify-center mb-4">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center ${canRequestInApp ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
                            {canRequestInApp ? (
                                <svg
                                    className="h-6 w-6 text-primary"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                </svg>
                            ) : (
                                <svg
                                    className="h-6 w-6 text-amber-600"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    </div>

                    <h3 id="push-permission-title" className="text-base font-semibold text-[rgb(var(--text-primary))] text-center">
                        {title}
                    </h3>

                    <p id="push-permission-description" className="text-sm text-ink-secondary text-center mt-2 leading-relaxed">
                        {body}
                    </p>

                    <div className="flex flex-col gap-2 mt-5">
                        {canRequestInApp ? (
                            <button
                                type="button"
                                onClick={handleRequestPermission}
                                className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl primary-cta text-white transition-all"
                            >
                                Enable notifications
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleOpenSettings}
                                className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl primary-cta text-white transition-all"
                            >
                                Open notification settings
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className="w-full px-4 py-2.5 text-sm font-medium rounded-xl text-ink-secondary hover:text-[rgb(var(--text-primary))] hover:bg-white/5 transition-all"
                        >
                            {canRequestInApp ? 'Maybe later' : 'Got it'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PushNotificationPermissionPrompt;
