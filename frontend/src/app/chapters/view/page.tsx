'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useContextNavigation from '@/hooks/use-context-navigation';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { AppPanel, EmptyState, SectionHeader, StatTile, TagPill } from '@/components/ui/surface';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { writeWorkspaceResume } from '@/utils/workspace-resume';
import { FiArrowLeft } from 'react-icons/fi';
import { Spinner } from '@/components/ui';
import { getChapterIconComponent } from '@/constants/chapter-icons';
import { formatStoryConfidence, storyStatusClassName, storyStatusLabel, type StorySignal } from '@/utils/story-engine';
import { clipCompactPillByLimit, COMPACT_PILL_LIMITS } from '@/utils/tags';

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
                const response = await apiFetch(`${API_URL}/chapters/${id}/entries`, {
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

    return (
        <div className="min-h-screen px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl space-y-6">
                <AppPanel className="space-y-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
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
                                    className="flex h-14 w-14 items-center justify-center rounded-2xl"
                                    style={{ backgroundColor: `${chapter.color}20` }}
                                >
                                    <ChapterIcon className="text-white" size={28} aria-hidden="true" />
                                </div>
                                <SectionHeader
                                    kicker="Collection View"
                                    title={chapter.name}
                                    description={chapter.description || 'A focused stream of entries grouped into one collection.'}
                                    as="h1"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <TagPill tone="primary">{entries.length} entries</TagPill>
                            <Link
                                href={captureHref}
                                className="rounded-xl border border-primary/30 bg-primary/12 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                            >
                                Add Entry
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                        <StatTile label="Entries" value={entries.length} hint="Items currently in this collection" />
                        <StatTile
                            label="Recent Entry"
                            value={entries[0] ? new Date(entries[0].createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'None'}
                            hint="Most recent entry date"
                            tone="primary"
                        />
                        <StatTile label="Theme Color" value={<span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: chapter.color }} /> Active</span>} hint="Visual anchor for this collection" />
                    </div>
                </AppPanel>

                {entries.length === 0 ? (
                    <EmptyState
                        title="No entries in this collection yet"
                        description="Add entries from quick capture or the entry editor and route them into this collection as you go."
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
                                        <div className="h-48 w-full overflow-hidden">
                                            <img
                                                src={entry.coverImage}
                                                alt={entry.title || 'Entry'}
                                                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
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
                                        <div className="flex flex-wrap gap-2">
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
