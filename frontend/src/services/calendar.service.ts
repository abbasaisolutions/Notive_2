'use client';

import { Preferences } from '@capacitor/preferences';
import { isNativePlatform } from '@/utils/platform';

// ── Types ────────────────────────────────────────────────────────────────────

export type CalendarEventCategory =
    | 'class'
    | 'meeting'
    | 'study'
    | 'social'
    | 'personal';

export interface NativeCalendarEvent {
    id: string;
    title: string;
    startDate: number; // ms timestamp
    endDate: number;   // ms timestamp
    isAllDay: boolean;
    location: string | null;
    category: CalendarEventCategory;
}

// 'pending'   → never asked
// 'declined'  → user tapped "Not now" in our UI (not OS-level)
// 'os_denied' → user denied the OS permission dialog
// 'granted'   → permission given and events should be read
type CalendarOptInStatus = 'pending' | 'declined' | 'os_denied' | 'granted';

interface CalendarOptInState {
    status: CalendarOptInStatus;
    declinedAt?: number;  // timestamp of most recent decline
    declineCount?: number;
}

const PREF_KEY = 'notive_calendar_opt_in';

// Days before re-surfacing the opt-in card after user declines in-app
const SOFT_DECLINE_DAYS = 14; // 1st and 2nd decline
const HARD_DECLINE_DAYS = 30; // 3rd+ decline
const OS_DENIED_DAYS = 7;     // OS-level deny — suggest Settings

// ── Helpers ──────────────────────────────────────────────────────────────────

function categorise(title: string): CalendarEventCategory {
    const t = title.toLowerCase();
    if (/class|lecture|lab|tutorial|seminar|course/.test(t)) return 'class';
    if (/meeting|standup|sync|call|1:1|interview|review/.test(t)) return 'meeting';
    if (/study|homework|assignment|exam|test|quiz|project/.test(t)) return 'study';
    if (/party|birthday|dinner|lunch|coffee|drinks|hang|friend/.test(t)) return 'social';
    return 'personal';
}

// ── Preferences helpers ───────────────────────────────────────────────────────

async function loadState(): Promise<CalendarOptInState> {
    try {
        const { value } = await Preferences.get({ key: PREF_KEY });
        if (value) return JSON.parse(value) as CalendarOptInState;
    } catch {
        // ignore
    }
    return { status: 'pending', declineCount: 0 };
}

async function saveState(state: CalendarOptInState): Promise<void> {
    await Preferences.set({ key: PREF_KEY, value: JSON.stringify(state) });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getCalendarOptInState(): Promise<CalendarOptInState> {
    return loadState();
}

/**
 * Returns true when we should show the opt-in card again, based on how long
 * ago the user declined and how many times they've done so.
 */
export async function shouldShowCalendarOptIn(): Promise<boolean> {
    const state = await loadState();
    if (state.status === 'granted') return false;
    if (state.status === 'pending') return true;

    const declinedAt = state.declinedAt ?? 0;
    const count = state.declineCount ?? 1;
    const daysSince = (Date.now() - declinedAt) / (1000 * 60 * 60 * 24);

    if (state.status === 'os_denied') return daysSince >= OS_DENIED_DAYS;

    // 'declined': first + second decline → 14 days; third+ → 30 days
    const threshold = count <= 2 ? SOFT_DECLINE_DAYS : HARD_DECLINE_DAYS;
    return daysSince >= threshold;
}

/** Called when the user taps "Not now" in our UI (not an OS dialog). */
export async function markCalendarDeclined(): Promise<void> {
    const prev = await loadState();
    await saveState({
        status: 'declined',
        declinedAt: Date.now(),
        declineCount: (prev.declineCount ?? 0) + 1,
    });
}

/** Called when the OS permission dialog returns 'denied'. */
export async function markCalendarOsDenied(): Promise<void> {
    const prev = await loadState();
    await saveState({
        status: 'os_denied',
        declinedAt: Date.now(),
        declineCount: (prev.declineCount ?? 0) + 1,
    });
}

/** Called after a successful permission grant. */
async function markCalendarGranted(): Promise<void> {
    await saveState({ status: 'granted' });
}

/**
 * Request native calendar read permission.
 * Returns 'granted', 'denied', or 'unavailable' (web/desktop).
 */
export async function requestCalendarPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
    if (!isNativePlatform()) return 'unavailable';
    try {
        const { CapacitorCalendar, CalendarPermissionScope } = await import(
            '@ebarooni/capacitor-calendar'
        );
        const { result } = await CapacitorCalendar.requestPermission({
            scope: CalendarPermissionScope.READ_CALENDAR,
        });
        if (result === 'granted') {
            await markCalendarGranted();
            return 'granted';
        }
        await markCalendarOsDenied();
        return 'denied';
    } catch {
        return 'unavailable';
    }
}

/**
 * Check current OS-level calendar permission without prompting.
 */
export async function checkCalendarPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
    if (!isNativePlatform()) return 'unavailable';
    try {
        const { CapacitorCalendar, CalendarPermissionScope } = await import(
            '@ebarooni/capacitor-calendar'
        );
        const { result } = await CapacitorCalendar.checkPermission({
            scope: CalendarPermissionScope.READ_CALENDAR,
        });
        // 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
        if (result === 'granted') return 'granted';
        if (result === 'denied') return 'denied';
        return 'prompt';
    } catch {
        return 'unavailable';
    }
}

/**
 * Fetch upcoming calendar events within the given hour window (default 48h).
 * Returns empty array if permission not granted or not on native.
 */
export async function getUpcomingEvents(hours = 48): Promise<NativeCalendarEvent[]> {
    if (!isNativePlatform()) return [];
    try {
        const { CapacitorCalendar } = await import('@ebarooni/capacitor-calendar');
        const from = Date.now();
        const to = from + hours * 60 * 60 * 1000;
        const { result } = await CapacitorCalendar.listEventsInRange({ from, to });
        return (result ?? [])
            .filter((e) => e.title?.trim())
            .map((e) => ({
                id: e.id,
                title: e.title.trim(),
                startDate: e.startDate,
                endDate: e.endDate,
                isAllDay: e.isAllDay,
                location: e.location ?? null,
                category: categorise(e.title),
            }))
            .sort((a, b) => a.startDate - b.startDate)
            .slice(0, 5); // max 5 events shown
    } catch {
        return [];
    }
}
