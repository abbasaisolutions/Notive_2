'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { getMoodColor, getMoodEmoji, normalizeMood } from '@/constants/moods';
import { FiBookOpen } from 'react-icons/fi';
import { EmptyState } from '@/components/ui';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { buildTimelineMonthGroups } from '@/utils/timeline-groups';
import { formatStoryConfidence, storyStatusClassName, storyStatusLabel, type StorySignal } from '@/utils/story-engine';
import NotiveNoticedPanel, { type NotiveInsight } from './NotiveNoticedPanel';

interface Entry {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    source?: 'NOTIVE' | 'INSTAGRAM' | 'FACEBOOK';
    category?: 'PERSONAL' | 'PROFESSIONAL';
    lifeArea?: string | null;
    createdAt: string;
    coverImage?: string | null;
    skills?: string[];
    lessons?: string[];
    reflection?: string | null;
    notiveInsights?: NotiveInsight[] | null;
    storySignal?: StorySignal;
}

interface TimelineViewProps {
    entries: Entry[];
    seasonAnchorsByMonthKey?: Record<string, {
        title: string;
        dominantMood: string | null;
        entryCount: number;
    }>;
}

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

export default function TimelineView({ entries, seasonAnchorsByMonthKey = {} }: TimelineViewProps) {
    const pathname = usePathname();
    const groupedEntries = useMemo(() => buildTimelineMonthGroups(entries), [entries]);
    const currentReturnTo = buildCurrentReturnTo(pathname, typeof window !== 'undefined' ? window.location.search : '');

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
        <div className="relative py-6 md:py-10">
            <div className="absolute left-5 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/55 via-white/15 to-transparent" />

            <div className="space-y-10 md:space-y-14">
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
                            className="sticky top-4 z-20 mb-5 pl-11 md:top-6 md:mb-6 md:flex md:justify-center md:pl-0"
                        >
                            <div className="inline-flex flex-wrap items-center gap-2 rounded-full workspace-soft-panel px-3 py-2 shadow-lg shadow-black/20 backdrop-blur-xl">
                                <span className="text-xs font-semibold uppercase tracking-[0.16em] workspace-heading">
                                    {group.label}
                                </span>
                                <span className="workspace-pill rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-secondary">
                                    {group.count}
                                </span>
                                {season && (
                                    <span className="rounded-full border border-primary/30 bg-primary/12 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                                        {season.title}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-8 md:space-y-12">
                            {group.entries.map((entry) => {
                                const isEven = entry.timelineIndex % 2 === 0;
                                const normalizedMood = normalizeMood(entry.mood);
                                const moodColor = getMoodColor(normalizedMood);
                                const moodLabel = normalizedMood
                                    ? normalizedMood.charAt(0).toUpperCase() + normalizedMood.slice(1)
                                    : null;
                                const source = entry.source || 'NOTIVE';
                                const sourceBadgeStyle = 'workspace-pill text-ink-secondary';
                                const wordCount = entry.content.trim().split(/\s+/).filter(Boolean).length;
                                const readMinutes = Math.max(1, Math.round(wordCount / 180));
                                const storySignal = entry.storySignal;

                                return (
                                    <motion.article
                                        key={entry.id}
                                        initial={{ opacity: 0, y: 16 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, margin: '-80px' }}
                                        transition={{ duration: 0.36, delay: Math.min(entry.timelineIndex * 0.03, 0.24) }}
                                        className={`relative flex flex-col md:flex-row gap-5 md:gap-8 ${isEven ? 'md:flex-row-reverse' : ''}`}
                                    >
                                        <div
                                            className="absolute left-5 md:left-1/2 w-3.5 h-3.5 rounded-full -translate-x-1/2 mt-7 md:mt-8 border-2 border-surface-2 z-10"
                                            style={{ backgroundColor: moodColor }}
                                        />

                                        <div className="flex-1 md:w-1/2 pl-11 md:pl-0">
                                            <Link href={appendReturnTo(`/entry/view?id=${entry.id}`, currentReturnTo)} className="block group">
                                                <div className="workspace-panel rounded-[2rem] p-5 md:p-6">
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <span className="text-xs text-ink-muted uppercase tracking-[0.16em] font-semibold">
                                                            {formatDate(entry.createdAt)}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            {entry.lifeArea && (
                                                                <span className="workspace-pill text-xs font-semibold px-2 py-1 rounded-full uppercase tracking-wider text-ink-secondary">
                                                                    {entry.lifeArea}
                                                                </span>
                                                            )}
                                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full border uppercase tracking-wider ${sourceBadgeStyle}`}>
                                                                {source}
                                                            </span>
                                                            {storySignal && (
                                                                <span className={`text-xs font-semibold px-2 py-1 rounded-full border uppercase tracking-wider ${storyStatusClassName[storySignal.status]}`}>
                                                                    {storyStatusLabel[storySignal.status]}
                                                                </span>
                                                            )}
                                                            {entry.category === 'PROFESSIONAL' && (
                                                                <span className="text-xs font-semibold text-secondary bg-secondary/15 border border-secondary/35 px-2 py-1 rounded-full uppercase tracking-wider">
                                                                    Professional
                                                                </span>
                                                            )}
                                                            {moodLabel && (
                                                                <span
                                                                    className="text-xs font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wider"
                                                                    style={{
                                                                        color: moodColor,
                                                                        borderColor: `${moodColor}66`,
                                                                        backgroundColor: `${moodColor}1f`,
                                                                    }}
                                                                >
                                                                    {getMoodEmoji(normalizedMood)} {moodLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <h3 className="text-xl font-serif workspace-heading mb-2 group-hover:text-primary transition-colors line-clamp-2">
                                                        {entry.title || 'Untitled Memory'}
                                                    </h3>

                                                    <p className="text-sm text-ink-secondary leading-relaxed line-clamp-2 mb-4">
                                                        {entry.content}
                                                    </p>

                                                    <div className="mb-3 flex flex-wrap gap-2">
                                                        <span className="workspace-pill text-xs font-semibold text-ink-secondary px-2 py-1 rounded-full uppercase tracking-wider">
                                                            <span className="inline-flex items-center gap-1">
                                                                <FiBookOpen size={10} aria-hidden="true" /> {readMinutes}m
                                                            </span>
                                                        </span>
                                                        <span className="workspace-pill text-xs font-semibold text-ink-secondary px-2 py-1 rounded-full uppercase tracking-wider">
                                                            #{wordCount} words
                                                        </span>
                                                        {storySignal && (
                                                            <span className="workspace-pill text-xs font-semibold text-ink-secondary px-2 py-1 rounded-full uppercase tracking-wider">
                                                                {storySignal.completenessScore}% ready / {formatStoryConfidence(storySignal.confidence)} confidence
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {(entry.skills || []).slice(0, 2).map(skill => (
                                                            <span key={skill} className="text-xs font-semibold text-success bg-success/15 border border-success/35 px-2 py-1 rounded-full">
                                                                +{skill}
                                                            </span>
                                                        ))}
                                                        {(entry.lessons || []).slice(0, 2).map(lesson => (
                                                            <span key={lesson} className="text-xs font-semibold text-accent bg-accent/15 border border-accent/35 px-2 py-1 rounded-full">
                                                                {lesson}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {(entry.notiveInsights?.length || entry.reflection || (entry.skills?.length ?? 0) > 0 || (entry.lessons?.length ?? 0) > 0 || entry.storySignal) && (
                                                        <NotiveNoticedPanel
                                                            skills={entry.skills}
                                                            lessons={entry.lessons}
                                                            reflection={entry.reflection}
                                                            notiveInsights={entry.notiveInsights}
                                                            storySignal={entry.storySignal}
                                                            mood={entry.mood}
                                                            lifeArea={entry.lifeArea}
                                                        />
                                                    )}
                                                </div>
                                            </Link>
                                        </div>

                                        <div className="hidden md:block flex-1 md:w-1/2" />
                                    </motion.article>
                                );
                            })}
                        </div>
                    </section>
                    );
                })}
            </div>
        </div>
    );
}

