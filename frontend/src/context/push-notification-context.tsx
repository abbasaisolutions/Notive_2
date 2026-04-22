'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import logger from '@/utils/logger';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/context/auth-context';
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

type DevicePlatform = DeviceToken['platform'];

interface PendingPushRegistration {
    token: string;
    platform: DevicePlatform;
    source: string;
    queuedAt: string;
    attempts: number;
    lastAttemptAt?: string;
    lastError?: string;
}

const PushContext = createContext<PushContextType | undefined>(undefined);
const FOREGROUND_TOAST_DURATION_MS = 6000;
const PENDING_PUSH_REGISTRATION_KEY = 'notive_pending_push_registration_v1';
const PUSH_REGISTRATION_BASE_DELAY_MS = 5_000;
const PUSH_REGISTRATION_MAX_DELAY_MS = 5 * 60_000;
const PUSH_REGISTRATION_MAX_RETRIES = 6;
const SOCIAL_TOAST_TYPES = new Set([
    'social',
    'shared_memory',
    'memory_share_request',
    'shared_memory_response',
    'share_reaction',
    'friend_request',
    'friend_accepted',
]);
const LEGACY_ANDROID_DEFAULT_SOUND_SEGMENT = '/raw/default';

const ANDROID_PUSH_CHANNEL = {
    id: 'notive_default',
    name: 'Notive updates',
    description: 'Reflection prompts, reminders, and important Notive updates.',
    importance: 5 as const,
    visibility: 1 as const,
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
        vibration: true,
    },
    {
        id: 'notive_social',
        name: 'Friends & shared memories',
        description: 'Friend requests, shared memories, and reactions.',
        importance: 5 as const,   // MAX — match messaging-style heads-up behaviour
        visibility: 1 as const,   // PUBLIC — show on lock screen
        vibration: true,
    },
    {
        id: 'notive_insights',
        name: 'Insights & analysis',
        description: 'AI insights ready and analysis updates.',
        importance: 2 as const,
        visibility: 1 as const,
        vibration: false,
    },
];
const DEVICE_TOKENS_API_PATH = '/device/tokens';

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

const getPushRegistrationStorage = (): Storage | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
};

function readPendingPushRegistration(): PendingPushRegistration | null {
    const storage = getPushRegistrationStorage();
    if (!storage) return null;

    try {
        const raw = storage.getItem(PENDING_PUSH_REGISTRATION_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<PendingPushRegistration>;
        if (
            typeof parsed.token !== 'string'
            || typeof parsed.platform !== 'string'
            || typeof parsed.source !== 'string'
            || typeof parsed.queuedAt !== 'string'
        ) {
            storage.removeItem(PENDING_PUSH_REGISTRATION_KEY);
            return null;
        }

        return {
            token: parsed.token,
            platform: parsed.platform as DevicePlatform,
            source: parsed.source,
            queuedAt: parsed.queuedAt,
            attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
            lastAttemptAt: typeof parsed.lastAttemptAt === 'string' ? parsed.lastAttemptAt : undefined,
            lastError: typeof parsed.lastError === 'string' ? parsed.lastError : undefined,
        };
    } catch {
        storage.removeItem(PENDING_PUSH_REGISTRATION_KEY);
        return null;
    }
}

function writePendingPushRegistration(pending: PendingPushRegistration | null): void {
    const storage = getPushRegistrationStorage();
    if (!storage) return;

    if (!pending) {
        storage.removeItem(PENDING_PUSH_REGISTRATION_KEY);
        return;
    }

    storage.setItem(PENDING_PUSH_REGISTRATION_KEY, JSON.stringify(pending));
}

function getPushTokenPreview(token: string): string {
    const trimmed = token.trim();
    if (trimmed.length <= 18) return trimmed;
    return `${trimmed.slice(0, 10)}...${trimmed.slice(-6)}`;
}

function getPushRegistrationRetryDelayMs(attempts: number): number {
    const exponent = Math.max(attempts - 1, 0);
    return Math.min(PUSH_REGISTRATION_BASE_DELAY_MS * (2 ** exponent), PUSH_REGISTRATION_MAX_DELAY_MS);
}

function getPushRegistrationStatusCode(error: unknown): number | null {
    if (!error || typeof error !== 'object') return null;
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : null;
}

function getPushRegistrationErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message.trim();
    }

    if (typeof error === 'string' && error.trim()) {
        return error.trim();
    }

    return 'Unknown push registration error';
}

function shouldRetryPushRegistration(error: unknown, attempts: number): boolean {
    if (attempts >= PUSH_REGISTRATION_MAX_RETRIES) return false;

    const status = getPushRegistrationStatusCode(error);
    if (status === null) return true;
    if (status === 401 || status === 403 || status === 429) return true;
    return status >= 500;
}

function hasForegroundNotificationContent(notification: any): boolean {
    return typeof notification?.title === 'string' && notification.title.trim().length > 0
        || typeof notification?.body === 'string' && notification.body.trim().length > 0;
}

function shouldUseNativeForegroundAlert(notification: any): boolean {
    return isNativePlatform() && hasForegroundNotificationContent(notification);
}

function shouldResetAndroidChannelSound(existingChannel: { sound?: unknown } | undefined): boolean {
    if (!existingChannel) return false;
    return typeof existingChannel.sound === 'string'
        && existingChannel.sound.includes(LEGACY_ANDROID_DEFAULT_SOUND_SEGMENT);
}

async function readApiErrorMessage(response: Response): Promise<string> {
    try {
        const data = await response.json() as { message?: unknown };
        if (typeof data?.message === 'string' && data.message.trim()) {
            return data.message.trim();
        }
    } catch {
        // Fall through to status text.
    }

    return response.statusText || `Request failed with status ${response.status}`;
}

export function PushNotificationProvider({ children }: { children: ReactNode }) {
    const { apiFetch } = useApi();
    const { user, accessToken } = useAuth();
    const router = useRouter();
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSupported, setIsSupported] = useState(false);
    const [isPermissionGranted, setIsPermissionGranted] = useState(false);
    const [permissionState, setPermissionState] = useState<PermissionStatus>('prompt');
    const [deviceTokens, setDeviceTokens] = useState<DeviceToken[]>([]);
    const [notifications, setNotifications] = useState<PushNotification[]>([]);
    const hasInitializedPushRef = useRef(false);
    const pendingPushRegistrationRef = useRef<PendingPushRegistration | null>(readPendingPushRegistration());
    const pushRegistrationInFlightRef = useRef(false);
    const pushRegistrationRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flushPendingPushRegistrationRef = useRef<(reason?: string) => Promise<void>>(async () => {});

    const getPlatform = useCallback((): 'android' | 'ios' | 'web' => {
        return getNativePlatform();
    }, []);

    const getDeviceId = useCallback(async (): Promise<string | undefined> => {
        try {
            const info = await App.getInfo();
            return info.id;
        } catch {
            return undefined;
        }
    }, []);

    const getDeviceName = useCallback(async (): Promise<string | undefined> => {
        try {
            const info = await App.getInfo();
            return info.name;
        } catch {
            return undefined;
        }
    }, []);

    const getAppVersion = useCallback(async (): Promise<string | undefined> => {
        try {
            const info = await App.getInfo();
            return info.version;
        } catch {
            return undefined;
        }
    }, []);

    const getOsVersion = useCallback(async (): Promise<string | undefined> => {
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
    }, []);

    const clearPushRegistrationRetryTimer = useCallback(() => {
        if (pushRegistrationRetryTimerRef.current) {
            clearTimeout(pushRegistrationRetryTimerRef.current);
            pushRegistrationRetryTimerRef.current = null;
        }
    }, []);

    const setPendingPushRegistration = useCallback((pending: PendingPushRegistration | null) => {
        pendingPushRegistrationRef.current = pending;
        writePendingPushRegistration(pending);

        if (!pending) {
            clearPushRegistrationRetryTimer();
        }
    }, [clearPushRegistrationRetryTimer]);

    const fetchDeviceTokens = useCallback(async () => {
        if (!user?.id) return;

        try {
            const response = await apiFetch(DEVICE_TOKENS_API_PATH);

            if (!response.ok) {
                throw new Error('Failed to fetch device tokens');
            }

            const data = await response.json();
            setDeviceTokens(data.data || []);
        } catch (error) {
            logger.error('Failed to fetch device tokens:', error);
        }
    }, [apiFetch, user?.id]);

    const performDeviceRegistration = useCallback(async (token: string, platform: DevicePlatform) => {
        const response = await apiFetch(DEVICE_TOKENS_API_PATH, {
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
            const error = new Error(await readApiErrorMessage(response)) as Error & { status?: number };
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        logger.debug('Device token registered:', {
            platform,
            token: getPushTokenPreview(token),
        });

        await fetchDeviceTokens();
        return data;
    }, [apiFetch, fetchDeviceTokens, getAppVersion, getDeviceId, getDeviceName, getOsVersion]);

    const flushPendingPushRegistration = useCallback(async (reason = 'manual') => {
        const pending = pendingPushRegistrationRef.current;
        if (!pending || pushRegistrationInFlightRef.current) {
            return;
        }

        if (!user?.id) {
            logger.debug('Push token registration waiting for authenticated user', {
                reason,
                token: getPushTokenPreview(pending.token),
            });
            return;
        }

        pushRegistrationInFlightRef.current = true;
        clearPushRegistrationRetryTimer();

        const attemptRecord: PendingPushRegistration = {
            ...pending,
            attempts: pending.attempts + 1,
            lastAttemptAt: new Date().toISOString(),
        };
        setPendingPushRegistration(attemptRecord);

        try {
            await performDeviceRegistration(attemptRecord.token, attemptRecord.platform);

            const stillCurrent = pendingPushRegistrationRef.current?.token === attemptRecord.token
                && pendingPushRegistrationRef.current?.platform === attemptRecord.platform;

            if (stillCurrent) {
                setPendingPushRegistration(null);
            }
        } catch (error) {
            const message = getPushRegistrationErrorMessage(error);
            const stillCurrent = pendingPushRegistrationRef.current?.token === attemptRecord.token
                && pendingPushRegistrationRef.current?.platform === attemptRecord.platform;

            if (stillCurrent) {
                setPendingPushRegistration({
                    ...attemptRecord,
                    lastError: message,
                });
            }

            const shouldRetry = shouldRetryPushRegistration(error, attemptRecord.attempts);
            logger.error('Push token registration failed', {
                reason,
                attempts: attemptRecord.attempts,
                platform: attemptRecord.platform,
                token: getPushTokenPreview(attemptRecord.token),
                status: getPushRegistrationStatusCode(error) ?? undefined,
                message,
                willRetry: shouldRetry,
            });

            if (shouldRetry) {
                const delayMs = getPushRegistrationRetryDelayMs(attemptRecord.attempts);
                pushRegistrationRetryTimerRef.current = setTimeout(() => {
                    void flushPendingPushRegistrationRef.current('scheduled-retry');
                }, delayMs);
            }
        } finally {
            pushRegistrationInFlightRef.current = false;
        }
    }, [clearPushRegistrationRetryTimer, performDeviceRegistration, setPendingPushRegistration, user?.id]);

    useEffect(() => {
        flushPendingPushRegistrationRef.current = flushPendingPushRegistration;
    }, [flushPendingPushRegistration]);

    const queueDeviceRegistration = useCallback((
        token: string,
        platform: DevicePlatform,
        source: string,
    ) => {
        const normalizedToken = token.trim();
        if (!normalizedToken) {
            logger.error('Refusing to queue an empty push token', {
                source,
                platform,
            });
            return;
        }

        const nextPending: PendingPushRegistration = {
            token: normalizedToken,
            platform,
            source,
            queuedAt: new Date().toISOString(),
            attempts: 0,
        };

        setPendingPushRegistration(nextPending);
        void flushPendingPushRegistrationRef.current(source);
    }, [setPendingPushRegistration]);

    const registerDevice = useCallback(async (token: string, platform: DevicePlatform) => {
        const normalizedToken = token.trim();
        queueDeviceRegistration(normalizedToken, platform, 'manual-register');
        await flushPendingPushRegistrationRef.current('manual-register');

        const pending = pendingPushRegistrationRef.current;
        if (pending?.token === normalizedToken && pending.platform === platform) {
            throw new Error(pending.lastError || 'Push token registration queued for retry');
        }
    }, [queueDeviceRegistration]);

    const unregisterDevice = useCallback(async (tokenId: string) => {
        try {
            const response = await apiFetch(`${DEVICE_TOKENS_API_PATH}/${tokenId}`, {
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
    }, [apiFetch]);

    const addNotificationToState = useCallback((notification: any) => {
        const newNotif: PushNotification = {
            id: notification.id || `notif-${Date.now()}`,
            title: notification.title || 'Notification',
            body: notification.body || '',
            data: notification.data,
            receivedAt: new Date(),
        };

        setNotifications(prev => [newNotif, ...prev].slice(0, 50));
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const removeForegroundDuplicateNotification = useCallback(async (notification: any) => {
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
    }, []);

    const markNotificationRead = useCallback(async (notificationId: string | undefined) => {
        if (!notificationId) return;

        try {
            const response = await apiFetch(`/notifications/${notificationId}/read`, {
                method: 'PATCH',
            });

            if (response.ok) {
                refreshNotificationBadge();
            }
        } catch {
            // Non-fatal: destination screens can retry the read mutation.
        }
    }, [apiFetch]);

    const showNotificationToast = useCallback((notification: any) => {
        const title = notification.title || 'Notive';
        const body = notification.body || '';
        const data = notification.data || {};
        const deepLink = data?.link || data?.route;
        const notificationId = typeof data?.notificationId === 'string' ? data.notificationId : undefined;
        const actionLabel = resolveNotificationActionLabel(data?.type, deepLink);

        addToast({
            title,
            description: body,
            variant: 'notification',
            duration: FOREGROUND_TOAST_DURATION_MS,
            action: deepLink
                ? {
                    label: actionLabel,
                    onClick: () => {
                        void markNotificationRead(notificationId);
                        router.push(deepLink);
                    },
                }
                : undefined,
        });
    }, [addToast, markNotificationRead, router]);

    const handleNotificationAction = useCallback(async (notification: any) => {
        const data = notification.notification?.data || notification.data;
        const notificationId = typeof data?.notificationId === 'string' ? data.notificationId : undefined;
        const deepLink = data?.link || data?.route;
        void markNotificationRead(notificationId);
        if (deepLink) {
            router.push(deepLink);
        }
    }, [markNotificationRead, router]);

    const ensureAndroidPushChannel = useCallback(async () => {
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
                        || existingChannel.visibility !== channel.visibility
                        || shouldResetAndroidChannelSound(existingChannel));

                if (needsRecreate) {
                    await PushNotifications.deleteChannel({ id: channel.id });
                }

                await PushNotifications.createChannel(channel);
            }
        } catch (error) {
            logger.debug('Push channel creation error (may already exist):', error);
        }
    }, [getPlatform]);

    const checkPushSupport = useCallback(async (): Promise<boolean> => {
        try {
            return isNativePlatform();
        } catch {
            return false;
        }
    }, []);

    const setupPushListeners = useCallback(async () => {
        try {
            PushNotifications.addListener('registration', (token: any) => {
                const tokenValue = typeof token?.value === 'string' ? token.value.trim() : '';
                if (!tokenValue) {
                    logger.error('Push registration returned an empty token', token);
                    return;
                }

                logger.debug('Push token received:', getPushTokenPreview(tokenValue));
                applyResolvedPushPermission('granted', setPermissionState, setIsPermissionGranted);
                queueDeviceRegistration(tokenValue, getPlatform(), 'native-registration');
            });

            PushNotifications.addListener('registrationError', (error: any) => {
                logger.error('Push registration error:', error);
            });

            PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
                logger.debug('Push notification received:', notification);
                addNotificationToState(notification);
                const useNativeForegroundAlert = shouldUseNativeForegroundAlert(notification);
                if (!useNativeForegroundAlert) {
                    void removeForegroundDuplicateNotification(notification);
                }
                hapticLight();
                if (!useNativeForegroundAlert) {
                    showNotificationToast(notification);
                }
                refreshNotificationBadge();
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
                logger.debug('Push notification action performed:', notification);
                void handleNotificationAction(notification);
            });
        } catch (error) {
            logger.error('Failed to setup push listeners:', error);
        }
    }, [addNotificationToState, getPlatform, handleNotificationAction, queueDeviceRegistration, removeForegroundDuplicateNotification, showNotificationToast]);

    const initializePushNotifications = useCallback(async () => {
        try {
            setIsLoading(true);

            const isAvailable = await checkPushSupport();
            setIsSupported(isAvailable);

            if (!isAvailable) {
                setPermissionState('unavailable');
                setIsLoading(false);
                return;
            }

            await setupPushListeners();
            await ensureAndroidPushChannel();

            const check = await PushNotifications.checkPermissions();
            const nextPermissionState = normalizePushPermissionState(check.receive);
            const alreadyGranted = applyResolvedPushPermission(
                nextPermissionState,
                setPermissionState,
                setIsPermissionGranted,
            );

            if (alreadyGranted) {
                await PushNotifications.register();
            }
        } catch (error) {
            logger.error('Failed to initialize push notifications:', error);
        } finally {
            setIsLoading(false);
        }
    }, [checkPushSupport, ensureAndroidPushChannel, setupPushListeners]);

    useEffect(() => {
        if (!isNativePlatform()) {
            setIsSupported(false);
            setPermissionState('unavailable');
            setIsLoading(false);
            return;
        }

        if (hasInitializedPushRef.current) return;
        hasInitializedPushRef.current = true;
        void initializePushNotifications();
    }, [initializePushNotifications]);

    useEffect(() => {
        return () => {
            clearPushRegistrationRetryTimer();
        };
    }, [clearPushRegistrationRetryTimer]);

    useEffect(() => {
        if (!isNativePlatform()) return;
        if (!isPermissionGranted) return;
        if (!user?.id) return;

        void fetchDeviceTokens();
        void flushPendingPushRegistrationRef.current('auth-ready');
    }, [accessToken, fetchDeviceTokens, isPermissionGranted, user?.id]);

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

                if (granted) {
                    await ensureAndroidPushChannel();
                    await PushNotifications.register();
                }
            } catch {
                // Non-fatal — will pick up on next resume
            }
        }).then((l) => { listener = l; });

        return () => { void listener?.remove(); };
    }, [ensureAndroidPushChannel]);

    const requestPermission = useCallback(async (): Promise<boolean> => {
        try {
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
    }, [ensureAndroidPushChannel]);

    const value = useMemo(() => ({
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
    }), [
        clearNotifications,
        deviceTokens,
        isLoading,
        isPermissionGranted,
        isSupported,
        notifications,
        permissionState,
        registerDevice,
        requestPermission,
        unregisterDevice,
    ]);

    return (
        <PushContext.Provider
            value={value}
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
    if (type === 'shared_memory' || type === 'share_reaction') return 'View memories';
    if (type && SOCIAL_TOAST_TYPES.has(type)) return 'Open shared';
    return 'Open';
}
