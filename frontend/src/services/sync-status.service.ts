'use client';

export type SyncIssue = {
    at: number;
    message: string;
};

export const SYNC_STATUS_EVENT = 'notive-sync-status-updated';

const LAST_SYNC_SUCCESS_AT_KEY = 'notive_sync_last_success_at';
const LAST_SYNC_ISSUE_KEY = 'notive_sync_last_issue';

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export const emitSyncStatusChanged = () => {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new Event(SYNC_STATUS_EVENT));
};

export const readLastSuccessfulSyncAt = (): number | null => {
    if (!canUseStorage()) {
        return null;
    }

    const raw = localStorage.getItem(LAST_SYNC_SUCCESS_AT_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const readLastSyncIssue = (): SyncIssue | null => {
    if (!canUseStorage()) {
        return null;
    }

    const raw = localStorage.getItem(LAST_SYNC_ISSUE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as SyncIssue;
        if (!parsed?.message || typeof parsed.at !== 'number') {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

export const clearSyncIssue = () => {
    if (!canUseStorage()) {
        return;
    }

    localStorage.removeItem(LAST_SYNC_ISSUE_KEY);
    emitSyncStatusChanged();
};

export const markSyncSuccess = (at = Date.now()) => {
    if (!canUseStorage()) {
        return;
    }

    localStorage.setItem(LAST_SYNC_SUCCESS_AT_KEY, String(at));
    localStorage.removeItem(LAST_SYNC_ISSUE_KEY);
    emitSyncStatusChanged();
};

export const markSyncIssue = (message: string, at = Date.now()) => {
    if (!canUseStorage()) {
        return;
    }

    localStorage.setItem(
        LAST_SYNC_ISSUE_KEY,
        JSON.stringify({
            at,
            message,
        } satisfies SyncIssue),
    );
    emitSyncStatusChanged();
};
