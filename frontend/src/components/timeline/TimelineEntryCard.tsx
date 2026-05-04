'use client';

import React, { memo, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiShare2 } from 'react-icons/fi';
import { getMoodColor, getMoodEmoji, getMoodScore, normalizeMood } from '@/constants/moods';
import { TooltipHint } from '@/components/ui';
import { appendReturnTo } from '@/utils/navigation';
import { hapticTap } from '@/services/haptics.service';
import { audioFeedback } from '@/services/audio-feedback.service';
import { storyStatusLabel, type StorySignal } from '@/utils/story-engine';
import { clipCompactPillByLimit, COMPACT_PILL_LIMITS, isCardTag } from '@/utils/tags';
import type { NotiveInsight } from './NotiveNoticedPanel';

export interface TopEmotion {
    emotion: string;
    intensity: number;
}

export interface TimelineEntry {
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
    timelineIndex: number;
}

export interface EntryShareStat {
    shareCount: number;
    reactions: Array<{ name: string; reaction: string }>;
}

interface TimelineEntryCardProps {
    entry: TimelineEntry;
    onShareEntry?: (entryId: string) => void;
    isFocused: boolean;
    shareStat?: EntryShareStat;
    currentReturnTo: string;
    disableEntranceAnimation?: boolean;
}

// Reserving intrinsic height lets the browser skip layout/paint for offscreen
// cards via content-visibility: auto — CSS-native virtualization without the
// sticky-header/alternating-layout gotchas of a JS virtualizer.
const OFFSCREEN_CARD_STYLE: React.CSSProperties = {
    contentVisibility: 'auto',
    containIntrinsicSize: '0 240px',
};

const REACTION_EMOJI: Record<string, string> = {
    grateful: '🤝',
    inspired: '✨',
    understood: '💛',
};

const REACTION_LABEL: Record<string, string> = {
    grateful: 'Grateful',
    inspired: 'Inspired',
    understood: 'Understood',
};

const DAY_PART_PILL_STYLE: Record<string, string> = {
    'Morning':    'bg-[rgba(234,216,189,0.35)] text-[rgba(163,125,71,0.85)]',
    'Afternoon':  'bg-[rgba(138,154,111,0.12)] text-[rgba(110,124,90,0.85)]',
    'Evening':    'bg-[rgba(216,199,232,0.25)] text-[rgba(148,130,168,0.85)]',
    'Night':      'bg-[rgba(191,214,221,0.25)] text-[rgba(120,150,160,0.85)]',
    'Late Night': 'bg-[rgba(191,214,221,0.3)] text-[rgba(110,140,150,0.85)]',
};

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });

const formatRelativeAge = (value: string) => {
    const diffMs = Date.now() - new Date(value).getTime();
    if (diffMs < 0) return 'Today';
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 60) return minutes < 1 ? 'Just now' : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 8) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
};

const getDayPart = (value: string): string => {
    const hour = new Date(value).getHours();
    if (hour >= 5 && hour <= 11) return 'Morning';
    if (hour >= 12 && hour <= 16) return 'Afternoon';
    if (hour >= 17 && hour <= 20) return 'Evening';
    if (hour >= 21 && hour <= 23) return 'Night';
    return 'Late Night';
};

const getMoodConfidenceInfo = (score: number) => {
    if (score <= 2) {
        return {
            label: 'Heavy',
            shortLabel: 'Heavy',
            description: 'A strong heavier mood comes through here.',
        };
    }
    if (score <= 4) {
        return {
            label: 'Soft',
            shortLabel: 'Soft',
            description: 'A heavier mood is present, but it reads gently.',
        };
    }
    if (score <= 6) {
        return {
            label: 'Mixed',
            shortLabel: 'Mixed',
            description: 'This memory sits near the middle of the mood scale.',
        };
    }
    if (score <= 8) {
        return {
            label: 'Clear',
            shortLabel: 'Clear',
            description: 'A positive mood comes through clearly.',
        };
    }
    return {
        label: 'Strong',
        shortLabel: 'Strong',
        description: 'A very strong positive mood comes through here.',
    };
};

const PILL_TYPE_LABEL: Record<'tag' | 'skill' | 'lesson', string> = {
    tag: 'Tag',
    skill: 'Skill',
    lesson: 'Lesson',
};

const formatPillTitle = (pill: { fullLabel: string; type: 'tag' | 'skill' | 'lesson' }) =>
    `${PILL_TYPE_LABEL[pill.type]}: ${pill.fullLabel}`;

const formatReactionLabel = (reaction: string) => REACTION_LABEL[reaction] || reaction;

const formatReactionSummary = (reaction: { name: string; reaction: string }) => {
    const label = formatReactionLabel(reaction.reaction);
    const emoji = REACTION_EMOJI[reaction.reaction] || '';
    return emoji
        ? `${emoji} means ${label}. ${reaction.name} reacted ${label.toLowerCase()}.`
        : `${reaction.name} reacted ${label.toLowerCase()}.`;
};

const RING_SIZE = 18;
const RING_R = 6.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function StoryRing({ signal }: { signal: StorySignal }) {
    const pct = Math.min(Math.max(signal.completenessScore, 0), 100) / 100;
    const dashOffset = RING_CIRCUMFERENCE * (1 - pct);

    let strokeColor = 'rgba(217,169,78,0.75)';
    if (signal.status === 'ready_to_verify') strokeColor = 'rgba(217,169,78,0.9)';
    if (signal.status === 'ready_to_export') strokeColor = 'rgb(var(--brand-strong))';
    if (signal.status === 'verified') strokeColor = 'rgba(52,211,153,0.9)';

    return (
        <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="shrink-0"
            aria-label={`${signal.completenessScore}% story complete – ${storyStatusLabel[signal.status]}`}
        >
            <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none" stroke="rgba(141,123,105,0.12)" strokeWidth={2.4} />
            <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                fill="none"
                stroke={strokeColor}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                className="transition-all duration-500"
            />
            {signal.status === 'verified' && (
                <path
                    d={`M${RING_SIZE / 2 - 2.5} ${RING_SIZE / 2}l2 2 3-3.5`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
        </svg>
    );
}

const DEPTH_LABELS = ['Seed', 'Sprout', 'Sapling', 'Growing', 'Bloom'];

function DepthSeed({ level }: { level: number }) {
    const c = level >= 3 ? 'rgba(138,154,111,0.9)' : 'rgba(141,123,105,0.55)';
    return (
        <svg
            width={16}
            height={16}
            viewBox="0 0 16 16"
            className="shrink-0"
            aria-label={`Reflection depth: ${DEPTH_LABELS[level] ?? 'Seed'}`}
        >
            <circle cx={8} cy={12} r={1.8} fill={c} />
            {level >= 1 && <line x1={8} y1={12} x2={8} y2={level >= 3 ? 4 : 6} stroke={c} strokeWidth={1.3} strokeLinecap="round" />}
            {level >= 2 && <path d="M8 7.5 Q10.5 5.5 10 8" fill="none" stroke={c} strokeWidth={1.2} strokeLinecap="round" />}
            {level >= 3 && <path d="M8 6 Q5.5 4 6 6.5" fill="none" stroke={c} strokeWidth={1.2} strokeLinecap="round" />}
            {level >= 4 && (
                <>
                    <circle cx={8} cy={3.8} r={1.2} fill="none" stroke="rgba(138,154,111,0.9)" strokeWidth={1} />
                    <circle cx={8} cy={3.8} r={0.5} fill="rgba(138,154,111,0.9)" />
                </>
            )}
        </svg>
    );
}

function EmotionBars({ emotions }: { emotions: TopEmotion[] }) {
    if (emotions.length === 0) return null;
    const maxIntensity = Math.max(...emotions.map((e) => e.intensity), 1);

    return (
        <div className="flex flex-wrap items-center gap-3">
            {emotions.map(({ emotion, intensity }) => {
                const pct = Math.round((intensity / maxIntensity) * 100);
                return (
                    <div key={emotion} className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-ink-muted uppercase tracking-wider truncate max-w-[4.5rem]">{emotion}</span>
                        <div className="h-1.5 w-10 rounded-full bg-[rgba(141,123,105,0.12)] overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary/90 transition-all"
                                style={{ width: `${Math.max(pct, 12)}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TimelineEntryCardInner({ entry, onShareEntry, isFocused, shareStat, currentReturnTo, disableEntranceAnimation = false }: TimelineEntryCardProps) {
    const derived = useMemo(() => {
        const normalizedMood = normalizeMood(entry.mood);
        const moodColor = getMoodColor(normalizedMood);
        const moodLabel = normalizedMood
            ? normalizedMood.charAt(0).toUpperCase() + normalizedMood.slice(1)
            : null;
        const entryTags = (entry.tags || []).filter(isCardTag);
        const displaySkills = (entry.skills || []).filter(isCardTag);
        const displayLessons = (entry.lessons || []).filter(isCardTag);

        const seenKeys = new Set(entryTags.map((t) => t.toLowerCase()));
        const dedupedSkills = displaySkills.filter((s) => {
            const k = s.toLowerCase();
            if (seenKeys.has(k)) return false;
            seenKeys.add(k);
            return true;
        });
        const dedupedLessons = displayLessons.filter((l) => {
            const k = l.toLowerCase();
            if (seenKeys.has(k)) return false;
            seenKeys.add(k);
            return true;
        });

        const allPills: { key: string; label: string; fullLabel: string; type: 'tag' | 'skill' | 'lesson' }[] = [
            ...entryTags.map((t) => {
                const fullLabel = `#${t}`;
                return {
                    key: `t-${t}`,
                    fullLabel,
                    label: clipCompactPillByLimit(fullLabel, COMPACT_PILL_LIMITS.timelineTag),
                    type: 'tag' as const,
                };
            }),
            ...dedupedSkills.map((s) => {
                const fullLabel = `+${s}`;
                return {
                    key: `s-${s}`,
                    fullLabel,
                    label: clipCompactPillByLimit(fullLabel, COMPACT_PILL_LIMITS.timelineSkill),
                    type: 'skill' as const,
                };
            }),
            ...dedupedLessons.map((l) => ({
                key: `l-${l}`,
                fullLabel: l,
                label: clipCompactPillByLimit(l, COMPACT_PILL_LIMITS.timelineLesson),
                type: 'lesson' as const,
            })),
        ];
        const visible = allPills.slice(0, 3);
        const overflowCount = allPills.length - visible.length;
        const hasPills = entryTags.length > 0 || dedupedSkills.length > 0 || dedupedLessons.length > 0;

        const dayPart = getDayPart(entry.createdAt);
        const formattedDate = formatDate(entry.createdAt);
        const formattedTime = formatTime(entry.createdAt);
        const relativeAge = formatRelativeAge(entry.createdAt);
        const wordCount = entry.content ? entry.content.split(/\s+/).filter(Boolean).length : 0;

        return {
            normalizedMood,
            moodColor,
            moodLabel,
            allPills,
            visible,
            overflowCount,
            hasPills,
            dayPart,
            formattedDate,
            formattedTime,
            relativeAge,
            wordCount,
        };
    }, [entry.mood, entry.tags, entry.skills, entry.lessons, entry.createdAt, entry.content]);

    const {
        normalizedMood,
        moodColor,
        moodLabel,
        allPills,
        visible,
        overflowCount,
        hasPills,
        dayPart,
        formattedDate,
        formattedTime,
        relativeAge,
        wordCount,
    } = derived;

    const isEven = entry.timelineIndex % 2 === 0;
    const storySignal = entry.storySignal;
    const depthLevel = entry.depthLevel ?? 0;
    const topEmotions = entry.topEmotions || [];
    const growthRatio = entry.growthRatio;
    const moodScore = getMoodScore(entry.mood);
    const moodConfidence = getMoodConfidenceInfo(moodScore);
    const moodEmoji = getMoodEmoji(normalizedMood);
    const moodConfidenceTitle = moodLabel
        ? `Mood signal: ${moodConfidence.label}. ${moodConfidence.description}`
        : undefined;
    const moodEmojiTitle = moodLabel || undefined;
    const hiddenPills = allPills.slice(3);
    const hiddenPillTitle = hiddenPills.length > 0
        ? hiddenPills.map(formatPillTitle).join(' ')
        : undefined;
    const hiddenReactions = shareStat?.reactions.slice(3) || [];
    const hiddenReactionTitle = hiddenReactions.length > 0
        ? hiddenReactions.map(formatReactionSummary).join(' ')
        : undefined;
    const storySignalTitle = storySignal
        ? `Story readiness: ${storySignal.completenessScore}% complete. ${storyStatusLabel[storySignal.status]}.`
        : undefined;
    const depthTitle = `Reflection depth: ${entry.depthLabel || DEPTH_LABELS[depthLevel] || 'Seed'}.`;
    const growthTitle = typeof growthRatio === 'number' && growthRatio > 0
        ? `Growth signal: ${growthRatio}% of this memory points toward learning, progress, or strength.`
        : undefined;

    const pillClass = (type: 'tag' | 'skill' | 'lesson') => {
        if (type === 'skill')
            return 'text-[0.6rem] font-semibold text-success bg-success/18 border border-success/45 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 truncate max-w-[6rem] min-[376px]:max-w-[7rem]';
        if (type === 'lesson')
            return 'text-[0.6rem] font-semibold text-accent bg-accent/18 border border-accent/45 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 truncate max-w-[6.75rem] min-[376px]:max-w-[7.75rem]';
        return 'text-[0.6rem] font-semibold text-primary/85 bg-primary/12 border border-primary/30 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 truncate max-w-[5rem] min-[376px]:max-w-[6rem]';
    };

    const articleClassName = `relative flex flex-col md:flex-row gap-3 md:gap-8 ${isEven ? 'md:flex-row-reverse' : ''}`;

    const body = (
        <>
            <div
                className="absolute left-5 md:left-1/2 mt-7 md:mt-8 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-[rgba(var(--paper-border),0.6)] bg-surface-2 shadow-sm"
                aria-hidden="true"
            >
                <span
                    className="h-2.5 w-2.5 rounded-full ring-4 ring-[rgba(141,123,105,0.08)]"
                    style={{ backgroundColor: moodColor }}
                />
            </div>
            <div
                className={`absolute left-5 top-9 hidden h-px w-5 bg-gradient-to-r from-primary/30 to-transparent md:block ${isEven ? 'md:left-[calc(50%-1.25rem)] md:-translate-x-full md:bg-gradient-to-l' : 'md:left-1/2'}`}
                aria-hidden="true"
            />

            <div className="flex-1 md:w-1/2 pl-11 md:pl-0">
                <Link
                    href={appendReturnTo(`/entry/view?id=${entry.id}`, currentReturnTo)}
                    onClick={() => { hapticTap(); audioFeedback.pageTurn(); }}
                    className="block group"
                >
                    <div
                        className={`workspace-panel rounded-[1.25rem] p-2.5 min-[376px]:p-3 border-l-[3px] transition-all duration-300 group-active:scale-[0.985] group-active:shadow-[0_14px_32px_rgba(92,92,92,0.12)]${isFocused ? ' timeline-card-focused' : ''}`}
                        style={{ borderLeftColor: moodColor || 'rgba(141,123,105,0.2)' }}
                    >
                        <div className="flex items-start justify-between gap-1.5 min-[376px]:gap-2 mb-1">
                            <span className="text-[0.6rem] min-[376px]:text-[0.65rem] text-ink-muted uppercase tracking-[0.16em] font-semibold inline-flex items-center gap-1 min-w-0 flex-1">
                                <span className="whitespace-nowrap">{formattedDate}</span>
                                <span className="text-ink-muted/40" aria-hidden="true">&middot;</span>
                                <span className="whitespace-nowrap">{formattedTime}</span>
                                <span className="hidden min-[376px]:inline text-ink-muted/40" aria-hidden="true">&middot;</span>
                                <span className={`hidden min-[376px]:inline whitespace-nowrap rounded-full px-1.5 py-px ${DAY_PART_PILL_STYLE[dayPart] || ''}`}>
                                    {dayPart}
                                </span>
                                <span className="hidden min-[430px]:inline text-ink-muted/40" aria-hidden="true">&middot;</span>
                                <span className="hidden min-[430px]:inline whitespace-nowrap text-ink-muted/75">
                                    {relativeAge}
                                </span>
                            </span>
                            <div className="flex items-center gap-1 min-[376px]:gap-1.5 flex-shrink-0">
                                {(storySignal || entry.category === 'PROFESSIONAL') && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(141,123,105,0.08)] px-1.5 py-1">
                                        {storySignal && storySignalTitle && (
                                            <TooltipHint
                                                content={storySignalTitle}
                                                screenReaderLabel={storySignalTitle}
                                                side="bottom"
                                                align="end"
                                            >
                                                <StoryRing signal={storySignal} />
                                            </TooltipHint>
                                        )}
                                        {entry.category === 'PROFESSIONAL' && (
                                            <span className="text-[0.55rem] min-[376px]:text-[0.6rem] font-semibold text-secondary bg-secondary/15 border border-secondary/35 px-1 min-[376px]:px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                                Pro
                                            </span>
                                        )}
                                    </span>
                                )}
                                {moodLabel && (
                                    <span
                                        className="inline-flex flex-shrink-0 items-center overflow-visible rounded-full border text-[0.6rem] font-semibold"
                                        style={{
                                            color: moodColor,
                                            borderColor: `${moodColor}66`,
                                            backgroundColor: `${moodColor}1f`,
                                        }}
                                    >
                                        <TooltipHint
                                            content={moodEmojiTitle}
                                            screenReaderLabel={moodEmojiTitle}
                                            side="bottom"
                                            align="end"
                                            className="px-1.5 py-0.5 min-[376px]:px-2"
                                        >
                                            <span role="img" aria-label={moodEmojiTitle}>
                                                {moodEmoji}
                                            </span>
                                        </TooltipHint>
                                        <TooltipHint
                                            content={moodConfidenceTitle}
                                            screenReaderLabel={moodConfidenceTitle}
                                            side="bottom"
                                            align="end"
                                            className="hidden border-l border-current/20 px-2 py-0.5 sm:inline-flex"
                                        >
                                            <span className="whitespace-nowrap">{moodConfidence.shortLabel}</span>
                                        </TooltipHint>
                                    </span>
                                )}
                            </div>
                        </div>

                        <h3 className="text-sm font-serif workspace-heading mb-0.5 group-hover:text-primary transition-colors line-clamp-2">
                            {entry.title || 'Untitled Memory'}
                        </h3>

                        <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs text-ink-secondary leading-snug line-clamp-2 flex-1 min-w-0">
                                {entry.content}
                            </p>
                            {entry.content && (
                                <span className="shrink-0 text-[0.55rem] font-medium text-ink-muted/70 tabular-nums">
                                    {wordCount}w
                                </span>
                            )}
                        </div>

                        {(entry.analysisLine || entry.takeawayLine) && (
                            <div className="mb-1.5 space-y-1 rounded-lg border border-[rgba(141,123,105,0.12)] bg-[rgba(141,123,105,0.045)] px-2 py-1.5">
                                {entry.analysisLine && (
                                    <p className="flex min-w-0 items-start gap-1.5 text-[0.66rem] leading-snug text-ink-secondary">
                                        <span className="mt-[0.12rem] shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[0.5rem] font-bold uppercase tracking-[0.12em] text-primary/75">Noticed</span>
                                        <span className="line-clamp-2">{entry.analysisLine}</span>
                                    </p>
                                )}
                                {entry.takeawayLine && (
                                    <p className="flex min-w-0 items-start gap-1.5 text-[0.66rem] leading-snug text-ink-secondary">
                                        <span className="mt-[0.12rem] shrink-0 rounded-full bg-accent/12 px-1.5 py-px text-[0.5rem] font-bold uppercase tracking-[0.12em] text-accent/80">Try</span>
                                        <span className="line-clamp-2">{entry.takeawayLine}</span>
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <TooltipHint
                                content={depthTitle}
                                screenReaderLabel={depthTitle}
                                align="start"
                            >
                                <DepthSeed level={depthLevel} />
                            </TooltipHint>
                            {topEmotions.length > 0 && (
                                <>
                                    <span className="w-px h-3 bg-[rgba(141,123,105,0.2)]" />
                                    <EmotionBars emotions={topEmotions} />
                                </>
                            )}
                        </div>

                        {(hasPills || onShareEntry) && (
                            <div className="chip-scroller gap-1 mt-1.5">
                                {visible.map((pill) => (
                                    <TooltipHint
                                        key={pill.key}
                                        content={formatPillTitle(pill)}
                                        screenReaderLabel={formatPillTitle(pill)}
                                        align="start"
                                        tooltipClassName="max-w-[12rem]"
                                    >
                                        <span className={pillClass(pill.type)}>
                                            {pill.label}
                                        </span>
                                    </TooltipHint>
                                ))}
                                {overflowCount > 0 && hiddenPillTitle && (
                                    <TooltipHint
                                        content={hiddenPillTitle}
                                        screenReaderLabel={hiddenPillTitle}
                                        align="start"
                                        tooltipClassName="max-w-[13rem]"
                                    >
                                        <span className="text-[0.6rem] text-ink-muted whitespace-nowrap flex-shrink-0 rounded-full bg-[rgba(141,123,105,0.08)] px-1.5 py-0.5">
                                            +{overflowCount}
                                        </span>
                                    </TooltipHint>
                                )}
                                {typeof growthRatio === 'number' && growthRatio > 0 && (
                                    <TooltipHint
                                        content={growthTitle}
                                        screenReaderLabel={growthTitle}
                                        align="start"
                                    >
                                        <span
                                            className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-0.5"
                                            style={{ color: 'rgba(138,154,111,0.9)', backgroundColor: 'rgba(138,154,111,0.1)' }}
                                        >
                                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                                <path d="M5 9V4M5 4C5 2.5 3.5 1 2 1M5 4C5 2.5 6.5 1 8 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                            </svg>
                                            {growthRatio}%
                                        </span>
                                    </TooltipHint>
                                )}
                                {onShareEntry && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onShareEntry(entry.id);
                                        }}
                                        className="ml-auto inline-flex h-8 w-8 flex-shrink-0 items-center justify-center gap-1 rounded-full border border-[rgba(107,143,113,0.22)] bg-[rgba(107,143,113,0.08)] text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[rgb(107,143,113)] transition-colors hover:bg-[rgba(107,143,113,0.16)] sm:w-auto sm:px-2.5"
                                        aria-label="Share this memory"
                                    >
                                        <FiShare2 size={11} aria-hidden="true" />
                                        <span className="hidden whitespace-nowrap sm:inline">
                                            {shareStat && shareStat.shareCount > 0
                                                ? `Shared${shareStat.shareCount > 1 ? ` ${shareStat.shareCount}x` : ''}`
                                                : 'Share'}
                                        </span>
                                    </button>
                                )}
                            </div>
                        )}

                        {shareStat && shareStat.reactions.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                                {shareStat.reactions.slice(0, 3).map((r, i) => {
                                    const reactionEmoji = REACTION_EMOJI[r.reaction] || '';
                                    const reactionTitle = formatReactionSummary(r);

                                    return (
                                        <TooltipHint
                                            key={`${r.name}-${r.reaction}-${i}`}
                                            content={reactionTitle}
                                            screenReaderLabel={reactionTitle}
                                            align="start"
                                        >
                                            <span className="inline-flex items-center gap-0.5 rounded-full bg-[rgba(107,143,113,0.08)] px-1.5 py-0.5 text-[0.55rem] font-medium text-[rgb(107,143,113)]">
                                                {reactionEmoji && (
                                                    <span role="img" aria-label={`${reactionEmoji} means ${formatReactionLabel(r.reaction)}`}>
                                                        {reactionEmoji}
                                                    </span>
                                                )}
                                                {r.name}
                                            </span>
                                        </TooltipHint>
                                    );
                                })}
                                {shareStat.reactions.length > 3 && hiddenReactionTitle && (
                                    <TooltipHint
                                        content={hiddenReactionTitle}
                                        screenReaderLabel={hiddenReactionTitle}
                                        align="start"
                                    >
                                        <span className="rounded-full bg-[rgba(141,123,105,0.08)] px-1.5 py-0.5 text-[0.55rem] font-medium text-[rgb(160,160,160)]">
                                            +{shareStat.reactions.length - 3}
                                        </span>
                                    </TooltipHint>
                                )}
                            </div>
                        )}

                        {(entry.storySignal?.status === 'ready_to_export' || entry.storySignal?.status === 'verified') && (
                            <div className="mt-2 pt-2 border-t border-[rgba(141,123,105,0.14)]">
                                <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(141,123,105,0.22)] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[rgba(141,123,105,0.75)]">
                                    {entry.storySignal.status === 'verified' ? 'Add to portfolio' : 'Export to…'}
                                </span>
                            </div>
                        )}
                    </div>
                </Link>
            </div>

            <div className="hidden md:block flex-1 md:w-1/2" />
        </>
    );

    if (disableEntranceAnimation) {
        return (
            <article
                data-entry-id={entry.id}
                className={articleClassName}
                style={OFFSCREEN_CARD_STYLE}
            >
                {body}
            </article>
        );
    }

    return (
        <motion.article
            data-entry-id={entry.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.36, delay: Math.min(entry.timelineIndex * 0.03, 0.24) }}
            className={articleClassName}
        >
            {body}
        </motion.article>
    );
}

const TimelineEntryCard = memo(TimelineEntryCardInner);
export default TimelineEntryCard;
