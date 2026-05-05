'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useContextNavigation from '@/hooks/use-context-navigation';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { AppPanel, EmptyState, TagPill } from '@/components/ui/surface';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { pickRotatingCopy } from '@/utils/rotating-copy';
import { writeWorkspaceResume } from '@/utils/workspace-resume';
import { FiArrowLeft } from 'react-icons/fi';
import { Spinner } from '@/components/ui';
import { getChapterIconComponent } from '@/constants/chapter-icons';
import { formatStoryConfidence, storyStatusClassName, storyStatusLabel, type StorySignal } from '@/utils/story-engine';
import { clipCompactPillByLimit, COMPACT_PILL_LIMITS } from '@/utils/tags';
import { passthroughImageLoader } from '@/lib/image-loader';

const EMPTY_CHAPTER_DETAIL_VARIANTS = [
    {
        title: 'No entries in this collection yet',
        description: 'Route one note here and this collection starts feeling like a real chapter.',
    },
    {
        title: 'This collection is still waiting on its first note',
        description: 'Add an entry from quick capture or the full editor and it will begin to gather shape here.',
    },
    {
        title: 'An empty chapter can still be promising',
        description: 'The first memory you place here will give this collection its tone.',
    },
] as const;

interface Chapter {
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string;
}

interface Entry {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    coverImage: string | null;
    createdAt: string;
    storySignal?: StorySignal;
}

function ChapterDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const { isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const { backHref, backLabel, navigateBack } = useContextNavigation('/chapters', 'collections');
    const [chapter, setChapter] = useState<Chapter | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!id) {
            router.push('/chapters');
            return;
        }

        const controller = new AbortController();
        let mounted = true;

        const fetchChapterEntries = async () => {
            try {
                const response = await apiFetch(`/chapters/${id}/entries`, {
                    signal: controller.signal,
                });

                if (mounted && response.ok) {
                    const data = await response.json();
                    setChapter(data.chapter);
                    setEntries(data.entries);
                } else {
                    router.push('/chapters');
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Failed to fetch chapter:', error);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchChapterEntries();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [id, router, apiFetch]);

    const currentReturnTo = useMemo(
        () => buildCurrentReturnTo('/chapters/view', id ? `?id=${id}` : ''),
        [id]
    );
    const captureHref = appendReturnTo('/entry/new?mode=quick', currentReturnTo);

    useEffect(() => {
        if (authLoading || !isAuthenticated || !chapter) return;

        writeWorkspaceResume({
            key: 'chapter',
            title: chapter.name,
            summary: `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} in this collection`,
            href: currentReturnTo,
            updatedAt: new Date().toISOString(),
            stage: 'organize',
            actionLabel: `Resume ${NOTIVE_VOICE.surfaces.storyCollections.toLowerCase()}`,
        });
    }, [authLoading, chapter, currentReturnTo, entries.length, isAuthenticated]);

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

    if (!chapter) {
        return null;
    }

    const ChapterIcon = getChapterIconComponent(chapter.icon);
    const emptyCopy = pickRotatingCopy('empty-chapter-detail', EMPTY_CHAPTER_DETAIL_VARIANTS);

    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <AppPanel className="space-y-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="flex items-start gap-3">
                            <button
                                type="button"
                                onClick={navigateBack}
                                aria-label={backLabel}
                                title={backLabel}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                            >
                                <FiArrowLeft size={20} aria-hidden="true" />
                            </button>
                            <div className="flex items-start gap-4">
                                <div
                                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                                    style={{ backgroundColor: `${chapter.color}20` }}
                                >
                                    <ChapterIcon className="text-white" size={24} aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Memory group</p>
                                    <h1 className="workspace-heading mt-1 text-2xl font-semibold leading-tight md:text-3xl">{chapter.name}</h1>
                                    {chapter.description && (
                                        <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-secondary">{chapter.description}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Link
                                href={captureHref}
                                className="rounded-xl border border-primary/30 bg-primary/12 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                            >
                                Add memory
                            </Link>
                        </div>
                    </div>

                    <details className="group rounded-2xl border border-[rgba(141,123,105,0.16)] bg-[rgba(255,255,255,0.03)]">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                            <span>
                                <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Group details</span>
                                <span className="mt-1 block text-sm text-ink-secondary">Counts, date range, visual anchor, and story signals stay here.</span>
                            </span>
                            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                                <span className="group-open:hidden">Open</span>
                                <span className="hidden group-open:inline">Close</span>
                            </span>
                        </summary>
                        <div className="space-y-3 border-t border-[rgba(141,123,105,0.14)] px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                                <TagPill tone="primary">{entries.length} memories</TagPill>
                                <TagPill>
                                    Latest {entries[0] ? new Date(entries[0].createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'none'}
                                </TagPill>
                                <TagPill>
                                    <span className="inline-flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: chapter.color }} />
                                        Group color
                                    </span>
                                </TagPill>
                            </div>
                            {entries.some((entry) => entry.storySignal) && (
                                <div className="flex flex-wrap gap-2">
                                    {entries.filter((entry) => entry.storySignal).slice(0, 4).map((entry) => entry.storySignal ? (
                                        <span key={entry.id} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.1em] ${storyStatusClassName[entry.storySignal.status]}`}>
                                            {storyStatusLabel[entry.storySignal.status]} · {entry.storySignal.completenessScore}%
                                        </span>
                                    ) : null)}
                                </div>
                            )}
                        </div>
                    </details>
                </AppPanel>

                {entries.length === 0 ? (
                    <EmptyState
                        title={emptyCopy.title}
                        description={emptyCopy.description}
                        actionLabel="Create Entry"
                        actionHref={captureHref}
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {entries.map((entry) => {
                            const entryHref = appendReturnTo(`/entry/view?id=${entry.id}`, currentReturnTo);

                            return (
                                <Link
                                    key={entry.id}
                                    href={entryHref}
                                    className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] transition-colors hover:border-white/15 hover:bg-white/[0.05]"
                                >
                                    {entry.coverImage && (
                                        <div className="relative h-48 w-full overflow-hidden">
                                            <Image
                                                src={entry.coverImage}
                                                loader={passthroughImageLoader}
                                                unoptimized
                                                alt={entry.title || 'Entry'}
                                                fill
                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                className="object-cover transition-transform duration-500 hover:scale-105"
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-4 p-5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <TagPill>{new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</TagPill>
                                            {entry.mood && <TagPill tone="primary">{entry.mood}</TagPill>}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">{entry.title || 'Untitled Entry'}</h3>
                                            <p className="mt-2 line-clamp-3 text-sm leading-7 text-ink-secondary">{entry.content}</p>
                                        </div>
                                        {(entry.tags.length > 0 || entry.storySignal) && (
                                            <details className="group rounded-2xl border border-white/10 bg-white/[0.02]">
                                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted [&::-webkit-details-marker]:hidden">
                                                    Details
                                                    <span className="text-primary group-open:hidden">Open</span>
                                                    <span className="hidden text-primary group-open:inline">Close</span>
                                                </summary>
                                                <div className="flex flex-wrap gap-2 border-t border-white/10 px-3 py-3">
                                                    {entry.storySignal && (
                                                        <>
                                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.1em] ${storyStatusClassName[entry.storySignal.status]}`}>
                                                                {storyStatusLabel[entry.storySignal.status]}
                                                            </span>
                                                            <TagPill>
                                                                {entry.storySignal.completenessScore}% ready / {formatStoryConfidence(entry.storySignal.confidence)} confidence
                                                            </TagPill>
                                                        </>
                                                    )}
                                                    {entry.tags.slice(0, 4).map((tag) => (
                                                        <TagPill key={tag} title={`#${tag}`} className="max-w-[12rem] truncate">
                                                            {clipCompactPillByLimit(`#${tag}`, COMPACT_PILL_LIMITS.chapterTag)}
                                                        </TagPill>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ChapterDetailPage() {
    return (
        <Suspense
            fallback={(
                <div className="min-h-screen flex items-center justify-center">
                    <Spinner size="md" />
                </div>
            )}
        >
            <ChapterDetailContent />
        </Suspense>
    );
}
