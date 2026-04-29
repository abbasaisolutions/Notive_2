'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import {
    checkPermission,
    hasSeenRuntimePermissionPrompt,
    markRuntimePermissionPromptSeen,
} from '@/services/device-permissions.service';
import { isNativePlatform } from '@/utils/platform';
import logger from '@/utils/logger';

const AUTO_PROMPT_BLOCKLIST = [
    '/forgot-password',
    '/reset-password',
    '/entry/new',
    '/share',
    '/shared',
];
const NOTIFICATION_AUTO_PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
    const pathname = usePathname();
    const permissionScopeUserId = null;
    const shouldSuppressPrompt = AUTO_PROMPT_BLOCKLIST.some((prefix) => pathname?.startsWith(prefix));

    useEffect(() => {
        if (!isNativePlatform()) {
            return;
        }

        if (shouldSuppressPrompt) {
            return;
        }

        if (!isSupported || isPermissionGranted || isLoading) {
            return;
        }

        // Prompt on first install/open, then allow a later retry when Android
        // says a rationale is appropriate. Denied states stay user-initiated
        // from Settings or from feature-specific actions.
        if (permissionState !== 'prompt' && permissionState !== 'prompt-with-rationale') {
            return;
        }

        if (hasSeenRuntimePermissionPrompt('notifications', permissionScopeUserId, NOTIFICATION_AUTO_PROMPT_COOLDOWN_MS)) {
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
                        markRuntimePermissionPromptSeen('notifications', permissionScopeUserId, 'granted');
                        logger.debug('Native notification permission granted from runtime prompt');
                        return;
                    }

                    const { status } = await checkPermission('notifications');
                    markRuntimePermissionPromptSeen('notifications', permissionScopeUserId, status);
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
        isLoading,
        isPermissionGranted,
        isSupported,
        permissionScopeUserId,
        permissionState,
        requestPushPermission,
        shouldSuppressPrompt,
    ]);

    return null;
}

export default PushNotificationPermissionPrompt;
