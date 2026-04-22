'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAuth } from '@/context/auth-context';
import {
    checkPermission,
    hasSeenRuntimePermissionPrompt,
    markRuntimePermissionPromptSeen,
} from '@/services/device-permissions.service';
import { isNativePlatform } from '@/utils/platform';
import logger from '@/utils/logger';

const AUTO_PROMPT_BLOCKLIST = [
    '/onboarding',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/entry/new',
    '/share',
    '/shared',
];

/**
 * Triggers the native Android/iOS notification permission sheet directly at
 * runtime instead of showing a custom pre-permission modal.
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
    const userId = user?.id ?? null;
    const hasCompletedOnboarding = Boolean(user?.profile?.onboardingCompletedAt);
    const shouldSuppressPrompt = AUTO_PROMPT_BLOCKLIST.some((prefix) => pathname?.startsWith(prefix));

    useEffect(() => {
        if (!isNativePlatform()) {
            return;
        }

        if (!userId || !hasCompletedOnboarding || shouldSuppressPrompt) {
            return;
        }

        if (!isSupported || isPermissionGranted || isLoading) {
            return;
        }

        // Only auto-prompt on the first untouched state. If Android returns
        // prompt-with-rationale or denied, future changes should come from the
        // user's explicit action in Settings.
        if (permissionState !== 'prompt') {
            return;
        }

        if (hasSeenRuntimePermissionPrompt('notifications', userId)) {
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            if (cancelled) {
                return;
            }

            void requestPushPermission()
                .then(async (granted) => {
                    if (granted) {
                        markRuntimePermissionPromptSeen('notifications', userId);
                        logger.debug('Native notification permission granted from runtime prompt');
                        return;
                    }

                    // Only mark the prompt "seen" when the user made an explicit
                    // choice (granted or denied). A lingering `prompt` state means
                    // the system dialog never resolved (app backgrounded, race,
                    // transient error) — let us retry on the next session instead
                    // of silently giving up. Same for `unavailable`.
                    const { status } = await checkPermission('notifications');
                    if (status === 'denied' || status === 'granted') {
                        markRuntimePermissionPromptSeen('notifications', userId);
                    }
                    logger.debug(
                        `Native notification permission flow resolved with status=${status}`,
                    );
                })
                .catch((error) => {
                    logger.error('Failed to auto-request native notification permission:', error);
                });
        }, 900);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [
        hasCompletedOnboarding,
        isLoading,
        isPermissionGranted,
        isSupported,
        permissionState,
        requestPushPermission,
        shouldSuppressPrompt,
        userId,
    ]);

    return null;
}

export default PushNotificationPermissionPrompt;
