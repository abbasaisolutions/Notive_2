/**
 * App Session Tracker
 *
 * Tracks time spent in Notive using Capacitor App plugin lifecycle events.
 * Sends accumulated session data to backend on pause/background.
 * Works on both web (visibilitychange) and mobile (Capacitor appStateChange).
 */

import { App } from '@capacitor/app';

const SESSION_KEY = 'notive_session_start';
let sessionStartTime: number | null = null;
let apiUrl: string = '';
let getToken: (() => string | null) | null = null;
let isInitialized = false;

/**
 * Initialize the session tracker.
 * Call once at app startup with the API URL and auth token getter.
 */
export function initSessionTracker(
    baseApiUrl: string,
    tokenGetter: () => string | null
): void {
    apiUrl = baseApiUrl;
    getToken = tokenGetter;

    if (isInitialized) {
        return;
    }

    isInitialized = true;
    startSession();

    // Capacitor lifecycle
    void App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
            startSession();
        } else {
            endSession();
        }
    }).catch(() => {
        // Web fallback: use visibility API
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    startSession();
                } else {
                    endSession();
                }
            });
        }
    });

    // Also end session on page unload (web)
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', endSession);
    }
}

function startSession(): void {
    if (sessionStartTime) return; // already tracking
    sessionStartTime = Date.now();
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SESSION_KEY, String(sessionStartTime));
    }
}

function endSession(): void {
    if (!sessionStartTime) {
        // Try recovering from localStorage
        const stored = typeof localStorage !== 'undefined'
            ? localStorage.getItem(SESSION_KEY)
            : null;
        if (stored) {
            sessionStartTime = Number(stored);
        }
    }

    if (!sessionStartTime) return;

    const durationMs = Date.now() - sessionStartTime;
    const durationMinutes = Math.round(durationMs / 60000);
    sessionStartTime = null;

    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SESSION_KEY);
    }

    // Only report sessions > 30 seconds
    if (durationMinutes < 1 && durationMs < 30000) return;

    reportSession(Math.max(1, durationMinutes));
}

function reportSession(minutes: number): void {
    if (!apiUrl || !getToken) return;
    const token = getToken();
    if (!token) return;

    // Fire and forget — use sendBeacon for reliability on page unload
    const body = JSON.stringify({ sessionMinutes: minutes });

    if (typeof navigator?.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(`${apiUrl}/device/app-session`, blob);
    } else {
        void fetch(`${apiUrl}/device/app-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body,
            keepalive: true,
        }).catch(() => {});
    }
}
