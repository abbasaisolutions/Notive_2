'use client';

import { useCallback } from 'react';
import { usePushNotifications as useContextPushNotifications } from '@/context/push-notification-context';

/**
 * Hook to easily use push notifications in components
 * Provides simplified interface for common push notification operations
 */
export function usePushNotifications() {
    const context = useContextPushNotifications();

    const requestPushPermission = useCallback(async () => {
        try {
            const granted = await context.requestPermission();
            return granted;
        } catch (error) {
            console.error('Failed to request push permission:', error);
            return false;
        }
    }, [context]);

    const registerPushToken = useCallback(
        async (token: string, platform: 'android' | 'ios' | 'web') => {
            try {
                await context.registerDevice(token, platform);
            } catch (error) {
                console.error('Failed to register push token:', error);
                throw error;
            }
        },
        [context]
    );

    const unregisterPushToken = useCallback(
        async (tokenId: string) => {
            try {
                await context.unregisterDevice(tokenId);
            } catch (error) {
                console.error('Failed to unregister push token:', error);
                throw error;
            }
        },
        [context]
    );

    const getDismissedNotifications = useCallback(() => {
        return context.notifications || [];
    }, [context.notifications]);

    const clearNotifications = useCallback(() => {
        context.clearNotifications();
    }, [context]);

    return {
        // Status
        isSupported: context.isSupported,
        isPermissionGranted: context.isPermissionGranted,
        isLoading: context.isLoading,

        // Data
        deviceTokens: context.deviceTokens,
        notifications: context.notifications,

        // Methods
        requestPushPermission,
        registerPushToken,
        unregisterPushToken,
        getDismissedNotifications,
        clearNotifications,
    };
}
