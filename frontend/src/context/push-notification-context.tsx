'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import logger from '@/utils/logger';
import { useApi } from '@/hooks/use-api';
import { isNativePlatform, getNativePlatform } from '@/utils/platform';
import { hasCompletedPermissionsOnboarding } from '@/services/device-permissions.service';

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
    isLoading: boolean;
    deviceTokens: DeviceToken[];
    notifications: PushNotification[];
    registerDevice: (token: string, platform: 'android' | 'ios' | 'web') => Promise<void>;
    unregisterDevice: (tokenId: string) => Promise<void>;
    requestPermission: () => Promise<boolean>;
    clearNotifications: () => void;
}

const PushContext = createContext<PushContextType | undefined>(undefined);

const ANDROID_PUSH_CHANNEL = {
    id: 'notive_default',
    name: 'Notive updates',
    description: 'Reflection prompts, reminders, and important Notive updates.',
    importance: 5 as const,
    visibility: 1 as const,
    sound: 'default',
    vibration: true,
};

export function PushNotificationProvider({ children }: { children: ReactNode }) {
    const { apiFetch } = useApi();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSupported, setIsSupported] = useState(false);
    const [isPermissionGranted, setIsPermissionGranted] = useState(false);
    const [deviceTokens, setDeviceTokens] = useState<DeviceToken[]>([]);
    const [notifications, setNotifications] = useState<PushNotification[]>([]);

    // Initialize push notifications on mount
    useEffect(() => {
        if (!isNativePlatform()) {
            setIsSupported(false);
            setIsLoading(false);
            return;
        }

        initializePushNotifications();
    }, []);

    const initializePushNotifications = async () => {
        try {
            setIsLoading(true);

            // Check if push notifications are supported
            const isAvailable = await checkPushSupport();
            setIsSupported(isAvailable);

            if (!isAvailable) {
                setIsLoading(false);
                return;
            }

            // Set up event listeners
            await setupPushListeners();

            // Ensure the Android channel exists before the first notification arrives.
            await ensureAndroidPushChannel();

            // Only auto-request permission if the user has already been through the
            // permissions onboarding step. Otherwise, let that step handle the first ask
            // so the OS prompt comes with context instead of on a cold mount.
            if (hasCompletedPermissionsOnboarding()) {
                await requestPermission();
            } else {
                // Still check current status so UI reflects reality
                const check = await PushNotifications.checkPermissions();
                const alreadyGranted = check.receive === 'granted';
                setIsPermissionGranted(alreadyGranted);

                // Existing users who granted permission before the onboarding
                // flag existed still need token registration on every app start.
                if (alreadyGranted) {
                    await PushNotifications.register();
                }
            }
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
                setIsPermissionGranted(true);
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

                // Optional: Show a toast or badge
                showNotificationToast(notification);
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
            await PushNotifications.createChannel(ANDROID_PUSH_CHANNEL);
        } catch (error) {
            logger.debug('Push channel already exists or could not be created:', error);
        }
    };

    const getPlatform = (): 'android' | 'ios' | 'web' => {
        return getNativePlatform();
    };

    const requestPermission = async (): Promise<boolean> => {
        try {
            const result = await PushNotifications.requestPermissions();
            const granted = result.receive === 'granted';
            setIsPermissionGranted(granted);

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

    const showNotificationToast = (notification: any) => {
        // This would typically show a toast/banner
        // For now, just log it
        logger.debug('Notification toast would show:', notification.title);
    };

    const handleNotificationAction = async (notification: any) => {
        // Handle deep linking or navigation based on notification data
        const data = notification.notification?.data || notification.data;
        if (data?.link) {
            router.push(data.link);
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
