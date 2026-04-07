import { useCallback, useMemo, useState } from 'react';

export interface EntryDraft {
    content: string;
    contentHtml: string;
    title: string;
    mood: string | null;
    tags: string[];
    audioUrl: string | null;
    category?: 'PERSONAL' | 'PROFESSIONAL';
    lifeArea?: string;
    chapterId?: string | null;
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

export function useEntryDraft(userId: string | null | undefined) {
    const [draft, setDraft] = useState<EntryDraft | null>(null);

    const draftKey = useMemo(() => (userId ? getDraftKey(userId) : null), [userId]);

    const loadDraft = useCallback((): EntryDraft | null => {
        if (!draftKey) return null;
        const raw = localStorage.getItem(draftKey);
        if (!raw) return null;

        try {
            const parsed = JSON.parse(raw) as EntryDraft;
            setDraft(parsed);
            return parsed;
        } catch (error) {
            console.error('Failed to parse entry draft', error);
            return null;
        }
    }, [draftKey]);

    const saveDraft = useCallback((next: EntryDraft) => {
        if (!draftKey) return;
        localStorage.setItem(draftKey, JSON.stringify(next));
        setDraft(next);
    }, [draftKey]);

    const clearDraft = useCallback(() => {
        if (!draftKey) return;
        localStorage.removeItem(draftKey);
        setDraft(null);
    }, [draftKey]);

    return {
        draft,
        loadDraft,
        saveDraft,
        clearDraft,
    };
}

/** Check localStorage for any draft with pendingSync === true for a given user. */
export function hasPendingSyncDraft(userId: string | null | undefined): boolean {
    if (!userId) return false;
    try {
        const raw = localStorage.getItem(getDraftKey(userId));
        if (!raw) return false;
        const parsed = JSON.parse(raw) as EntryDraft;
        return !!parsed.pendingSync;
    } catch {
        return false;
    }
}

export default useEntryDraft;
