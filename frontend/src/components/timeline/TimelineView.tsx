'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { getMoodColor, getMoodEmoji, normalizeMood } from '@/constants/moods';
import { EmptyState } from '@/components/ui';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { buildTimelineMonthGroups } from '@/utils/timeline-groups';
import { storyStatusLabel, type StorySignal } from '@/utils/story-engine';
import NotiveNoticedPanel, { type NotiveInsight } from './NotiveNoticedPanel';

// Tags/skills shown on a card must pass this — filters NLP garbage like #im, #has, #nodeo
const CARD_TAG_NOISE = new Set([
    'im','ive','id','ill','its','dont','didnt','wont','cant','not',
    'has','had','have','does','did','just','like','also','some','both',
    'this','that','what','when','where','good','okay','yeah','very','even',
    'make','made','more','much','many','every','really','back','still',
    'thing','things','day','today','time','week','feel','feels','felt',
    'want','know','think','said','with','from','into','over','down','life',
    'work','node','nodeo','features','nothing','something','everything',
]);
const isCardTag = (t: string) => t.length >= 4 && !CARD_TAG_NOISE.has(t.toLowerCase().replace(/[^a-z0-9-]/g,''));

export interface TopEmotion {
    emotion: string;
    intensity: number;
}

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
    // Enrichment fields from API
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
}

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

/* ─── Story completeness ring ──────────────────────────────
 *  Replaces the opaque text capsule ("Ready To Verify") with
 *  a 16×16 SVG arc that reads instantly like a fitness ring.
 *    • Fill = completenessScore %
 *    • Colour journey: amber → primary → emerald
 *    • Verified state gets a ✓ in the centre
 * ────────────────────────────────────────────────────────── */
const RING_SIZE = 18;
const RING_R = 6.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function StoryRing({ signal }: { signal: StorySignal }) {
    const pct = Math.min(Math.max(signal.completenessScore, 0), 100) / 100;
    const dashOffset = RING_CIRCUMFERENCE * (1 - pct);

    // Colour shifts through the lifecycle
    let strokeColor = 'rgba(217,169,78,0.75)';  // amber – needs work
    if (signal.status === 'ready_to_verify') strokeColor = 'rgba(217,169,78,0.9)';
    if (signal.status === 'ready_to_export') strokeColor = 'rgb(var(--brand-strong))';
    if (signal.status === 'verified') strokeColor = 'rgba(52,211,153,0.9)';

    const trackColor = 'rgba(141,123,105,0.12)';

    return (
        <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="shrink-0"
            aria-label={`${signal.completenessScore}% story complete – ${storyStatusLabel[signal.status]}`}
        >
            {/* Track */}
            <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                fill="none"
                stroke={trackColor}
                strokeWidth={2.4}
            />
            {/* Progress arc */}
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
            {/* Verified ✓ centre */}
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

/* ─── Depth seed-to-bloom ──────────────────────────────────
 *  Replaces abstract segmented bar + "Surface" text with
 *  a single 16×16 SVG that grows organically:
 *    0 → seed dot
 *    1 → sprout (stem)
 *    2 → sapling (stem + leaf)
 *    3 → growing (stem + two leaves)
 *    4 → bloom (stem + leaves + flower)
 *  Zero text. Students instinctively feel "bigger = deeper."
 * ────────────────────────────────────────────────────────── */
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
            {/* Level 0 – seed dot */}
            <circle cx={8} cy={12} r={1.8} fill={c} />

            {level >= 1 && (
                /* Stem */
                <line x1={8} y1={12} x2={8} y2={level >= 3 ? 4 : 6} stroke={c} strokeWidth={1.3} strokeLinecap="round" />
            )}

            {level >= 2 && (
                /* First leaf – right */
                <path d="M8 7.5 Q10.5 5.5 10 8" fill="none" stroke={c} strokeWidth={1.2} strokeLinecap="round" />
            )}

            {level >= 3 && (
                /* Second leaf – left */
                <path d="M8 6 Q5.5 4 6 6.5" fill="none" stroke={c} strokeWidth={1.2} strokeLinecap="round" />
            )}

            {level >= 4 && (
                /* Bloom petals */
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
    const maxIntensity = Math.max(...emotions.map(e => e.intensity), 1);

    return (
        <div className="flex flex-wrap items-center gap-3">
            {emotions.map(({ emotion, intensity }) => {
                const pct = Math.round((intensity / maxIntensity) * 100);
                return (
                    <div key={emotion} className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-ink-muted uppercase tracking-wider truncate max-w-[4.5rem]">
                            {emotion}
                        </span>
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

export default function TimelineView({ entries, tagCounts = {}, seasonAnchorsByMonthKey = {}, onShareEntry }: TimelineViewProps) {
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
        <div className="relative py-3 md:py-10">
            <div className="absolute left-5 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/55 via-white/15 to-transparent" />

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
                            {group.entries.map((entry) => {
                                const isEven = entry.timelineIndex % 2 === 0;
                                const normalizedMood = normalizeMood(entry.mood);
                                const moodColor = getMoodColor(normalizedMood);
                                const moodLabel = normalizedMood
                                    ? normalizedMood.charAt(0).toUpperCase() + normalizedMood.slice(1)
                                    : null;
                                const source = entry.source || 'NOTIVE';
                                const sourceBadgeStyle = 'workspace-pill text-ink-secondary';
                                const storySignal = entry.storySignal;
                                const depthLevel = entry.depthLevel ?? 0;
                                const depthLabel = entry.depthLabel || 'Surface';
                                const topEmotions = entry.topEmotions || [];
                                const growthRatio = entry.growthRatio;
                                const entryTags = (entry.tags || []).filter(isCardTag);
                                const displaySkills = (entry.skills || []).filter(isCardTag);
                                const displayLessons = (entry.lessons || []).filter(isCardTag);

                                return (
                                    <motion.article
                                        key={entry.id}
                                        initial={{ opacity: 0, y: 16 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true, margin: '-80px' }}
                                        transition={{ duration: 0.36, delay: Math.min(entry.timelineIndex * 0.03, 0.24) }}
                                        className={`relative flex flex-col md:flex-row gap-3 md:gap-8 ${isEven ? 'md:flex-row-reverse' : ''}`}
                                    >
                                        <div
                                            className="absolute left-5 md:left-1/2 w-3.5 h-3.5 rounded-full -translate-x-1/2 mt-7 md:mt-8 border-2 border-surface-2 z-10"
                                            style={{ backgroundColor: moodColor }}
                                        />

                                        <div className="flex-1 md:w-1/2 pl-11 md:pl-0">
                                            <Link href={appendReturnTo(`/entry/view?id=${entry.id}`, currentReturnTo)} className="block group">
                                                {/* ① Mood left-border accent */}
                                                <div
                                                    className="workspace-panel rounded-[1.25rem] p-3 border-l-[3px] transition-colors"
                                                    style={{ borderLeftColor: moodColor || 'rgba(141,123,105,0.2)' }}
                                                >
                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                        <span className="text-[0.65rem] text-ink-muted uppercase tracking-[0.16em] font-semibold">
                                                            {formatDate(entry.createdAt)}
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            {storySignal && (
                                                                <StoryRing signal={storySignal} />
                                                            )}
                                                            {entry.category === 'PROFESSIONAL' && (
                                                                <span className="text-[0.6rem] font-semibold text-secondary bg-secondary/15 border border-secondary/35 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                                                    Pro
                                                                </span>
                                                            )}
                                                            {moodLabel && (
                                                                <span
                                                                    className="text-[0.6rem] font-semibold px-2 py-0.5 rounded-full border"
                                                                    style={{
                                                                        color: moodColor,
                                                                        borderColor: `${moodColor}66`,
                                                                        backgroundColor: `${moodColor}1f`,
                                                                    }}
                                                                >
                                                                    {getMoodEmoji(normalizedMood)}
                                                                </span>
                                                            )}
                                                            {onShareEntry && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onShareEntry(entry.id); }}
                                                                    className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(92,92,92,0.12)] bg-[rgba(var(--brand),0.06)] text-[rgb(107,143,113)] transition-colors hover:bg-[rgba(var(--brand),0.16)]"
                                                                    title="Share this memory"
                                                                    aria-label="Share this memory"
                                                                >
                                                                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                                                        <path d="M2 7.5V11.5C2 12.05 2.45 12.5 3 12.5H11C11.55 12.5 12 12.05 12 11.5V7.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                                                                        <path d="M7 1.5V9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                                                                        <path d="M4.5 4L7 1.5L9.5 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <h3 className="text-sm font-serif workspace-heading mb-0.5 group-hover:text-primary transition-colors line-clamp-2">
                                                        {entry.title || 'Untitled Memory'}
                                                    </h3>

                                                    <p className="text-xs text-ink-secondary leading-snug line-clamp-2 mb-1.5">
                                                        {entry.content}
                                                    </p>

                                                    {/* ② Reflection Depth seed + ④ Emotion bars */}
                                                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                                        <DepthSeed level={depthLevel} />
                                                        {topEmotions.length > 0 && (
                                                            <>
                                                                <span className="w-px h-3 bg-[rgba(141,123,105,0.2)]" />
                                                                <EmotionBars emotions={topEmotions} />
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Tags — single line, compact, no-wrap */}
                                                    {entryTags.length > 0 && (
                                                        <div className="flex items-center gap-1 overflow-hidden mt-1.5">
                                                            {entryTags.slice(0, 2).map(tag => (
                                                                <span
                                                                    key={tag}
                                                                    className="text-[0.6rem] font-medium text-primary/75 bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
                                                                >
                                                                    #{tag}
                                                                </span>
                                                            ))}
                                                            {entryTags.length > 2 && (
                                                                <span className="text-[0.6rem] text-ink-muted whitespace-nowrap flex-shrink-0">
                                                                    +{entryTags.length - 2}
                                                                </span>
                                                            )}
                                                            {typeof growthRatio === 'number' && growthRatio > 0 && (
                                                                <span
                                                                    className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-0.5"
                                                                    style={{ color: 'rgba(138,154,111,0.9)', backgroundColor: 'rgba(138,154,111,0.1)' }}
                                                                >
                                                                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M5 9V4M5 4C5 2.5 3.5 1 2 1M5 4C5 2.5 6.5 1 8 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                                                                    {growthRatio}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {(displaySkills.length > 0 || displayLessons.length > 0) && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {displaySkills.slice(0, 2).map(skill => (
                                                                <span key={skill} className="text-[0.6rem] font-semibold text-success bg-success/15 border border-success/35 px-1.5 py-0.5 rounded-full">
                                                                    +{skill}
                                                                </span>
                                                            ))}
                                                            {displayLessons.slice(0, 1).map(lesson => (
                                                                <span key={lesson} className="text-[0.6rem] font-semibold text-accent bg-accent/15 border border-accent/35 px-1.5 py-0.5 rounded-full">
                                                                    {lesson}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* ⑥ + ⑦ Notive Noticed panel (tiered reveal + evolving CTA inside) */}
                                                    {(entry.notiveInsights?.length || entry.reflection || (entry.skills?.length ?? 0) > 0 || (entry.lessons?.length ?? 0) > 0 || entry.storySignal) && (
                                                        <NotiveNoticedPanel
                                                            skills={entry.skills}
                                                            lessons={entry.lessons}
                                                            reflection={entry.reflection}
                                                            notiveInsights={entry.notiveInsights}
                                                            storySignal={entry.storySignal}
                                                            mood={entry.mood}
                                                            lifeArea={entry.lifeArea}
                                                            tagCounts={tagCounts}
                                                            entryTags={entryTags}
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
