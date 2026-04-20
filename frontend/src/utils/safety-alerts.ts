export const SAFETY_ALERTS_PREF_KEY = 'notive_safety_alerts_enabled';

export const isSafetyAlertsEnabled = (): boolean => {
    if (typeof window === 'undefined') return true;
    try {
        const raw = window.localStorage.getItem(SAFETY_ALERTS_PREF_KEY);
        if (raw === null) return true;
        return raw !== 'false';
    } catch {
        return true;
    }
};
