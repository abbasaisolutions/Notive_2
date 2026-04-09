'use client';

import React, { useState } from 'react';
import { NotebookDoodle, type NotebookDoodleName, type NotebookAccentName } from '@/components/dashboard/NotebookDoodles';
import type { StorySignal } from '@/utils/story-engine';
import { clipCompactPillByLimit, COMPACT_PILL_LIMITS } from '@/utils/tags';

type NotiveDoodle = 'knot' | 'ladder' | 'sprout' | 'steady-me' | 'reach-someone' | 'see-my-growth' | 'shape-my-future';

export type NotiveInsight = {
    type: 'thread' | 'lesson' | 'strength';
    text: string;
    doodle: NotiveDoodle;
};

interface NotiveNoticedPanelProps {
    skills?: string[];
    lessons?: string[];
    reflection?: string | null;
    storySignal?: StorySignal;
    mood?: string | null;
    lifeArea?: string | null;
    notiveInsights?: NotiveInsight[] | null;
    /** Global tag frequency counts for evolving CTA */
    tagCounts?: Record<string, number>;
    /** Tags on this specific entry */
    entryTags?: string[];
}

const DOODLE_MAP: Record<NotiveDoodle, { name: NotebookDoodleName; accent: NotebookAccentName }> = {
    'knot':           { name: 'knot',           accent: 'lilac'    },
    'ladder':         { name: 'ladder',         accent: 'sky'      },
    'sprout':         { name: 'sprout',         accent: 'sage'     },
    'steady-me':      { name: 'steady-me',      accent: 'sage'     },
    'reach-someone':  { name: 'reach-someone',  accent: 'apricot'  },
    'see-my-growth':  { name: 'see-my-growth',  accent: 'lilac'    },
    'shape-my-future':{ name: 'shape-my-future',accent: 'amber'    },
};

function pickFallbackDoodle(
    mood: string | null | undefined,
    storySignal: StorySignal | undefined,
    lessons: string[] | undefined,
): NotiveDoodle {
    if (storySignal?.status === 'verified') return 'shape-my-future';
    if (storySignal?.status === 'ready_to_export') return 'shape-my-future';
    const m = (mood || '').toLowerCase();
    if (/anxious|sad|heavy|frustrated|overwhelm|stress|uncertain|confused/.test(m)) return 'knot';
    if (/proud|brave|courage|confident|achiev|creat/.test(m)) return 'see-my-growth';
    if ((lessons?.length ?? 0) > 0) return 'ladder';
    return 'sprout';
}

function buildFallbackBullets(
    skills: string[] | undefined,
    lessons: string[] | undefined,
    reflection: string | null | undefined,
    storySignal: StorySignal | undefined,
): string[] {
    const bullets: string[] = [];

    if (reflection?.trim()) bullets.push(reflection.trim());

    if ((lessons?.length ?? 0) > 0 && bullets.length < 2)
        bullets.push(`Lesson learned: ${lessons![0]}`);

    if ((skills?.length ?? 0) > 0 && bullets.length < 2)
        bullets.push(`Strength showing up: ${skills![0]}`);

    if (bullets.length < 2 && (skills?.length ?? 0) > 1)
        bullets.push(`Strength showing up: ${skills![1]}`);

    if (bullets.length === 0) {
        if (storySignal?.status === 'ready_to_export')
            bullets.push('This memory is strong evidence of growth — almost ready for your Stories ledger.');
        else if (storySignal?.status === 'ready_to_verify')
            bullets.push('Adding one more detail could turn this into a full story anchor.');
        else
            bullets.push('Keep writing — each entry adds to your pattern.');
    }

    return bullets.slice(0, 3);
}

/**
 * ⑦ Evolving CTA: adapts based on familiarity (tag recurrence) and story completion.
 * - New theme → "When did you first notice this?"
 * - Recurring theme (2-4×) → "How is this different from last time?"
 * - Deep recurring (5+) → "What's changed since you started writing about this?"
 * - Verified story → "Add this to your portfolio"
 */
function buildNextMove(
    storySignal: StorySignal | undefined,
    skills: string[] | undefined,
    lessons: string[] | undefined,
    tagCounts?: Record<string, number>,
    entryTags?: string[],
): string {
    if (storySignal?.status === 'verified') return 'Add this to your portfolio';
    if (storySignal?.status === 'ready_to_export') return 'Export to your Stories ledger';

    // Evolving CTA based on tag recurrence
    if (tagCounts && entryTags && entryTags.length > 0) {
        const maxTagCount = Math.max(...entryTags.map(t => tagCounts[t] || 0));
        if (maxTagCount >= 5) return "What's changed since you started writing about this?";
        if (maxTagCount >= 2) return 'How is this different from last time?';
        return 'When did you first notice this?';
    }

    if ((lessons?.length ?? 0) > 0) return 'Re-read + add one sentence';
    if ((skills?.length ?? 0) > 0) return 'Name one moment this showed up';
    return 'Write one more sentence here';
}

/**
 * ⑨ Connection dots: show how many related entries share tags with this one.
 */
function ConnectionDots({ entryTags, tagCounts }: { entryTags: string[]; tagCounts: Record<string, number> }) {
    if (!entryTags || entryTags.length === 0) return null;

    const relatedCount = Math.max(
        0,
        Math.max(...entryTags.map(t => (tagCounts[t] || 0))) - 1,
    );

    if (relatedCount <= 0) return null;

    const dotCount = Math.min(relatedCount, 5);

    return (
        <span className="inline-flex items-center gap-1 ml-2">
            <span className="flex items-center gap-0.5">
                {Array.from({ length: dotCount }).map((_, i) => (
                    <span
                        key={i}
                        className="w-1 h-1 rounded-full inline-block"
                        style={{ backgroundColor: `rgba(var(--brand-strong), ${0.3 + (i * 0.12)})` }}
                    />
                ))}
            </span>
            <span className="text-[9px] text-ink-muted">{relatedCount}×</span>
        </span>
    );
}

export default function NotiveNoticedPanel({
    skills,
    lessons,
    reflection,
    storySignal,
    mood,
    notiveInsights,
    tagCounts = {},
    entryTags = [],
}: NotiveNoticedPanelProps) {
    const [expanded, setExpanded] = useState(false);
    const nextMove = buildNextMove(storySignal, skills, lessons, tagCounts, entryTags);

    // Use LLM insights when available, otherwise derive from static data
    const hasLlmInsights = notiveInsights && notiveInsights.length > 0;

    const allBullets = hasLlmInsights
        ? notiveInsights!.map(i => i.text)
        : buildFallbackBullets(skills, lessons, reflection, storySignal);

    // ⑥ Tiered reveal: show 1 by default, expand for rest
    const visibleBullets = expanded ? allBullets : allBullets.slice(0, 1);
    const hiddenCount = allBullets.length - 1;

    const primaryDoodleKey: NotiveDoodle = hasLlmInsights
        ? (notiveInsights![0].doodle || 'sprout')
        : pickFallbackDoodle(mood, storySignal, lessons);
    const { name: doodleName, accent } = DOODLE_MAP[primaryDoodleKey] ?? DOODLE_MAP['sprout'];

    return (
        <div className="mt-2 pt-2 border-t border-[rgba(141,123,105,0.14)]">
            <div className="flex items-start gap-1.5">
                {/* Micro doodle */}
                <div className="mt-0.5 shrink-0 opacity-50 w-3.5 h-3.5 overflow-hidden">
                    <NotebookDoodle name={doodleName} accent={accent} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-[rgba(141,123,105,0.75)]">
                            Noticed
                        </span>
                        {visibleBullets.map((bullet, i) => (
                            <span key={i} className="text-[0.68rem] text-ink-secondary leading-snug">
                                {i > 0 && <span className="mx-1 text-ink-muted/30">·</span>}
                                {bullet}
                            </span>
                        ))}
                        {!expanded && hiddenCount > 0 && (
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(true); }}
                                className="text-[8px] font-semibold text-primary/60 hover:text-primary transition-colors uppercase tracking-[0.1em]"
                            >
                                +{hiddenCount}
                            </button>
                        )}
                    </div>

                    {/* CTA inline */}
                    <div className="mt-1 flex items-center gap-1">
                        <span
                            title={nextMove}
                            className="inline-flex max-w-[7.5rem] items-center gap-1 truncate rounded-full border border-[rgba(141,123,105,0.22)] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[rgba(141,123,105,0.7)] min-[376px]:max-w-[8.5rem]"
                        >
                            {clipCompactPillByLimit(nextMove, COMPACT_PILL_LIMITS.timelineNextMove)}
                        </span>
                        <ConnectionDots entryTags={entryTags} tagCounts={tagCounts} />
                    </div>
                </div>
            </div>
        </div>
    );
}
