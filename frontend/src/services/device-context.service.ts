/**
 * Device Context Snapshot
 *
 * Lightweight, synchronous + async capture of device signals
 * that enrich entries, telemetry, and analytics.
 *
 * All captures are privacy-safe — no PII, no fingerprinting.
 * Data stays on-device until explicitly attached to an API call.
 */

import { getNativePlatform, isNativePlatform, type NativePlatform } from '@/utils/platform';

/* ─── Types ─────────────────────────────────────────── */

export type DayPart = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
export type DeviceType = 'phone' | 'tablet' | 'desktop';
export type ConnectivityType = 'wifi' | 'cellular' | 'offline' | 'unknown';

export interface DeviceSnapshot {
    platform: NativePlatform;
    deviceType: DeviceType;
    screenWidth: number;
    screenHeight: number;
    timezone: string;
    timezoneOffset: number;
    locale: string;
    dayPart: DayPart;
    localHour: number;
    connectivity: ConnectivityType;
    isLowPowerMode: boolean;
    memoryPressure: 'low' | 'moderate' | 'high' | 'unknown';
    batteryLevel: number | null;
    batteryCharging: boolean | null;
    darkMode: boolean;
    capturedAt: string;
}

export type DeviceSnapshotLite = Pick<
    DeviceSnapshot,
    'platform' | 'deviceType' | 'timezone' | 'dayPart' | 'localHour' | 'connectivity' | 'darkMode'
>;

/* ─── Time helpers ──────────────────────────────────── */

export function getDayPart(hour: number): DayPart {
    if (hour >= 5 && hour < 8) return 'early_morning';
    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    if (hour >= 21 && hour < 24) return 'night';
    return 'late_night'; // 0-4
}

export function getDayPartLabel(dayPart: DayPart): string {
    switch (dayPart) {
        case 'early_morning': return 'Early morning';
        case 'morning': return 'Morning';
        case 'afternoon': return 'Afternoon';
        case 'evening': return 'Evening';
        case 'night': return 'Night';
        case 'late_night': return 'Late night';
    }
}

export function getGreetingForDayPart(dayPart: DayPart, name?: string): string {
    const nameFragment = name ? `, ${name}` : '';
    switch (dayPart) {
        case 'early_morning': return `Early start${nameFragment}`;
        case 'morning': return `Good morning${nameFragment}`;
        case 'afternoon': return `Good afternoon${nameFragment}`;
        case 'evening': return `Good evening${nameFragment}`;
        case 'night': return `Still here${nameFragment}`;
        case 'late_night': return `Quiet hours${nameFragment}`;
    }
}

/* ─── Device type heuristic ─────────────────────────── */

function inferDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    if (isNativePlatform()) {
        return w >= 768 ? 'tablet' : 'phone';
    }
    if (w < 768) return 'phone';
    if (w < 1024) return 'tablet';
    return 'desktop';
}

/* ─── Connectivity ──────────────────────────────────── */

function getConnectivity(): ConnectivityType {
    if (typeof navigator === 'undefined') return 'unknown';
    if (!navigator.onLine) return 'offline';
    const conn = (navigator as any).connection;
    if (!conn) return 'unknown';
    const type: string = conn.type || conn.effectiveType || '';
    if (type === 'wifi' || type === 'ethernet') return 'wifi';
    if (['cellular', '4g', '3g', '2g', 'slow-2g'].includes(type)) return 'cellular';
    return 'unknown';
}

/* ─── Dark mode ─────────────────────────────────────── */

function isDarkMode(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
}

/* ─── Battery (async, best-effort) ──────────────────── */

interface BatteryInfo {
    level: number | null;
    charging: boolean | null;
}

async function getBatteryInfo(): Promise<BatteryInfo> {
    try {
        if (typeof navigator === 'undefined' || !(navigator as any).getBattery) {
            return { level: null, charging: null };
        }
        const battery = await (navigator as any).getBattery();
        return {
            level: typeof battery.level === 'number' ? Math.round(battery.level * 100) : null,
            charging: typeof battery.charging === 'boolean' ? battery.charging : null,
        };
    } catch {
        return { level: null, charging: null };
    }
}

/* ─── Memory pressure ───────────────────────────────── */

function getMemoryPressure(): DeviceSnapshot['memoryPressure'] {
    if (typeof navigator === 'undefined') return 'unknown';
    const mem = (navigator as any).deviceMemory;
    if (typeof mem !== 'number') return 'unknown';
    if (mem <= 2) return 'high';
    if (mem <= 4) return 'moderate';
    return 'low';
}

/* ─── Low power mode heuristic ──────────────────────── */

function isLowPower(): boolean {
    if (typeof navigator === 'undefined') return false;
    // Save-Data header hint
    const conn = (navigator as any).connection;
    return conn?.saveData === true;
}

/* ─── Public API ────────────────────────────────────── */

/**
 * Capture a full device snapshot (async due to battery query).
 * Suitable for entry creation, session start, and analytics.
 */
export async function captureDeviceSnapshot(): Promise<DeviceSnapshot> {
    const now = new Date();
    const hour = now.getHours();
    const battery = await getBatteryInfo();

    return {
        platform: getNativePlatform(),
        deviceType: inferDeviceType(),
        screenWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
        screenHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: now.getTimezoneOffset(),
        locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
        dayPart: getDayPart(hour),
        localHour: hour,
        connectivity: getConnectivity(),
        isLowPowerMode: isLowPower(),
        memoryPressure: getMemoryPressure(),
        batteryLevel: battery.level,
        batteryCharging: battery.charging,
        darkMode: isDarkMode(),
        capturedAt: now.toISOString(),
    };
}

/**
 * Capture a lightweight snapshot (sync, no battery).
 * Suitable for telemetry events and quick enrichments.
 */
export function captureDeviceSnapshotLite(): DeviceSnapshotLite {
    const hour = new Date().getHours();
    return {
        platform: getNativePlatform(),
        deviceType: inferDeviceType(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dayPart: getDayPart(hour),
        localHour: hour,
        connectivity: getConnectivity(),
        darkMode: isDarkMode(),
    };
}
