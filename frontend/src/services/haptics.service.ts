/**
 * Haptics service — prefers the Capacitor plugin on native (iOS + Android),
 * falls back to navigator.vibrate on web (Android Chrome). iOS Safari has no
 * haptic API; there, all calls are silent no-ops.
 *
 * The Capacitor plugin is loaded lazily so the web bundle doesn't import native code.
 */

import { getNativePlatform } from '@/utils/platform';

type HapticsPlugin = {
    impact: (options: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>;
    notification: (options: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void>;
    vibrate: (options: { duration: number }) => Promise<void>;
};

let cachedHaptics: HapticsPlugin | null | undefined;
let loadingHaptics: Promise<HapticsPlugin | null> | null = null;

async function getCapacitorHaptics(): Promise<HapticsPlugin | null> {
    if (cachedHaptics !== undefined) return cachedHaptics;
    if (getNativePlatform() === 'web') {
        cachedHaptics = null;
        return null;
    }
    if (!loadingHaptics) {
        loadingHaptics = import('@capacitor/haptics')
            .then((mod) => {
                const plugin = (mod as unknown as { Haptics?: HapticsPlugin }).Haptics;
                cachedHaptics = plugin ?? null;
                return cachedHaptics;
            })
            .catch(() => {
                cachedHaptics = null;
                return null;
            });
    }
    return loadingHaptics;
}

function webVibrate(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
            navigator.vibrate(pattern);
        } catch {
            // Non-fatal — ignore on platforms that block vibration
        }
    }
}

function fireImpact(style: 'LIGHT' | 'MEDIUM' | 'HEAVY', webDuration: number): void {
    if (getNativePlatform() === 'web') {
        webVibrate(webDuration);
        return;
    }
    void getCapacitorHaptics().then((haptics) => {
        if (haptics) {
            void haptics.impact({ style }).catch(() => webVibrate(webDuration));
        } else {
            webVibrate(webDuration);
        }
    });
}

function fireNotification(type: 'SUCCESS' | 'WARNING' | 'ERROR', webPattern: number | number[]): void {
    if (getNativePlatform() === 'web') {
        webVibrate(webPattern);
        return;
    }
    void getCapacitorHaptics().then((haptics) => {
        if (haptics) {
            void haptics.notification({ type }).catch(() => webVibrate(webPattern));
        } else {
            webVibrate(webPattern);
        }
    });
}

/** Minimal click confirmation — tap on interactive elements */
export function hapticTap(): void {
    fireImpact('LIGHT', 5);
}

/** Lighter than tap — for low-emphasis UI changes */
export function hapticLight(): void {
    fireImpact('LIGHT', 3);
}

/** Success or completion feedback — e.g. entry saved, voice captured */
export function hapticSuccess(): void {
    fireNotification('SUCCESS', 30);
}

/** Error or rejection feedback — e.g. validation failed, offline */
export function hapticError(): void {
    fireNotification('ERROR', [20, 40, 20]);
}

/** Warning rhythm — e.g. word count gate nudge */
export function hapticWarning(): void {
    fireNotification('WARNING', [10, 50, 10]);
}
