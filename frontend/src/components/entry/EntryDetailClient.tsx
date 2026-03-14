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
import { formatStoryConfidence, storyFieldLabel, storyStatusClassName, storyStatusLabel, type StorySignal } from '@/utils/story-engine';
import { FiArrowLeft, FiArrowRight, FiBriefcase, FiMic, FiUploadCloud } from 'react-icons/fi';


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

function EntryDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const { backHref, backLabel, navigateBack, withCurrentReturnTo } = useContextNavigation('/timeline', 'timeline');
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const [entry, setEntry] = useState<Entry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
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
                const response = await apiFetch(`${API_URL}/entries/${id}`, {
                    signal: controller.signal,
                });

                if (mounted && response.ok) {
                    const data = await response.json();
                    setEntry(data.entry);
                } else {
                    router.push(backHref);
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Failed to fetch entry:', error);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchEntry();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [backHref, id, router, apiFetch]);

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
                router.push(backHref);
                return;
            }
            setActionError('Failed to delete entry. Please try again.');
        } catch (error) {
            console.error('Failed to delete entry:', error);
            setActionError('Failed to delete entry. Please try again.');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
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
            ? 'Open Export Studio'
            : storySignal.status === 'ready_to_verify'
                ? 'Review In Evidence Queue'
                : 'Strengthen This Story'
        : 'Open Evidence Queue';
    const shouldOpenInterviewDeck = Boolean(storySignal && (storySignal.status === 'verified' || storySignal.status === 'ready_to_export'));
    const isImportedEntry = entry.source === 'INSTAGRAM' || entry.source === 'FACEBOOK';
    const storySecondaryHref = shouldOpenInterviewDeck
        ? withCurrentReturnTo(`/portfolio?view=interview&story=${entry.id}`)
        : isImportedEntry
            ? withCurrentReturnTo('/import')
            : withCurrentReturnTo('/portfolio?view=evidence&filter=needs_attention');
    const storySecondaryLabel = shouldOpenInterviewDeck
        ? 'Practice Interview Story'
        : isImportedEntry
            ? 'Open Import Inbox'
            : 'Open Evidence Queue';
    const storyMessage = storySignal
        ? storySignal.status === 'verified'
            ? 'This entry is already verified and can move directly into export or interview prep.'
            : storySignal.status === 'ready_to_export'
                ? 'This entry has the structure to export cleanly. Use portfolio to tailor it for resumes, statements, or interviews.'
                : storySignal.status === 'ready_to_verify'
                    ? 'This entry has the core evidence fields. Verify it once and move it into stronger portfolio outputs.'
                    : 'This entry needs a little more structure before it becomes reusable evidence.'
        : 'Open the evidence queue to see how this entry can become a stronger story.';

    return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-3xl mx-auto relative z-10">
                <header className="mb-6 rounded-2xl border border-white/10 bg-surface-1/70 p-4 md:p-5 backdrop-blur-xl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={navigateBack}
                                aria-label={backLabel}
                                title={backLabel}
                                className="p-2 rounded-xl text-ink-secondary hover:text-white hover:bg-white/10 transition-all"
                            >
                                <FiArrowLeft size={22} aria-hidden="true" />
                            </button>
                            <div>
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Entry View</p>
                                <p className="text-sm font-semibold text-white">Reading Mode</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={handleShare}
                                disabled={isSharing}
                                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-white/10 transition-all"
                            >
                                {isCopied ? 'Copied' : isSharing ? 'Sharing' : 'Share'}
                            </button>
                            <Link
                                href={withCurrentReturnTo(`/entry/edit?id=${id}`)}
                                className="rounded-xl border border-primary/30 bg-primary/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary hover:bg-primary/25 transition-all"
                            >
                                Edit
                            </Link>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary hover:bg-white/[0.07] transition-all"
                                aria-label="Delete entry"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </header>

                {actionError && (
                    <div className="mb-4 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white">
                        {actionError}
                    </div>
                )}

                {shareUrl && (
                    <div className="mb-5 rounded-xl border border-white/15 bg-white/[0.03] p-3 text-sm">
                        <p className="mb-1 text-xs uppercase tracking-[0.12em] text-ink-secondary">Share Link</p>
                        <p className="truncate text-white">{shareUrl}</p>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(shareUrl);
                                setIsCopied(true);
                                if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
                                copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
                            }}
                            className="mt-2 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-white/[0.07]"
                        >
                            {isCopied ? 'Copied' : 'Copy Link'}
                        </button>
                    </div>
                )}

                {showDeleteConfirm && (
                    <div className="mb-6 rounded-2xl border border-white/15 bg-white/[0.03] p-4">
                        <p className="mb-3 text-sm text-white">Delete this entry permanently? This action cannot be undone.</p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="rounded-xl bg-primary/85 px-3 py-2 text-sm text-white hover:bg-primary disabled:opacity-70"
                            >
                                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-70"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Created</p>
                        <p className="text-sm font-semibold text-white">
                            {createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Volume</p>
                        <p className="text-sm font-semibold text-white">{wordCount} words</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Read Time</p>
                        <p className="text-sm font-semibold text-white">{readingTime} min</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Updated</p>
                        <p className="text-sm font-semibold text-white">
                            {updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </p>
                    </div>
                </div>

                <div className="mb-6">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{entry.title || 'Untitled Entry'}</h1>
                    <p className="text-ink-secondary text-sm">
                        {createdAt.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                <div className="mb-6 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary">
                        {sourceLabel}
                    </span>
                    {normalizedMood && (
                        <span className="rounded-full border border-primary/35 bg-primary/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                            {getMoodEmoji(normalizedMood)} {normalizedMood}
                        </span>
                    )}
                    {entry.tags.map((tag) => (
                        <span
                            key={tag}
                            className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>

                {storySignal && (
                    <AppPanel className="mb-8 space-y-4" tone="soft">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${storyStatusClassName[storySignal.status]}`}>
                                        {storyStatusLabel[storySignal.status]}
                                    </span>
                                    <TagPill>{storySignal.completenessScore}% ready</TagPill>
                                    <TagPill>{formatStoryConfidence(storySignal.confidence)} confidence</TagPill>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Story Engine</p>
                                    <h2 className="mt-1 text-xl font-semibold text-white">Turn this entry into reusable evidence</h2>
                                    <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-secondary">{storyMessage}</p>
                                </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 lg:w-[20rem] lg:grid-cols-1">
                                <Link
                                    href={storyPrimaryHref}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                >
                                    <FiBriefcase size={14} aria-hidden="true" />
                                    {storyPrimaryLabel}
                                </Link>
                                <Link
                                    href={storySecondaryHref}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/[0.08] hover:text-white"
                                >
                                    {shouldOpenInterviewDeck || !isImportedEntry ? (
                                        <FiArrowRight size={14} aria-hidden="true" />
                                    ) : (
                                        <FiUploadCloud size={14} aria-hidden="true" />
                                    )}
                                    {storySecondaryLabel}
                                </Link>
                            </div>
                        </div>

                        {storySignal.missingFields.length > 0 && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Missing fields</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {storySignal.missingFields.map((field) => (
                                        <TagPill key={field}>{storyFieldLabel[field]}</TagPill>
                                    ))}
                                </div>
                            </div>
                        )}
                    </AppPanel>
                )}

                {entry.coverImage && (
                    <div className="mb-8 rounded-2xl overflow-hidden">
                        <img src={entry.coverImage} alt={entry.title || 'Cover'} className="w-full h-64 md:h-80 object-cover" />
                    </div>
                )}

                {entry.audioUrl && (
                    <div className="mb-8 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <FiMic size={24} className="text-primary" aria-hidden="true" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-ink-secondary font-bold uppercase tracking-[0.12em] mb-1">Voice Note</p>
                            <audio controls src={entry.audioUrl} className="w-full h-8 opacity-80" />
                        </div>
                    </div>
                )}

                <div className="glass-card p-6 md:p-8 rounded-2xl">
                    {safeHtml ? (
                        <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: safeHtml }} />
                    ) : (
                        <p className="text-ink-secondary whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function EntryDetailClient() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
            <EntryDetailContent />
        </Suspense>
    );
}


