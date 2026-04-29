'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useApi from '@/hooks/use-api';
import useContextNavigation from '@/hooks/use-context-navigation';
import { sanitizeHtml } from '@/utils/sanitize-html';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { getMoodEmoji, normalizeMood } from '@/constants/moods';
import { AppPanel, TagPill } from '@/components/ui/surface';
import { ConfirmDialog, ErrorState, Spinner } from '@/components/ui';
import { storyFieldLabel, type StorySignal } from '@/utils/story-engine';
import { FiArrowLeft, FiArrowRight, FiBriefcase, FiMic, FiMoreHorizontal } from 'react-icons/fi';
import ActionBriefPanel from '@/components/action/ActionBriefPanel';
import BridgeCard from '@/components/action/BridgeCard';
import SafetyBanner from '@/components/safety/SafetyBanner';
import type { StudentActionResponse } from '@/components/action/types';
import useTelemetry from '@/hooks/use-telemetry';
import { clipCompactPillByLimit, COMPACT_PILL_LIMITS, isCardTag } from '@/utils/tags';
import { useToast } from '@/context/toast-context';
import ShareMemorySheet from '@/components/share/ShareMemorySheet';
import MemoryInsightStrip from '@/components/entry/MemoryInsightStrip';
import type { MemoryNotiveInsight, MemoryTopEmotion } from '@/components/entry/memory-insight-types';
import { passthroughImageLoader } from '@/lib/image-loader';


interface Entry {
    id: string;
    title: string | null;
    content: string;
    contentHtml: string | null;
    coverImage: string | null;
    audioUrl?: string | null;
    mood: string | null;
    tags: string[];
    chapterId: string | null;
    source?: 'NOTIVE' | 'INSTAGRAM' | 'FACEBOOK';
    createdAt: string;
    updatedAt: string;
    analysisLine?: string | null;
    takeawayLine?: string | null;
    notiveInsights?: MemoryNotiveInsight[] | null;
    topEmotions?: MemoryTopEmotion[];
    depthLabel?: string | null;
    growthRatio?: number | null;
    storySignal?: StorySignal;
}

interface RelatedEntry {
    id: string;
    title: string | null;
    contentPreview: string;
    mood: string | null;
    tags: string[];
    createdAt: string;
    relevance: number;
    semanticScore: number;
    rerankScore: number | null;
    matchReasons: string[];
    coverImage?: string | null;
}

function EntryDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const { backHref, backLabel, navigateBack, withCurrentReturnTo } = useContextNavigation('/timeline', 'timeline');
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const toast = useToast();
    const [entry, setEntry] = useState<Entry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [relatedEntries, setRelatedEntries] = useState<RelatedEntry[]>([]);
    const [isLoadingRelated, setIsLoadingRelated] = useState(false);
    const [entryAction, setEntryAction] = useState<StudentActionResponse | null>(null);
    const [entryError, setEntryError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) {
            router.push(backHref);
            return;
        }
        const controller = new AbortController();
        let mounted = true;

        const fetchEntry = async () => {
            try {
                if (mounted) {
                    setIsLoadingRelated(true);
                    setRelatedEntries([]);
                    setEntryError(null);
                }
                const [entryResponse, relatedResponse] = await Promise.all([
                    apiFetch(`/entries/${id}`, {
                        signal: controller.signal,
                    }),
                    apiFetch(`/entries/${id}/related?limit=4`, {
                        signal: controller.signal,
                    }).catch(() => null),
                ]);

                if (!mounted) return;

                if (entryResponse.ok) {
                    const data = await entryResponse.json();
                    setEntry(data.entry);
                    setEntryError(null);
                } else {
                    setEntryError('Memory not found. It may have been deleted.');
                    setEntry(null);
                    return;
                }

                if (relatedResponse?.ok) {
                    const relatedData = await relatedResponse.json().catch(() => null);
                    setRelatedEntries(Array.isArray(relatedData?.relatedEntries) ? relatedData.relatedEntries : []);
                } else {
                    setRelatedEntries([]);
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Failed to fetch entry:', error);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                    setIsLoadingRelated(false);
                }
            }
        };

        fetchEntry();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [backHref, id, router, apiFetch]);

    useEffect(() => {
        if (!entry?.id) return;
        const controller = new AbortController();

        const fetchEntryAction = async () => {
            try {
                const response = await apiFetch(`/ai/action/preview`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        entryId: entry.id,
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) return;
                const data = await response.json().catch(() => null);
                setEntryAction(data || null);
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Failed to fetch entry action:', error);
            }
        };

        void fetchEntryAction();

        return () => {
            controller.abort();
        };
    }, [entry?.id, apiFetch]);

    const handleDelete = async () => {
        if (!id) return;
        setActionError(null);
        setIsDeleting(true);

        try {
            const response = await apiFetch(`/entries/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Memory deleted');
                router.push(backHref);
                return;
            }
            toast.error('Couldn\u2019t delete this memory. Please try again.');
        } catch (error) {
            console.error('Failed to delete entry:', error);
            toast.error('Couldn\u2019t delete this memory. Please try again.');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spinner size="md" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (entryError) {
        return (
            <div className="min-h-screen p-4 md:p-8">
                <div className="max-w-3xl mx-auto">
                    <ErrorState
                        title="Memory Not Found"
                        message={entryError}
                        variant="full-page"
                        action={{
                            label: "Back",
                            onClick: navigateBack,
                        }}
                    />
                </div>
            </div>
        );
    }

    if (!entry) return null;

    const safeHtml = entry.contentHtml ? sanitizeHtml(entry.contentHtml) : null;
    const normalizedMood = normalizeMood(entry.mood);
    const wordCount = entry.content.trim() ? entry.content.trim().split(/\s+/).length : 0;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));
    const createdAt = new Date(entry.createdAt);
    const storySignal = entry.storySignal;
    const sourceLabel = entry.source === 'INSTAGRAM'
        ? 'Instagram import'
        : entry.source === 'FACEBOOK'
            ? 'Facebook import'
            : 'Notive memory';
    const storyPrimaryHref = storySignal
        ? storySignal.status === 'verified' || storySignal.status === 'ready_to_export'
            ? withCurrentReturnTo('/portfolio?view=export&pack=resume')
            : withCurrentReturnTo(`/portfolio?view=evidence&filter=${storySignal.status}`)
        : withCurrentReturnTo('/portfolio?view=evidence');
    const storyPrimaryLabel = storySignal
        ? storySignal.status === 'verified' || storySignal.status === 'ready_to_export'
            ? 'Open Stories'
            : storySignal.status === 'ready_to_verify'
                ? 'Check Story'
                : 'Fix This Story'
        : 'Open Story Check';
    const shouldOpenInterviewDeck = Boolean(storySignal && (storySignal.status === 'verified' || storySignal.status === 'ready_to_export'));
    const isImportedEntry = entry.source === 'INSTAGRAM' || entry.source === 'FACEBOOK';
    const storySecondaryHref = shouldOpenInterviewDeck
        ? withCurrentReturnTo(`/portfolio?view=interview&story=${entry.id}`)
        : isImportedEntry
            ? withCurrentReturnTo('/import')
            : withCurrentReturnTo('/portfolio?view=evidence&filter=needs_attention');
    const storySecondaryLabel = shouldOpenInterviewDeck
        ? 'Practice Story'
        : isImportedEntry
            ? 'Open Bring In'
            : 'Open Story Check';
    const storyMessage = storySignal
        ? storySignal.status === 'verified'
            ? 'This memory is already verified and can move directly into export or interview prep.'
            : storySignal.status === 'ready_to_export'
                ? 'This memory has the structure to export cleanly. Use portfolio to tailor it for resumes, statements, or interviews.'
            : storySignal.status === 'ready_to_verify'
                    ? 'This memory has the main story parts. Check it once and move it into stronger story use.'
                    : 'This memory needs a little more structure before it becomes a story you can use.'
        : 'Open Story Check to see how this memory can become a stronger story.';
    const hasMemorySignals = Boolean(
        entry.analysisLine?.trim()
        || entry.takeawayLine?.trim()
        || (entry.notiveInsights && entry.notiveInsights.length > 0)
        || (entry.topEmotions && entry.topEmotions.length > 0)
        || entry.depthLabel
        || typeof entry.growthRatio === 'number'
        || storySignal
    );
    const hasNotiveDetails = Boolean(
        hasMemorySignals
        || storySignal
        || entryAction?.brief
        || entryAction?.bridge
        || isLoadingRelated
        || relatedEntries.length > 0
    );
    const handleEntryBridgeCopy = (recipient: string) => {
        void trackEvent({
            eventType: 'student_bridge_copied',
            field: 'recipient',
            value: recipient,
            metadata: {
                surface: 'entry_detail',
                entryId: entry.id,
                riskLevel: entryAction?.risk.level || 'none',
            },
        });
    };

    return (
        <div className="min-h-screen p-3 md:p-6">
            <div className="max-w-2xl mx-auto">
                <header className="mb-4 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={navigateBack}
                        aria-label={backLabel}
                        className="workspace-button-outline rounded-xl p-2 transition-all"
                    >
                        <FiArrowLeft size={20} aria-hidden="true" />
                    </button>

                    <div className="flex items-center gap-2">
                        <Link
                            href={withCurrentReturnTo(`/entry/edit?id=${id}`)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(107,143,113,0.28)] bg-[rgb(107,143,113)] px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_10px_24px_rgba(107,143,113,0.22)] transition-all hover:-translate-y-[1px] hover:bg-[rgb(96,131,102)]"
                        >
                            Edit transcript
                        </Link>
                        <button
                            type="button"
                            onClick={navigateBack}
                            className="workspace-button-outline rounded-full px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em]"
                        >
                            Done
                        </button>
                        <details className="relative">
                            <summary
                                className="workspace-button-outline flex cursor-pointer list-none items-center justify-center rounded-full p-2 text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))] [&::-webkit-details-marker]:hidden"
                                aria-label="More memory actions"
                                title="More memory actions"
                            >
                                <FiMoreHorizontal size={18} aria-hidden="true" />
                            </summary>
                            <div className="absolute right-0 top-11 z-30 w-44 rounded-2xl border border-[rgba(var(--paper-border),0.86)] bg-[rgb(var(--surface-1))] p-2 shadow-2xl">
                                <button
                                    type="button"
                                    onClick={() => setShowShareSheet(true)}
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-primary/10 hover:text-[rgb(var(--text-primary))]"
                                >
                                    Share memory
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
                                >
                                    Delete memory
                                </button>
                            </div>
                        </details>
                    </div>
                </header>

                {actionError && (
                    <div className="workspace-soft-panel mb-4 rounded-xl px-4 py-3 text-sm text-[rgb(var(--text-primary))]">
                        {actionError}
                    </div>
                )}

                {showDeleteConfirm && (
                    <ConfirmDialog
                        open={showDeleteConfirm}
                        title="Delete this memory?"
                        description="This action cannot be undone."
                        actionLabel="Delete"
                        isDangerous={true}
                        isLoading={isDeleting}
                        onConfirm={handleDelete}
                        onCancel={() => setShowDeleteConfirm(false)}
                    />
                )}

                <div className="mb-3">
                    <h1 className="workspace-heading mb-1.5 text-lg font-semibold md:text-xl">{entry.title || 'Untitled memory'}</h1>
                    <p className="text-xs text-ink-muted uppercase tracking-[0.1em]">
                        {createdAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}{wordCount} words{' · '}{readingTime} min read
                    </p>
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className="workspace-pill rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
                        {sourceLabel}
                    </span>
                    {normalizedMood && (
                        <span className="rounded-full border border-primary/35 bg-primary/15 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-primary">
                            {getMoodEmoji(normalizedMood)} {normalizedMood}
                        </span>
                    )}
                    {entry.tags.filter(isCardTag).slice(0, 3).map((tag) => (
                        <span
                            key={tag}
                            title={`#${tag}`}
                            className="workspace-pill inline-flex max-w-[11rem] items-center truncate rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-secondary"
                        >
                            {clipCompactPillByLimit(`#${tag}`, COMPACT_PILL_LIMITS.entryDetailTag)}
                        </span>
                    ))}
                </div>

                {entryAction && entryAction.risk.level !== 'none' && (
                    <div className="mb-4">
                        <SafetyBanner risk={entryAction.risk} safetyCard={entryAction.safetyCard} surface="entry" entryId={entry.id} />
                    </div>
                )}

                <AppPanel className="mb-6 space-y-5">
                    {safeHtml ? (
                        <div
                            className="prose max-w-none prose-headings:text-[rgb(var(--text-primary))] prose-p:text-ink-secondary prose-strong:text-[rgb(var(--text-primary))] prose-li:text-ink-secondary prose-a:text-primary prose-blockquote:text-ink-secondary"
                            dangerouslySetInnerHTML={{ __html: safeHtml }}
                        />
                    ) : (
                        <p className="text-ink-secondary whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                    )}

                    {entry.audioUrl && (
                        <details className="group rounded-2xl border border-[rgba(var(--paper-border),0.82)] px-3 py-3">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                                <span className="flex min-w-0 items-center gap-2">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                                        <FiMic size={18} aria-hidden="true" />
                                    </span>
                                    <span>
                                        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-secondary">Original recording</span>
                                        <span className="block text-xs text-ink-muted">Open only if you want to compare the audio.</span>
                                    </span>
                                </span>
                                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                                    <span className="group-open:hidden">Open</span>
                                    <span className="hidden group-open:inline">Close</span>
                                </span>
                            </summary>
                            <div className="mt-3 border-t border-[rgba(var(--paper-border),0.72)] pt-3">
                                <audio controls src={entry.audioUrl} className="w-full h-8 opacity-80" />
                            </div>
                        </details>
                    )}

                    {entry.coverImage && (
                        <div className="relative h-64 overflow-hidden rounded-2xl md:h-80">
                            <Image
                                src={entry.coverImage}
                                loader={passthroughImageLoader}
                                unoptimized
                                alt={entry.title || 'Cover'}
                                fill
                                sizes="(max-width: 768px) 100vw, 896px"
                                className="object-cover"
                            />
                        </div>
                    )}

                </AppPanel>

                {hasNotiveDetails && (
                    <details className="group mb-8 rounded-2xl border border-[rgba(var(--paper-border),0.8)] px-4 py-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                            <span>
                                <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">What Notive noticed</span>
                                <span className="mt-1 block text-sm text-ink-secondary">Insights, story options, and related memories stay here until you want them.</span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                                <span className="group-open:hidden">Open</span>
                                <span className="hidden group-open:inline">Close</span>
                            </span>
                        </summary>

                        <div className="mt-4 space-y-4 border-t border-[rgba(var(--paper-border),0.72)] pt-4">
                            {hasMemorySignals && (
                                <MemoryInsightStrip
                                    label="Signals"
                                    description="A quick read of what may be useful later."
                                    analysisLine={entry.analysisLine}
                                    takeawayLine={entry.takeawayLine}
                                    notiveInsights={entry.notiveInsights}
                                    topEmotions={entry.topEmotions}
                                    depthLabel={entry.depthLabel}
                                    growthRatio={entry.growthRatio}
                                    storySignal={storySignal}
                                />
                            )}

                            {storySignal && (
                                <AppPanel className="space-y-3" tone="soft">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Turn this into a story</p>
                                            <p className="text-sm leading-6 text-ink-secondary">{storyMessage}</p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Link
                                                href={storyPrimaryHref}
                                                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/20"
                                            >
                                                <FiBriefcase size={12} aria-hidden="true" />
                                                {storyPrimaryLabel}
                                            </Link>
                                            <Link
                                                href={storySecondaryHref}
                                                className="workspace-button-outline inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors"
                                            >
                                                {storySecondaryLabel}
                                            </Link>
                                        </div>
                                    </div>

                                    {storySignal.missingFields.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {storySignal.missingFields.map((field) => (
                                                <TagPill key={field}>{storyFieldLabel[field]}</TagPill>
                                            ))}
                                        </div>
                                    )}
                                </AppPanel>
                            )}

                            {entryAction && (entryAction.brief || entryAction.bridge) && (
                                <div className="space-y-3">
                                    {entryAction.brief && (
                                        <details className="workspace-soft-panel rounded-2xl px-4 py-4">
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Use this memory</p>
                                                    <p className="mt-1 text-sm text-ink-secondary">Open practical ways to turn this memory into something useful.</p>
                                                </div>
                                                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Open</span>
                                            </summary>
                                            <div className="mt-4">
                                                <ActionBriefPanel
                                                    brief={entryAction.brief}
                                                    surface="entry"
                                                    entryId={entry.id}
                                                    openEntryHref={(entryId) => withCurrentReturnTo(`/entry/view?id=${entryId}`)}
                                                />
                                            </div>
                                        </details>
                                    )}

                                    {entryAction.bridge && (
                                        <details className="workspace-soft-panel rounded-2xl px-4 py-4">
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Reach out from this memory</p>
                                                    <p className="mt-1 text-sm text-ink-secondary">Open only when you want outreach or connection help.</p>
                                                </div>
                                                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Open</span>
                                            </summary>
                                            <div className="mt-4">
                                                <BridgeCard
                                                    bridge={entryAction.bridge}
                                                    surface="entry"
                                                    entryId={entry.id}
                                                    openEntryHref={(entryId) => withCurrentReturnTo(`/entry/view?id=${entryId}`)}
                                                    onCopyDraft={() => handleEntryBridgeCopy(entryAction.bridge?.recommendedRecipient || 'trusted contact')}
                                                    variant="notebook"
                                                />
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )}

                            {(isLoadingRelated || relatedEntries.length > 0) && (
                                <AppPanel className="space-y-3" tone="soft">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Related memories</p>
                                        {isLoadingRelated && (
                                            <span className="text-xs uppercase tracking-[0.1em] text-ink-muted">Loading...</span>
                                        )}
                                    </div>

                                    {relatedEntries.length > 0 ? (
                                        <div className="grid gap-2 md:grid-cols-2">
                                            {relatedEntries.map((relatedEntry) => (
                                                <Link
                                                    key={relatedEntry.id}
                                                    href={withCurrentReturnTo(`/entry/view?id=${relatedEntry.id}`)}
                                                    className="workspace-soft-panel group rounded-xl p-3 transition-colors hover:bg-primary/5"
                                                >
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <p className="text-xs font-medium text-[rgb(var(--text-primary))] line-clamp-1">{relatedEntry.title || 'Untitled'}</p>
                                                        <FiArrowRight size={13} className="shrink-0 text-ink-muted group-hover:text-primary transition-colors" aria-hidden="true" />
                                                    </div>
                                                    <p className="text-[0.7rem] leading-snug text-ink-muted line-clamp-2">{relatedEntry.contentPreview}</p>
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        <TagPill>{Math.round((relatedEntry.relevance || 0) * 100)}% match</TagPill>
                                                        {relatedEntry.mood && <TagPill tone="primary">{getMoodEmoji(relatedEntry.mood)}</TagPill>}
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : !isLoadingRelated ? null : null}
                                </AppPanel>
                            )}
                        </div>
                    </details>
                )}
            </div>

            {showShareSheet && entry && (
                <ShareMemorySheet
                    initialEntry={{
                        id: entry.id,
                        title: entry.title,
                        content: entry.content,
                        mood: entry.mood,
                        createdAt: entry.createdAt,
                    }}
                    allEntries={[{
                        id: entry.id,
                        title: entry.title,
                        content: entry.content,
                        mood: entry.mood,
                        createdAt: entry.createdAt,
                    }]}
                    onClose={() => setShowShareSheet(false)}
                />
            )}
        </div>
    );
}

export default function EntryDetailClient() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="md" /></div>}>
            <EntryDetailContent />
        </Suspense>
    );
}
