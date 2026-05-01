'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { EmptyState } from '@/components/ui';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { buildTimelineMonthGroups } from '@/utils/timeline-groups';
import TimelineEntryCard, {
    type TimelineEntry,
    type EntryShareStat,
    type TopEmotion,
} from './TimelineEntryCard';
import type { StorySignal } from '@/utils/story-engine';
import type { NotiveInsight } from './NotiveNoticedPanel';

export type { TopEmotion };

interface Entry {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    source?: 'NOTIVE' | 'INSTAGRAM' | 'FACEBOOK';
    category?: 'PERSONAL' | 'PROFESSIONAL';
    lifeArea?: string | null;
    tags?: string[];
    createdAt: string;
    coverImage?: string | null;
    skills?: string[];
    lessons?: string[];
    reflection?: string | null;
    notiveInsights?: NotiveInsight[] | null;
    storySignal?: StorySignal;
    analysisLine?: string;
    takeawayLine?: string;
    topEmotions?: TopEmotion[];
    depthLevel?: 0 | 1 | 2 | 3 | 4;
    depthLabel?: string;
    growthRatio?: number | null;
}

interface TimelineViewProps {
    entries: Entry[];
    tagCounts?: Record<string, number>;
    seasonAnchorsByMonthKey?: Record<string, {
        title: string;
        dominantMood: string | null;
        entryCount: number;
    }>;
    onShareEntry?: (entryId: string) => void;
    focusedEntryId?: string | null;
    entryShareStats?: Record<string, EntryShareStat>;
}

export default function TimelineView({
    entries,
    seasonAnchorsByMonthKey = {},
    onShareEntry,
    focusedEntryId,
    entryShareStats = {},
}: TimelineViewProps) {
    const pathname = usePathname();
    const [search, setSearch] = useState('');
    const groupedEntries = useMemo(() => buildTimelineMonthGroups(entries), [entries]);
    const memoryThreads = useMemo(() => {
        const counts = new Map<string, { label: string; count: number; latest: string }>();
        entries.forEach((entry) => {
            const candidates = [
                ...(entry.tags || []).slice(0, 2),
                entry.lifeArea || '',
                entry.category || '',
            ].map((item) => String(item).trim()).filter(Boolean);

            candidates.forEach((label) => {
                const key = label.toLowerCase();
                const current = counts.get(key);
                const latest = current && new Date(current.latest) > new Date(entry.createdAt)
                    ? current.latest
                    : entry.createdAt;
                counts.set(key, { label, count: (current?.count || 0) + 1, latest });
            });
        });

        return Array.from(counts.values())
            .filter((thread) => thread.count >= 2)
            .sort((a, b) => b.count - a.count || new Date(b.latest).getTime() - new Date(a.latest).getTime())
            .slice(0, 8);
    }, [entries]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setSearch(window.location.search);
    }, [pathname]);

    const currentReturnTo = useMemo(
        () => buildCurrentReturnTo(pathname, search),
        [pathname, search],
    );

    if (entries.length === 0) {
        return (
            <EmptyState
                doodle="sprout"
                doodleAccent="sage"
                title="No memories yet"
                subtitle="Create your first entry to start your timeline."
                action={{ label: 'Quick Capture', href: appendReturnTo('/entry/new?mode=quick', currentReturnTo) }}
            />
        );
    }

    return (
        <div className="relative py-3 md:py-10">
            <div className="absolute left-5 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/55 via-white/15 to-transparent" />

            {memoryThreads.length > 0 && (
                <section className="relative z-10 mb-4 ml-10 md:mx-auto md:max-w-3xl">
                    <div className="rounded-2xl border border-[rgba(var(--paper-border),0.42)] bg-[rgba(255,255,255,0.42)] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">Memory threads</p>
                            <span className="text-[0.68rem] font-semibold text-muted">Grouped by recurring tags</span>
                        </div>
                        <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
                            {memoryThreads.map((thread) => (
                                <a
                                    key={thread.label}
                                    href={`/timeline?tag=${encodeURIComponent(thread.label)}`}
                                    className="snap-start whitespace-nowrap rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/14"
                                >
                                    {thread.label} · {thread.count}
                                </a>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <div className="space-y-6 md:space-y-14">
                {groupedEntries.map((group) => {
                    const season = seasonAnchorsByMonthKey[group.key];

                    return (
                        <section
                            key={group.key}
                            id={group.anchorId}
                            data-timeline-month-section={group.label}
                            data-timeline-month-key={group.key}
                            className="relative scroll-mt-28 md:scroll-mt-32"
                        >
                            <div
                                data-timeline-month-anchor={group.label}
                                data-timeline-month-key={group.key}
                                className="sticky top-4 z-20 mb-3 pl-11 md:top-6 md:mb-6 md:flex md:justify-center md:pl-0"
                            >
                                <div className="inline-flex flex-wrap items-center gap-2 rounded-full workspace-soft-panel px-3 py-2 shadow-lg shadow-black/20 backdrop-blur-xl">
                                    <span className="text-xs font-semibold uppercase tracking-[0.16em] workspace-heading">
                                        {group.label}
                                    </span>
                                    <span className="workspace-pill rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-secondary">
                                        {group.count}
                                    </span>
                                    {season && (
                                        <span className="hidden md:inline-flex rounded-full border border-primary/30 bg-primary/12 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                                            {season.title}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 md:space-y-12">
                                {group.entries.map((entry) => (
                                    <TimelineEntryCard
                                        key={entry.id}
                                        entry={entry as TimelineEntry}
                                        onShareEntry={onShareEntry}
                                        isFocused={focusedEntryId === entry.id}
                                        shareStat={entryShareStats[entry.id]}
                                        currentReturnTo={currentReturnTo}
                                        disableEntranceAnimation={entry.timelineIndex > 20}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
