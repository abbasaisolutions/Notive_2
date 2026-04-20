'use client';

import { MIN_CHARACTERS_FOR_ENTRY_SAVE } from '@/constants/entry-requirements';
import { clearSavedDraft, getSavedDraft, type EntryDraft } from '@/hooks/use-entry-draft';
import { markSyncIssue } from '@/services/sync-status.service';

type ApiFetchLike = (
    path: string,
    options?: RequestInit & { retryOnUnauthorized?: boolean },
) => Promise<Response>;

export type PendingDraftSyncResult = 'noop' | 'validation_blocked' | 'synced' | 'failed';

const toEntryPayload = (draft: EntryDraft) => ({
    title: draft.title?.trim() || null,
    content: draft.content,
    contentHtml: draft.contentHtml,
    entryMode: draft.entryMode ?? 'full',
    mood: draft.mood,
    category: draft.category ?? 'PERSONAL',
    lifeArea: draft.lifeArea,
    chapterId: draft.chapterId,
    tags: draft.tags,
    audioUrl: draft.audioUrl,
    analysis: draft.analysis,
    ...(draft.location ? {
        locationLat: draft.location.lat,
        locationLng: draft.location.lng,
        locationName: draft.location.name,
    } : {}),
    ...(draft.deviceContext ? { deviceContext: draft.deviceContext } : {}),
});

export async function syncPendingEntryDraft(
    userId: string | null | undefined,
    apiFetch: ApiFetchLike,
): Promise<PendingDraftSyncResult> {
    const draft = getSavedDraft(userId);

    if (!userId || !draft?.pendingSync) {
        return 'noop';
    }

    const normalizedContent = draft.content.trim();
    if (!normalizedContent) {
        clearSavedDraft(userId);
        return 'noop';
    }

    if ((draft.entryMode ?? 'full') !== 'quick' && normalizedContent.length < MIN_CHARACTERS_FOR_ENTRY_SAVE) {
        markSyncIssue(
            `Draft needs at least ${MIN_CHARACTERS_FOR_ENTRY_SAVE} characters before it can sync automatically.`,
        );
        return 'validation_blocked';
    }

    try {
        const response = await apiFetch(
            draft.entryId ? `/entries/${draft.entryId}` : '/entries',
            {
                method: draft.entryId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toEntryPayload(draft)),
            },
        );
        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(data?.message || 'Could not sync your draft just yet.');
        }

        clearSavedDraft(userId);
        return 'synced';
    } catch (error) {
        markSyncIssue(error instanceof Error ? error.message : 'Could not sync your draft just yet.');
        return 'failed';
    }
}
