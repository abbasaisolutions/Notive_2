'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useApi from '@/hooks/use-api';
import useContextNavigation from '@/hooks/use-context-navigation';
import { sanitizeHtml } from '@/utils/sanitize-html';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { getMoodEmoji, normalizeMood } from '@/constants/moods';
import { AppPanel, TagPill } from '@/components/ui/surface';
import { ConfirmDialog, ErrorState, Spinner } from '@/components/ui';
import { formatStoryConfidence, storyFieldLabel, storyStatusClassName, storyStatusLabel, type StorySignal } from '@/utils/story-engine';
import { FiArrowLeft, FiArrowRight, FiBriefcase, FiMic } from 'react-icons/fi';
import ActionBriefPanel from '@/components/action/ActionBriefPanel';
import BridgeCard from '@/components/action/BridgeCard';
import SafetyBanner from '@/components/safety/SafetyBanner';
import type { StudentActionResponse } from '@/components/action/types';
import useTelemetry from '@/hooks/use-telemetry';
import { useToast } from '@/context/toast-context';
import ShareMemorySheet, { type ShareableEntry } from '@/components/share/ShareMemorySheet';


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

const CARD_TAG_NOISE = new Set(['im','ive','id','ill','its','dont','didnt','wont','cant','not',
    'has','had','have','does','did','just','like','also','some','both','this','that','what',
    'when','where','good','okay','yeah','very','even','make','made','more','much','many','every',
    'really','back','still','thing','things','day','today','time','week','feel','feels','felt',
    'want','know','think','said','with','from','into','over','down','life','work','node','nodeo',
    'features','nothing','something','everything']);
const isCardTag = (t: string) => t.length >= 4 && !CARD_TAG_NOISE.has(t.toLowerCase().replace(/[^a-z0-9-]/g,''));

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
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [relatedEntries, setRelatedEntries] = useState<RelatedEntry[]>([]);
    const [isLoadingRelated, setIsLoadingRelated] = useState(false);
    const [entryAction, setEntryAction] = useState<StudentActionResponse | null>(null);
    const [entryError, setEntryError] = useState<string | null>(null);
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }
        };
    }, []);

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
                    apiFetch(`${API_URL}/entries/${id}`, {
                        signal: controller.signal,
                    }),
                    apiFetch(`${API_URL}/entries/${id}/related?limit=4`, {
                        signal: controller.signal,
                    }).catch(() => null),
                ]);

                if (!mounted) return;

                if (entryResponse.ok) {
                    const data = await entryResponse.json();
                    setEntry(data.entry);
                    setEntryError(null);
                } else {
                    setEntryError('Note not found. It may have been deleted.');
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
                const response = await apiFetch(`${API_URL}/ai/action/preview`, {
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

    const handleShare = async () => {
        if (!id) return;
        setActionError(null);
        setIsSharing(true);
        try {
            const response = await apiFetch(`${API_URL}/share/entry/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                const fullUrl = `${window.location.origin}${data.url}`;
                setShareUrl(fullUrl);
                await navigator.clipboard.writeText(fullUrl);
                setIsCopied(true);
                if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
                copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 3000);
            }
        } catch (error) {
            console.error('Failed to create share link:', error);
            setActionError('Failed to create share link. Please try again.');
        } finally {
            setIsSharing(false);
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        setActionError(null);
        setIsDeleting(true);

        try {
            const response = await apiFetch(`${API_URL}/entries/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                toast.success('Note deleted');
                router.push(backHref);
                return;
            }
            toast.error('Failed to delete entry. Please try again.');
        } catch (error) {
            console.error('Failed to delete entry:', error);
            toast.error('Failed to delete entry. Please try again.');
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
                        title="Note Not Found"
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
    const updatedAt = new Date(entry.updatedAt);
    const storySignal = entry.storySignal;
    const sourceLabel = entry.source === 'INSTAGRAM'
        ? 'Instagram import'
        : entry.source === 'FACEBOOK'
            ? 'Facebook import'
            : 'Notive entry';
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
            ? 'This entry is already verified and can move directly into export or interview prep.'
            : storySignal.status === 'ready_to_export'
                ? 'This entry has the structure to export cleanly. Use portfolio to tailor it for resumes, statements, or interviews.'
            : storySignal.status === 'ready_to_verify'
                    ? 'This note has the main story parts. Check it once and move it into stronger story use.'
                    : 'This note needs a little more structure before it becomes a story you can use.'
        : 'Open Story Check to see how this note can become a stronger story.';
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
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-2xl mx-auto relative z-10">
                <header className="mb-5 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={navigateBack}
                        aria-label={backLabel}
                        className="workspace-button-outline rounded-xl p-2 transition-all"
                    >
                        <FiArrowLeft size={20} aria-hidden="true" />
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowShareSheet(true)}
                            className="workspace-pill rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-all hover:opacity-85"
                        >
                            Share
                        </button>
                        <Link
                            href={withCurrentReturnTo(`/entry/edit?id=${id}`)}
                            className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary hover:bg-primary/25 transition-all"
                        >
                            Edit
                        </Link>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="workspace-pill rounded-full px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-muted transition-all hover:text-[rgb(var(--text-primary))]"
                        >
                            Delete
                        </button>
                    </div>
                </header>

                {actionError && (
                    <div className="workspace-soft-panel mb-4 rounded-xl px-4 py-3 text-sm text-[rgb(var(--text-primary))]">
                        {actionError}
                    </div>
                )}

                {shareUrl && (
                    <div className="workspace-soft-panel mb-5 rounded-xl p-3 text-sm">
                        <p className="mb-1 text-xs uppercase tracking-[0.12em] text-ink-secondary">Share Link</p>
                        <p className="workspace-heading truncate">{shareUrl}</p>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(shareUrl);
                                setIsCopied(true);
                                if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
                                copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
                            }}
                            className="workspace-button-outline mt-2 rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em]"
                        >
                            {isCopied ? 'Copied' : 'Copy Link'}
                        </button>
                    </div>
                )}

                {showDeleteConfirm && (
                    <ConfirmDialog
                        open={showDeleteConfirm}
                        title="Delete this note?"
                        description="This action cannot be undone."
                        actionLabel="Delete"
                        isDangerous={true}
                        isLoading={isDeleting}
                        onConfirm={handleDelete}
                        onCancel={() => setShowDeleteConfirm(false)}
                    />
                )}

                <div className="mb-3">
                    <h1 className="workspace-heading mb-1.5 text-lg font-semibold md:text-xl">{entry.title || 'Untitled Note'}</h1>
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
                            className="workspace-pill rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-ink-secondary"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>

                {storySignal && (
                    <AppPanel className="mb-5 space-y-3" tone="soft">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${storyStatusClassName[storySignal.status]}`}>
                                        {storyStatusLabel[storySignal.status]}
                                    </span>
                                    <TagPill>{storySignal.completenessScore}% ready</TagPill>
                                    <TagPill>{formatStoryConfidence(storySignal.confidence)} confidence</TagPill>
                                </div>
                                <p className="text-xs text-ink-secondary">{storyMessage}</p>
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

                {entryAction && (
                    <div className="mb-8 space-y-4">
                        <SafetyBanner risk={entryAction.risk} safetyCard={entryAction.safetyCard} surface="entry" entryId={entry.id} />
                        {entryAction.brief && (
                            <div>
                                <p className="mb-3 text-xs uppercase tracking-[0.14em] text-ink-muted">Use This Note</p>
                                <ActionBriefPanel
                                    brief={entryAction.brief}
                                    surface="entry"
                                    entryId={entry.id}
                                    openEntryHref={(entryId) => withCurrentReturnTo(`/entry/view?id=${entryId}`)}
                                />
                            </div>
                        )}
                        {entryAction.bridge && (
                            <div>
                                <p className="mb-3 text-xs uppercase tracking-[0.14em] text-ink-muted">Bridge This Note</p>
                                <BridgeCard
                                    bridge={entryAction.bridge}
                                    surface="entry"
                                    entryId={entry.id}
                                    openEntryHref={(entryId) => withCurrentReturnTo(`/entry/view?id=${entryId}`)}
                                    onCopyDraft={() => handleEntryBridgeCopy(entryAction.bridge?.recommendedRecipient || 'trusted contact')}
                                    variant="notebook"
                                />
                            </div>
                        )}
                    </div>
                )}

                {entry.coverImage && (
                    <div className="mb-8 rounded-2xl overflow-hidden">
                        <img src={entry.coverImage} alt={entry.title || 'Cover'} className="w-full h-64 md:h-80 object-cover" />
                    </div>
                )}

                {entry.audioUrl && (
                    <div className="workspace-soft-panel mb-8 flex items-center gap-4 rounded-2xl p-4">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <FiMic size={24} className="text-primary" aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-ink-secondary font-bold uppercase tracking-[0.12em] mb-1">Voice Note</p>
                            <audio controls src={entry.audioUrl} className="w-full h-8 opacity-80" />
                        </div>
                    </div>
                )}

                <div className="workspace-panel rounded-2xl p-4 md:p-6">
                    {safeHtml ? (
                        <div
                            className="prose max-w-none prose-headings:text-[rgb(var(--text-primary))] prose-p:text-ink-secondary prose-strong:text-[rgb(var(--text-primary))] prose-li:text-ink-secondary prose-a:text-primary prose-blockquote:text-ink-secondary"
                            dangerouslySetInnerHTML={{ __html: safeHtml }}
                        />
                    ) : (
                        <p className="text-ink-secondary whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                    )}
                </div>

                {(isLoadingRelated || relatedEntries.length > 0) && (
                    <AppPanel className="mt-6 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Related Notes</p>
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


