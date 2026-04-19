import { useCallback, useMemo, useState } from 'react';
import { emitSyncStatusChanged, markSyncSuccess } from '@/services/sync-status.service';

export interface EntryDraft {
    entryId?: string | null;
    content: string;
    contentHtml: string;
    title: string;
    mood: string | null;
    tags: string[];
    audioUrl: string | null;
    entryMode?: 'quick' | 'full';
    category?: 'PERSONAL' | 'PROFESSIONAL';
    lifeArea?: string;
    chapterId?: string | null;
    location?: {
        lat: number;
        lng: number;
        name: string;
    } | null;
    deviceContext?: Record<string, unknown> | null;
    analysis?: {
        deterministic?: unknown;
        ai?: Record<string, unknown>;
        voice?: Record<string, unknown>;
    };
    updatedAt: number;
    pendingSync: boolean;
}

const DRAFT_VERSION = 1;

const getDraftKey = (userId: string) => `notive_entry_draft_v${DRAFT_VERSION}_${userId}`;

export type SavedDraftSummary = {
    hasAudio: boolean;
    pendingSync: boolean;
    title: string | null;
    updatedAt: number | null;
    wordCount: number;
};

export const getSavedDraft = (userId: string | null | undefined): EntryDraft | null => {
    if (typeof window === 'undefined' || !userId) return null;

    try {
        const raw = localStorage.getItem(getDraftKey(userId));
        if (!raw) return null;
        return JSON.parse(raw) as EntryDraft;
    } catch {
        return null;
    }
};

export const clearSavedDraft = (userId: string | null | undefined) => {
    if (typeof window === 'undefined' || !userId) return;

    const previousDraft = getSavedDraft(userId);
    localStorage.removeItem(getDraftKey(userId));

    if (previousDraft?.pendingSync) {
        markSyncSuccess();
        return;
    }

    emitSyncStatusChanged();
};

export function useEntryDraft(userId: string | null | undefined) {
    const [draft, setDraft] = useState<EntryDraft | null>(null);

    const draftKey = useMemo(() => (userId ? getDraftKey(userId) : null), [userId]);

    const loadDraft = useCallback((): EntryDraft | null => {
        const parsed = getSavedDraft(userId);
        setDraft(parsed);
        return parsed;
    }, [userId]);

    const saveDraft = useCallback((next: EntryDraft) => {
        if (!draftKey) return;
        localStorage.setItem(draftKey, JSON.stringify(next));
        setDraft(next);
        emitSyncStatusChanged();
    }, [draftKey]);

    const clearDraft = useCallback(() => {
        if (!draftKey) return;
        clearSavedDraft(userId);
        setDraft(null);
    }, [draftKey, userId]);

    return {
        draft,
        loadDraft,
        saveDraft,
        clearDraft,
    };
}

/** Check localStorage for any draft with pendingSync === true for a given user. */
export function hasPendingSyncDraft(userId: string | null | undefined): boolean {
    return !!getSavedDraft(userId)?.pendingSync;
}

/** Return the word count of a saved draft (0 if none). */
export function getSavedDraftWordCount(userId: string | null | undefined): number {
    const text = getSavedDraft(userId)?.content?.trim() ?? '';
    return text ? text.split(/\s+/).length : 0;
}

export function getSavedDraftSummary(userId: string | null | undefined): SavedDraftSummary | null {
    const draft = getSavedDraft(userId);
    if (!draft) {
        return null;
    }

    const content = draft.content?.trim() ?? '';

    return {
        hasAudio: Boolean(draft.audioUrl),
        pendingSync: Boolean(draft.pendingSync),
        title: draft.title?.trim() || null,
        updatedAt: typeof draft.updatedAt === 'number' ? draft.updatedAt : null,
        wordCount: content ? content.split(/\s+/).length : 0,
    };
}

export default useEntryDraft;
