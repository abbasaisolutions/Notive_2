'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import { pickRotatingCopy } from '@/utils/rotating-copy';

/**
 * Progressive disclosure gates for the dashboard.
 *
 * Each tier unlocks at an entry-count threshold:
 *   0      → only greeting + write CTA
 *   1-2    → focus card + "what's coming" preview
 *   3-4    → Writer DNA + mood sparkline + gentle reflection
 *   5-9    → quick pulse strip + pattern discovery teasers
 *   10-19  → prime time + writing rhythm + resilience
 *   20+    → full insight dashboard
 *   30+    → health bridge (requires health data)
 */

export type InsightTier = 0 | 1 | 2 | 3 | 4 | 5;

export function getInsightTier(entryCount: number): InsightTier {
    if (entryCount >= 20) return 5;
    if (entryCount >= 10) return 4;
    if (entryCount >= 5) return 3;
    if (entryCount >= 3) return 2;
    if (entryCount >= 1) return 1;
    return 0;
}

type GateProps = {
    /** Minimum tier required to show children */
    minTier: InsightTier;
    /** Current tier based on entry count */
    currentTier: InsightTier;
    children: React.ReactNode;
};

/** Show children only when the user has reached the required tier. */
export function Gate({ minTier, currentTier, children }: GateProps) {
    if (currentTier < minTier) return null;
    return <>{children}</>;
}

// ── Locked-insight previews shown at tier 1 (1-2 entries) ──

type UpcomingInsight = {
    label: string;
    entriesNeeded: number;
    currentEntries: number;
};

function getUpcomingInsights(entryCount: number): UpcomingInsight[] {
    const upcoming: UpcomingInsight[] = [];

    if (entryCount < 3) {
        upcoming.push({ label: 'Writer DNA', entriesNeeded: 3, currentEntries: entryCount });
    }
    if (entryCount < 5) {
        upcoming.push({ label: 'Emotional Fingerprint', entriesNeeded: 5, currentEntries: entryCount });
    }
    if (entryCount < 10) {
        upcoming.push({ label: 'Your Prime Time', entriesNeeded: 10, currentEntries: entryCount });
    }

    return upcoming.slice(0, 3);
}

export function WhatsComingCard({ entryCount }: { entryCount: number }) {
    const insights = getUpcomingInsights(entryCount);
    if (insights.length === 0) return null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="notebook-card-soft rounded-[1.75rem] p-5"
        >
            <p
                className="section-label mb-3"
                style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
            >
                What&rsquo;s forming
            </p>

            <div className="space-y-2.5">
                {insights.map((insight) => {
                    const remaining = insight.entriesNeeded - insight.currentEntries;
                    const progress = Math.min(insight.currentEntries / insight.entriesNeeded, 1);

                    return (
                        <div key={insight.label} className="flex items-center gap-3">
                            {/* Progress ring */}
                            <div className="shrink-0">
                                <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
                                    <circle
                                        cx="14" cy="14" r="11"
                                        fill="none"
                                        stroke="rgba(var(--paper-border), 0.5)"
                                        strokeWidth="2.5"
                                    />
                                    <circle
                                        cx="14" cy="14" r="11"
                                        fill="none"
                                        stroke="rgba(var(--brand-strong), 0.7)"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeDasharray={`${progress * 69.1} 69.1`}
                                        transform="rotate(-90 14 14)"
                                    />
                                </svg>
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium" style={{ color: 'rgb(var(--paper-ink))' }}>
                                    {insight.label}
                                </p>
                                <p className="notebook-muted text-xs">
                                    {remaining} more {remaining === 1 ? 'note' : 'notes'} to unlock
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.section>
    );
}

// ── First Read: what Notive extracted from the first entry ──

type FirstReadProps = {
    mood?: string | null;
    tags: string[];
    createdAt: string;
    entities?: string[];
    topics?: string[];
    lessons?: string[];
    skills?: string[];
};

const FIRST_READ_READING_DURATION = 900;

const revealItem = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 0.61, 0.36, 1] } },
};

export function FirstReadCard({ mood, tags, entities, topics, lessons, skills, createdAt }: FirstReadProps) {
    const reducedMotion = useReducedMotion();
    const [isReading, setIsReading] = useState(!reducedMotion);

    useEffect(() => {
        if (reducedMotion) {
            setIsReading(false);
            return;
        }
        const timer = setTimeout(() => setIsReading(false), FIRST_READ_READING_DURATION);
        return () => clearTimeout(timer);
    }, [reducedMotion]);

    const hasContent = mood || tags.length > 0
        || (entities && entities.length > 0) || (topics && topics.length > 0)
        || (lessons && lessons.length > 0) || (skills && skills.length > 0);
    if (!hasContent) return null;

    const writtenAt = new Date(createdAt);
    const hour = writtenAt.getHours();
    const timeLabel = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

    const staggerContainer = {
        hidden: {},
        show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
    };

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="notebook-card-soft rounded-[1.75rem] p-5"
            aria-live="polite"
        >
            <div className="mb-3 flex items-center gap-2">
                <motion.span
                    aria-hidden="true"
                    animate={isReading ? { rotate: [0, -6, 6, -4, 4, 0], y: [0, -1, 1, 0] } : { rotate: 0 }}
                    transition={isReading ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                    className="inline-flex"
                >
                    <NotebookDoodle name="quill" accent="sage" size={20} />
                </motion.span>
                <p
                    className="section-label"
                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                >
                    {isReading ? 'Reading your entry…' : 'Notive’s first read'}
                </p>
            </div>

            <AnimatePresence mode="wait">
                {!isReading && (
                    <motion.div
                        key="read-results"
                        className="space-y-2"
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                    >
                        {lessons && lessons.length > 0 && (
                            <motion.p variants={revealItem} className="text-sm" style={{ color: 'rgb(var(--paper-ink))' }}>
                                Lesson extracted: <span className="font-medium">{lessons[0]}</span>
                            </motion.p>
                        )}

                        {skills && skills.length > 0 && (
                            <motion.p variants={revealItem} className="text-sm" style={{ color: 'rgb(var(--paper-ink))' }}>
                                {skills.length === 1 ? 'Skill' : 'Skills'} spotted:{' '}
                                <span className="font-medium">{skills.slice(0, 3).join(', ')}</span>
                            </motion.p>
                        )}

                        {mood && (
                            <motion.p variants={revealItem} className="text-sm" style={{ color: 'rgb(var(--paper-ink))' }}>
                                Mood detected: <span className="font-medium capitalize">{mood}</span>
                            </motion.p>
                        )}

                        {entities && entities.length > 0 && (
                            <motion.p variants={revealItem} className="text-sm" style={{ color: 'rgb(var(--paper-ink))' }}>
                                {entities.length === 1 ? 'Person mentioned' : 'People mentioned'}:{' '}
                                <span className="font-medium">{entities.slice(0, 3).join(', ')}</span>
                            </motion.p>
                        )}

                        {topics && topics.length > 0 && (
                            <motion.p variants={revealItem} className="text-sm italic" style={{ color: 'rgb(var(--paper-ink-soft))', fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                                {topics[0]}
                            </motion.p>
                        )}

                        {tags.length > 0 && (
                            <motion.div variants={revealItem} className="flex flex-wrap gap-1.5 pt-1">
                                {tags.slice(0, 4).map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full border border-[rgba(var(--paper-border),0.5)] bg-[rgba(var(--paper-border),0.12)] px-2.5 py-0.5 text-xs"
                                        style={{ color: 'rgb(var(--paper-ink-soft))' }}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </motion.div>
                        )}

                        <motion.p variants={revealItem} className="text-xs pt-1" style={{ color: 'rgb(var(--paper-ink-muted))' }}>
                            You write in the {timeLabel}. Your record is building.
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.section>
    );
}

const EMPTY_DASHBOARD_VARIANTS = [
    {
        title: 'Your dashboard grows with you.',
        body: 'After your first few notes, Notive starts its magic here and turns moments into patterns.',
    },
    {
        title: 'This page fills in as you write.',
        body: 'One honest note is all it takes — Notive builds the rest alongside you.',
    },
    {
        title: 'An empty page is a good start.',
        body: 'Capture a moment from today. Your patterns, lessons, and threads show up on their own.',
    },
] as const;

/** Warm empty state for tier 0 (zero entries). */
export function EmptyDashboard({ writeHref }: { writeHref: string }) {
    const copy = pickRotatingCopy('empty-dashboard', EMPTY_DASHBOARD_VARIANTS);
    return (
        <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="notebook-shell rounded-[2.25rem] px-6 py-10 text-center"
        >
            <NotebookDoodle name="sprout" accent="sage" className="mx-auto mb-4 animate-[breathe_3s_ease-in-out_infinite]" />
            <h2
                className="notebook-title text-lg"
                style={{ color: 'rgb(var(--paper-ink))' }}
            >
                {copy.title}
            </h2>
            <p
                className="notebook-copy mt-2 text-sm mx-auto max-w-xs"
                style={{ color: 'rgb(var(--paper-ink-soft))' }}
            >
                {copy.body}
            </p>
            <a
                href={writeHref}
                className="notebook-primary-cta mt-5 inline-flex items-center justify-center rounded-[1rem] px-5 py-3 text-sm font-semibold"
            >
                Write your first note
            </a>
        </motion.section>
    );
}
