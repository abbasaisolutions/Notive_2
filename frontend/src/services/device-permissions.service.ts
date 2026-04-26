/**
 * Device Permissions Service
 *
 * Centralised check + request for every permission Notive can use.
 * Works on native (Capacitor) and degrades gracefully on web.
 *
 * Permissions handled:
 *  - Notifications (push)
 *  - Microphone (voice capture)
 *  - Location (entry context)
 */

import { isNativePlatform } from '@/utils/platform';

/* ─── Types ─────────────────────────────────────────── */

export type PermissionKind = 'notifications' | 'microphone' | 'location';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unavailable';

export interface PermissionResult {
    kind: PermissionKind;
    status: PermissionStatus;
}

export interface AllPermissions {
    notifications: PermissionStatus;
    microphone: PermissionStatus;
    location: PermissionStatus;
}

const PERMISSIONS_STORAGE_KEY = 'notive_permissions_onboarding_done';
const RUNTIME_PERMISSION_PROMPT_VERSION = 1;

const getRuntimePermissionPromptKey = (
    kind: PermissionKind,
    userId: string | null | undefined,
) => `notive_runtime_permission_prompt_v${RUNTIME_PERMISSION_PROMPT_VERSION}_${kind}_${userId || 'anon'}`;

function normalizeNativeNotificationPermissionState(
    value: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale',
): PermissionStatus {
    if (value === 'granted' || value === 'denied' || value === 'prompt-with-rationale') {
        return value;
    }

    return 'prompt';
}

async function checkNativeNotificationDisplayPermission(): Promise<PermissionStatus> {
    const [{ PushNotifications }, { LocalNotifications }] = await Promise.all([
        import('@capacitor/push-notifications'),
        import('@capacitor/local-notifications'),
    ]);

    const pushResult = await PushNotifications.checkPermissions();
    const pushState = normalizeNativeNotificationPermissionState(pushResult.receive);
    if (pushState !== 'granted') {
        return pushState;
    }

    const localResult = await LocalNotifications.checkPermissions();
    const localState = normalizeNativeNotificationPermissionState(localResult.display);
    if (localState !== 'granted') {
        return localState;
    }

    const enabledResult = await LocalNotifications.areEnabled();
    return enabledResult.value ? 'granted' : 'denied';
}

/* ─── Notification ──────────────────────────────────── */

async function checkNotificationPermission(): Promise<PermissionStatus> {
    if (!isNativePlatform()) {
        if (typeof Notification === 'undefined') return 'unavailable';
        const perm = Notification.permission;
        if (perm === 'granted') return 'granted';
        if (perm === 'denied') return 'denied';
        return 'prompt';
    }
    try {
        return await checkNativeNotificationDisplayPermission();
    } catch {
        return 'unavailable';
    }
}

async function requestNotificationPermission(): Promise<PermissionStatus> {
    if (!isNativePlatform()) {
        if (typeof Notification === 'undefined') return 'unavailable';
        const result = await Notification.requestPermission();
        if (result === 'granted') return 'granted';
        if (result === 'denied') return 'denied';
        return 'prompt';
    }
    try {
        const [{ PushNotifications }, { LocalNotifications }] = await Promise.all([
            import('@capacitor/push-notifications'),
            import('@capacitor/local-notifications'),
        ]);
        // Fast-path: if OS already granted, skip the prompt entirely.
        const currentState = await checkNativeNotificationDisplayPermission();
        if (currentState === 'granted') {
            await PushNotifications.register();
            return 'granted';
        }

        const pushResult = await PushNotifications.requestPermissions();
        const pushState = normalizeNativeNotificationPermissionState(pushResult.receive);
        if (pushState !== 'granted') {
            return pushState;
        }

        const localResult = await LocalNotifications.requestPermissions();
        const localState = normalizeNativeNotificationPermissionState(localResult.display);
        if (localState !== 'granted') {
            return localState;
        }

        const enabledResult = await LocalNotifications.areEnabled();
        if (!enabledResult.value) {
            return 'denied';
        }

        if (pushState === 'granted' && localState === 'granted') {
            await PushNotifications.register();
            return 'granted';
        }

        return 'prompt';
    } catch {
        return 'unavailable';
    }
}

/* ─── Microphone ────────────────────────────────────── */

async function checkMicrophonePermission(): Promise<PermissionStatus> {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
        return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
            ? 'prompt'
            : 'unavailable';
    }
    try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (result.state === 'granted') return 'granted';
        if (result.state === 'denied') return 'denied';
        return 'prompt';
    } catch {
        return 'prompt';
    }
}

async function requestMicrophonePermission(): Promise<PermissionStatus> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        return 'unavailable';
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        return 'granted';
    } catch {
        return 'denied';
    }
}

/* ─── Location ──────────────────────────────────────── */

async function checkLocationPermission(): Promise<PermissionStatus> {
    if (!isNativePlatform()) {
        if (typeof navigator === 'undefined') return 'unavailable';
        if (!navigator.permissions) {
            return navigator.geolocation ? 'prompt' : 'unavailable';
        }
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            if (result.state === 'granted') return 'granted';
            if (result.state === 'denied') return 'denied';
            return 'prompt';
        } catch {
            return 'prompt';
        }
    }
    try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const status = await Geolocation.checkPermissions();
        if (status.location === 'granted' || status.coarseLocation === 'granted') return 'granted';
        if (status.location === 'denied') return 'denied';
        return 'prompt';
    } catch {
        return 'unavailable';
    }
}

async function requestLocationPermission(): Promise<PermissionStatus> {
    if (!isNativePlatform()) {
        return new Promise<PermissionStatus>((resolve) => {
            if (typeof navigator === 'undefined' || !navigator.geolocation) {
                resolve('unavailable');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                () => resolve('granted'),
                (error) => resolve(error.code === error.PERMISSION_DENIED ? 'denied' : 'prompt'),
                { timeout: 8000 },
            );
        });
    }
    try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const status = await Geolocation.requestPermissions();
        if (status.location === 'granted' || status.coarseLocation === 'granted') return 'granted';
        return 'denied';
    } catch {
        return 'unavailable';
    }
}

/* ─── Public API ────────────────────────────────────── */

const CHECK_FNS: Record<PermissionKind, () => Promise<PermissionStatus>> = {
    notifications: checkNotificationPermission,
    microphone: checkMicrophonePermission,
    location: checkLocationPermission,
};

const REQUEST_FNS: Record<PermissionKind, () => Promise<PermissionStatus>> = {
    notifications: requestNotificationPermission,
    microphone: requestMicrophonePermission,
    location: requestLocationPermission,
};

export async function checkPermission(kind: PermissionKind): Promise<PermissionResult> {
    const status = await CHECK_FNS[kind]();
    return { kind, status };
}

export async function requestPermission(kind: PermissionKind): Promise<PermissionResult> {
    const status = await REQUEST_FNS[kind]();
    return { kind, status };
}

export async function checkAllPermissions(): Promise<AllPermissions> {
    const [notifications, microphone, location] = await Promise.all([
        checkNotificationPermission(),
        checkMicrophonePermission(),
        checkLocationPermission(),
    ]);
    return { notifications, microphone, location };
}

export async function requestAllPermissions(): Promise<AllPermissions> {
    // Request sequentially so OS prompts don't stack
    const notifications = await requestNotificationPermission();
    const microphone = await requestMicrophonePermission();
    const location = await requestLocationPermission();
    return { notifications, microphone, location };
}

export function hasCompletedPermissionsOnboarding(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(PERMISSIONS_STORAGE_KEY) === 'true';
}

export function markPermissionsOnboardingDone(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PERMISSIONS_STORAGE_KEY, 'true');
}

export function hasSeenRuntimePermissionPrompt(
    kind: PermissionKind,
    userId: string | null | undefined,
): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(getRuntimePermissionPromptKey(kind, userId)) === 'true';
}

export function markRuntimePermissionPromptSeen(
    kind: PermissionKind,
    userId: string | null | undefined,
): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getRuntimePermissionPromptKey(kind, userId), 'true');
}

export function clearRuntimePermissionPromptSeen(
    kind: PermissionKind,
    userId: string | null | undefined,
): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(getRuntimePermissionPromptKey(kind, userId));
}
