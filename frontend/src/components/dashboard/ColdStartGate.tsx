'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';

/**
 * Progressive disclosure gates for the dashboard.
 *
 * Each tier unlocks at an entry-count threshold:
 *   0      → only greeting + write CTA
 *   1-2    → focus card + "what's coming" preview
 *   3-4    → writing style + mood sparkline + daily reflection
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

// ── Locked-insight previews shown below the full-insight tier ──

type UpcomingInsight = {
    label: string;
    entriesNeeded: number;
    currentEntries: number;
};

function getUpcomingInsights(entryCount: number): UpcomingInsight[] {
    const upcoming: UpcomingInsight[] = [];

    if (entryCount < 3) {
        upcoming.push({ label: 'Writing style', entriesNeeded: 3, currentEntries: entryCount });
    }
    if (entryCount < 5) {
        upcoming.push({ label: 'Mood map', entriesNeeded: 5, currentEntries: entryCount });
    }
    if (entryCount < 10) {
        upcoming.push({ label: 'When you write', entriesNeeded: 10, currentEntries: entryCount });
    }

    return upcoming.slice(0, 3);
}

export function WhatsComingCard({ entryCount }: { entryCount: number }) {
    const insights = getUpcomingInsights(entryCount);
    if (insights.length === 0) return null;

    return (
        <motion.section
            className="notebook-card-soft rounded-card-175 p-5"
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

const EMPTY_DASHBOARD_COPY = {
    title: 'Nothing here yet.',
    body: 'Patterns, moods, and threads appear after your first few notes.',
} as const;

/** Empty state for tier 0 (zero entries). */
export function EmptyDashboard({ writeHref }: { writeHref: string }) {
    const copy = EMPTY_DASHBOARD_COPY;
    return (
        <motion.section
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
                className="notebook-primary-cta mt-5 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold"
            >
                Write your first note
            </a>
        </motion.section>
    );
}
