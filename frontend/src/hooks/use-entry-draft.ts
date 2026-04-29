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
const DRAFT_HISTORY_LIMIT = 6;
const DRAFT_HISTORY_MERGE_WINDOW_MS = 2 * 60 * 1000;
const DRAFT_HISTORY_MIN_WORD_DELTA = 25;

const getDraftKey = (userId: string) => `notive_entry_draft_v${DRAFT_VERSION}_${userId}`;
const getDraftHistoryKey = (userId: string) => `notive_entry_draft_history_v${DRAFT_VERSION}_${userId}`;

export type DraftHistorySnapshot = EntryDraft & {
    snapshotId: string;
    savedAt: number;
    wordCount: number;
    preview: string;
};

const countDraftWords = (draft: Pick<EntryDraft, 'content'>): number => {
    const text = draft.content?.trim() ?? '';
    return text ? text.split(/\s+/).length : 0;
};

const buildDraftPreview = (draft: Pick<EntryDraft, 'content' | 'title' | 'audioUrl'>): string => {
    const source = draft.content?.trim() || draft.title?.trim() || (draft.audioUrl ? 'Voice note draft' : '');
    return source.replace(/\s+/g, ' ').slice(0, 140);
};

const isRecoverableDraft = (draft: EntryDraft): boolean =>
    Boolean(draft.content?.trim() || draft.title?.trim() || draft.audioUrl);

const hasSameDraftBody = (left: EntryDraft, right: EntryDraft): boolean =>
    (left.content || '') === (right.content || '')
    && (left.contentHtml || '') === (right.contentHtml || '')
    && (left.title || '') === (right.title || '')
    && (left.audioUrl || '') === (right.audioUrl || '');

const createDraftHistorySnapshot = (draft: EntryDraft): DraftHistorySnapshot => {
    const savedAt = typeof draft.updatedAt === 'number' ? draft.updatedAt : Date.now();
    return {
        ...draft,
        snapshotId: `${savedAt}-${Math.random().toString(36).slice(2, 8)}`,
        savedAt,
        wordCount: countDraftWords(draft),
        preview: buildDraftPreview(draft),
    };
};

export const getDraftHistory = (userId: string | null | undefined): DraftHistorySnapshot[] => {
    if (typeof window === 'undefined' || !userId) return [];

    try {
        const raw = localStorage.getItem(getDraftHistoryKey(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item): item is DraftHistorySnapshot =>
                item
                && typeof item === 'object'
                && typeof item.snapshotId === 'string'
                && typeof item.savedAt === 'number'
                && typeof item.content === 'string'
            )
            .slice(0, DRAFT_HISTORY_LIMIT);
    } catch {
        return [];
    }
};

const writeDraftHistory = (userId: string, history: DraftHistorySnapshot[]) => {
    localStorage.setItem(getDraftHistoryKey(userId), JSON.stringify(history.slice(0, DRAFT_HISTORY_LIMIT)));
};

const rememberDraftSnapshot = (userId: string, draft: EntryDraft) => {
    if (!isRecoverableDraft(draft)) return;

    const history = getDraftHistory(userId);
    const latest = history[0];

    if (latest && hasSameDraftBody(latest, draft)) {
        return;
    }

    const nextSnapshot = createDraftHistorySnapshot(draft);
    const shouldMergeWithLatest = latest
        && latest.entryId === draft.entryId
        && Math.abs(nextSnapshot.savedAt - latest.savedAt) < DRAFT_HISTORY_MERGE_WINDOW_MS
        && Math.abs(nextSnapshot.wordCount - latest.wordCount) < DRAFT_HISTORY_MIN_WORD_DELTA;

    const nextHistory = shouldMergeWithLatest
        ? [nextSnapshot, ...history.slice(1)]
        : [nextSnapshot, ...history];

    writeDraftHistory(userId, nextHistory);
};

export const deleteDraftHistorySnapshot = (
    userId: string | null | undefined,
    snapshotId: string
): DraftHistorySnapshot[] => {
    if (typeof window === 'undefined' || !userId) return [];

    const nextHistory = getDraftHistory(userId).filter((snapshot) => snapshot.snapshotId !== snapshotId);
    writeDraftHistory(userId, nextHistory);
    return nextHistory;
};

export type SavedDraftSummary = {
    hasAudio: boolean;
    pendingSync: boolean;
    title: string | null;
    updatedAt: number | null;
    wordCount: number;
    historyCount: number;
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
        if (!draftKey || !userId) return;
        localStorage.setItem(draftKey, JSON.stringify(next));
        rememberDraftSnapshot(userId, next);
        setDraft(next);
        emitSyncStatusChanged();
    }, [draftKey, userId]);

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
        historyCount: getDraftHistory(userId).length,
    };
}

export default useEntryDraft;
