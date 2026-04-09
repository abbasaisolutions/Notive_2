'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import logger from '@/utils/logger';
import { useApi } from '@/hooks/use-api';
import { isNativePlatform, getNativePlatform } from '@/utils/platform';
import { type PermissionStatus } from '@/services/device-permissions.service';
import { useToast } from '@/context/toast-context';
import { hapticLight } from '@/services/haptics.service';
import { refreshNotificationBadge } from '@/hooks/use-notification-count';

export interface DeviceToken {
    id: string;
    token: string;
    platform: 'android' | 'ios' | 'web';
    deviceName?: string;
    appVersion?: string;
    osVersion?: string;
    lastUsedAt?: string;
}

export interface PushNotification {
    id: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    receivedAt: Date;
}

interface PushContextType {
    isSupported: boolean;
    isPermissionGranted: boolean;
    permissionState: PermissionStatus;
    isLoading: boolean;
    deviceTokens: DeviceToken[];
    notifications: PushNotification[];
    registerDevice: (token: string, platform: 'android' | 'ios' | 'web') => Promise<void>;
    unregisterDevice: (tokenId: string) => Promise<void>;
    requestPermission: () => Promise<boolean>;
    clearNotifications: () => void;
}

const PushContext = createContext<PushContextType | undefined>(undefined);
const FOREGROUND_TOAST_DURATION_MS = 6000;
const SOCIAL_TOAST_TYPES = new Set([
    'social',
    'shared_memory',
    'memory_share_request',
    'shared_memory_response',
    'share_reaction',
    'friend_request',
    'friend_accepted',
]);

const ANDROID_PUSH_CHANNEL = {
    id: 'notive_default',
    name: 'Notive updates',
    description: 'Reflection prompts, reminders, and important Notive updates.',
    importance: 5 as const,
    visibility: 1 as const,
    sound: 'default',
    vibration: true,
};

const ANDROID_PUSH_CHANNELS = [
    ANDROID_PUSH_CHANNEL,
    {
        id: 'notive_reminders',
        name: 'Journal reminders',
        description: 'Daily reflection prompts and journaling reminders.',
        importance: 5 as const,   // MAX — heads-up popup like WhatsApp
        visibility: 1 as const,   // PUBLIC — show on lock screen
        sound: 'default',
        vibration: true,
    },
    {
        id: 'notive_social',
        name: 'Friends & shared memories',
        description: 'Friend requests, shared memories, and reactions.',
        importance: 4 as const,   // HIGH — heads-up popup for social interactions
        visibility: 1 as const,   // PUBLIC — show on lock screen
        sound: 'default',
        vibration: true,
    },
    {
        id: 'notive_insights',
        name: 'Insights & analysis',
        description: 'AI insights ready and analysis updates.',
        importance: 2 as const,
        visibility: 1 as const,
        sound: 'default',
        vibration: false,
    },
];

function applyResolvedPushPermission(
    nextPermissionState: PermissionStatus,
    setPermissionState: (value: PermissionStatus) => void,
    setIsPermissionGranted: (value: boolean) => void,
): boolean {
    setPermissionState(nextPermissionState);
    const granted = nextPermissionState === 'granted';
    setIsPermissionGranted(granted);
    return granted;
}

export function PushNotificationProvider({ children }: { children: ReactNode }) {
    const { apiFetch } = useApi();
    const router = useRouter();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSupported, setIsSupported] = useState(false);
    const [isPermissionGranted, setIsPermissionGranted] = useState(false);
    const [permissionState, setPermissionState] = useState<PermissionStatus>('prompt');
    const [deviceTokens, setDeviceTokens] = useState<DeviceToken[]>([]);
    const [notifications, setNotifications] = useState<PushNotification[]>([]);

    // Initialize push notifications on mount
    useEffect(() => {
        if (!isNativePlatform()) {
            setIsSupported(false);
            setPermissionState('unavailable');
            setIsLoading(false);
            return;
        }

        initializePushNotifications();
    }, []);

    // Re-check permission state when app resumes (e.g. user returns from
    // Android notification settings). If the OS permission was toggled while
    // the app was backgrounded, we pick it up immediately.
    useEffect(() => {
        if (!isNativePlatform()) return;

        let listener: { remove: () => Promise<void> } | undefined;

        void App.addListener('appStateChange', async ({ isActive }) => {
            if (!isActive) return;
            try {
                const check = await PushNotifications.checkPermissions();
                const nextState = normalizePushPermissionState(check.receive);
                const granted = applyResolvedPushPermission(
                    nextState,
                    setPermissionState,
                    setIsPermissionGranted,
                );

                // If the user just enabled notifications via Settings, register now
                if (granted) {
                    await ensureAndroidPushChannel();
                    await PushNotifications.register();
                }
            } catch {
                // Non-fatal — will pick up on next resume
            }
        }).then((l) => { listener = l; });

        return () => { void listener?.remove(); };
    }, []);

    const initializePushNotifications = async () => {
        try {
            setIsLoading(true);

            // Check if push notifications are supported
            const isAvailable = await checkPushSupport();
            setIsSupported(isAvailable);

            if (!isAvailable) {
                setPermissionState('unavailable');
                setIsLoading(false);
                return;
            }

            // Set up event listeners
            await setupPushListeners();

            // Ensure the Android channel exists before the first notification arrives.
            await ensureAndroidPushChannel();

            // Always check current OS permission status first so we never
            // re-show the OS prompt when the user already granted access.
            const check = await PushNotifications.checkPermissions();
            const nextPermissionState = normalizePushPermissionState(check.receive);
            const alreadyGranted = applyResolvedPushPermission(
                nextPermissionState,
                setPermissionState,
                setIsPermissionGranted,
            );

            if (alreadyGranted) {
                // Permission already granted — just ensure token registration.
                await PushNotifications.register();
            }
            // If permission is not yet granted, wait for a contextual ask from
            // onboarding, the in-app prompt, or the profile screen.
        } catch (error) {
            logger.error('Failed to initialize push notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const checkPushSupport = async (): Promise<boolean> => {
        try {
            // On native platforms, push is supported
            return isNativePlatform();
        } catch {
            return false;
        }
    };

    const setupPushListeners = async () => {
        try {
            // Handle token received — also syncs isPermissionGranted because
            // receiving a token proves the OS permission is granted (covers
            // cases where permission was requested outside this context, e.g.
            // the onboarding flow's standalone device-permissions service).
            PushNotifications.addListener('registration', (token: any) => {
                logger.debug('Push token received:', token.value);
                applyResolvedPushPermission('granted', setPermissionState, setIsPermissionGranted);
                registerDevice(token.value, getPlatform()).catch(err =>
                    logger.error('Failed to auto-register token:', err)
                );
            });

            // Handle registration error
            PushNotifications.addListener('registrationError', (error: any) => {
                logger.error('Push registration error:', error);
            });

            // Handle notification when app is in foreground
            PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
                logger.debug('Push notification received:', notification);
                addNotificationToState(notification);

                // Show an in-app toast and only clear the matching delivered
                // notification instead of wiping the whole notification tray.
                hapticLight();
                showNotificationToast(notification);
                refreshNotificationBadge();
                void removeForegroundDuplicateNotification(notification);
            });

            // Handle notification action (tap)
            PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
                logger.debug('Push notification action performed:', notification);
                handleNotificationAction(notification);
            });
        } catch (error) {
            logger.error('Failed to setup push listeners:', error);
        }
    };

    const ensureAndroidPushChannel = async () => {
        if (getPlatform() !== 'android') {
            return;
        }

        try {
            const { channels } = await PushNotifications.listChannels();
            const existingChannels = new Map(
                channels.map((channel) => [channel.id, channel])
            );

            for (const channel of ANDROID_PUSH_CHANNELS) {
                const existingChannel = existingChannels.get(channel.id);
                const needsRecreate = existingChannel
                    && (existingChannel.importance !== channel.importance
                        || existingChannel.visibility !== channel.visibility);

                if (needsRecreate) {
                    await PushNotifications.deleteChannel({ id: channel.id });
                }

                await PushNotifications.createChannel(channel);
            }
        } catch (error) {
            logger.debug('Push channel creation error (may already exist):', error);
        }
    };

    const getPlatform = (): 'android' | 'ios' | 'web' => {
        return getNativePlatform();
    };

    const requestPermission = async (): Promise<boolean> => {
        try {
            // Fast-path: if already granted, skip the OS prompt entirely.
            const check = await PushNotifications.checkPermissions();
            const nextPermissionState = normalizePushPermissionState(check.receive);
            if (applyResolvedPushPermission(
                nextPermissionState,
                setPermissionState,
                setIsPermissionGranted,
            )) {
                await ensureAndroidPushChannel();
                await PushNotifications.register();
                return true;
            }

            const result = await PushNotifications.requestPermissions();
            const updatedPermissionState = normalizePushPermissionState(result.receive);
            const granted = applyResolvedPushPermission(
                updatedPermissionState,
                setPermissionState,
                setIsPermissionGranted,
            );

            if (granted) {
                await ensureAndroidPushChannel();
                await PushNotifications.register();
            }

            return granted;
        } catch (error) {
            logger.error('Failed to request push permissions:', error);
            return false;
        }
    };

    const registerDevice = async (token: string, platform: 'android' | 'ios' | 'web') => {
        try {
            const response = await apiFetch('/devices/tokens', {
                method: 'POST',
                body: JSON.stringify({
                    token,
                    platform,
                    deviceId: await getDeviceId(),
                    deviceName: await getDeviceName(),
                    appVersion: await getAppVersion(),
                    osVersion: await getOsVersion(),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to register device token');
            }

            const data = await response.json();
            logger.debug('Device token registered:', data);

            await fetchDeviceTokens();
        } catch (error) {
            logger.error('Failed to register device:', error);
            throw error;
        }
    };

    const unregisterDevice = async (tokenId: string) => {
        try {
            const response = await apiFetch(`/devices/tokens/${tokenId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to unregister device token');
            }

            setDeviceTokens(prev => prev.filter(t => t.id !== tokenId));
            logger.debug('Device token unregistered:', tokenId);
        } catch (error) {
            logger.error('Failed to unregister device:', error);
            throw error;
        }
    };

    const fetchDeviceTokens = async () => {
        try {
            const response = await apiFetch('/devices/tokens');

            if (!response.ok) {
                throw new Error('Failed to fetch device tokens');
            }

            const data = await response.json();
            setDeviceTokens(data.data || []);
        } catch (error) {
            logger.error('Failed to fetch device tokens:', error);
        }
    };

    const addNotificationToState = (notification: any) => {
        const newNotif: PushNotification = {
            id: notification.id || `notif-${Date.now()}`,
            title: notification.title || 'Notification',
            body: notification.body || '',
            data: notification.data,
            receivedAt: new Date(),
        };

        setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // Keep last 50
    };

    const clearNotifications = () => {
        setNotifications([]);
    };

    const removeForegroundDuplicateNotification = async (notification: any) => {
        try {
            const delivered = await PushNotifications.getDeliveredNotifications();
            const notificationId = typeof notification?.id === 'string' ? notification.id : '';
            const notificationTag = typeof notification?.tag === 'string' ? notification.tag : '';

            const matching = delivered.notifications.filter((item) => {
                if (notificationId && item.id === notificationId) return true;
                if (notificationTag && item.tag === notificationTag) return true;
                return false;
            });

            if (matching.length > 0) {
                await PushNotifications.removeDeliveredNotifications({ notifications: matching });
            }
        } catch {
            // Non-fatal: better to keep a tray item than to break foreground handling.
        }
    };

    const showNotificationToast = (notification: any) => {
        const title = notification.title || 'Notive';
        const body = notification.body || '';
        const data = notification.data || {};
        const deepLink = data?.link || data?.route;
        const actionLabel = resolveNotificationActionLabel(data?.type, deepLink);

        toast.addToast({
            title,
            description: body,
            variant: 'notification',
            duration: FOREGROUND_TOAST_DURATION_MS,
            action: deepLink
                ? { label: actionLabel, onClick: () => router.push(deepLink) }
                : undefined,
        });
    };

    const handleNotificationAction = async (notification: any) => {
        // Handle deep linking or navigation based on notification data
        const data = notification.notification?.data || notification.data;
        const deepLink = data?.link || data?.route;
        if (deepLink) {
            router.push(deepLink);
        }
    };

    const getDeviceId = async (): Promise<string | undefined> => {
        try {
            const info = await App.getInfo();
            return info.id;
        } catch {
            return undefined;
        }
    };

    const getDeviceName = async (): Promise<string | undefined> => {
        try {
            const info = await App.getInfo();
            return info.name;
        } catch {
            return undefined;
        }
    };

    const getAppVersion = async (): Promise<string | undefined> => {
        try {
            const info = await App.getInfo();
            return info.version;
        } catch {
            return undefined;
        }
    };

    const getOsVersion = async (): Promise<string | undefined> => {
        try {
            const cap = (window as any).Capacitor;
            if (cap?.Plugins?.Device?.getInfo) {
                const info = await cap.Plugins.Device.getInfo();
                return info.osVersion;
            }
            return undefined;
        } catch {
            return undefined;
        }
    };

    return (
        <PushContext.Provider
            value={{
                isSupported,
                isPermissionGranted,
                permissionState,
                isLoading,
                deviceTokens,
                notifications,
                registerDevice,
                unregisterDevice,
                requestPermission,
                clearNotifications,
            }}
        >
            {children}
        </PushContext.Provider>
    );
}

export function usePushNotifications(): PushContextType {
    const context = useContext(PushContext);
    if (!context) {
        throw new Error('usePushNotifications must be used within PushNotificationProvider');
    }
    return context;
}

function normalizePushPermissionState(
    value: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'
): PermissionStatus {
    if (value === 'granted' || value === 'denied' || value === 'prompt-with-rationale') {
        return value;
    }
    return 'prompt';
}

function resolveNotificationActionLabel(type: string | undefined, deepLink: string | undefined): string {
    if (!deepLink) return 'Open';
    if (type === 'reminder') return 'Write now';
    if (type && SOCIAL_TOAST_TYPES.has(type)) return 'Open shared';
    return 'Open';
}
