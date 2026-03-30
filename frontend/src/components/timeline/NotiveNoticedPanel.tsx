'use client';

import React from 'react';
import { NotebookDoodle, type NotebookDoodleName, type NotebookAccentName } from '@/components/dashboard/NotebookDoodles';
import type { StorySignal } from '@/utils/story-engine';

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

function buildNextMove(
    storySignal: StorySignal | undefined,
    skills: string[] | undefined,
    lessons: string[] | undefined,
): string {
    if (storySignal?.status === 'verified') return 'Add this to your portfolio';
    if (storySignal?.status === 'ready_to_export') return 'Export to your Stories ledger';
    if ((lessons?.length ?? 0) > 0) return 'Re-read + add one sentence';
    if ((skills?.length ?? 0) > 0) return 'Name one moment this showed up';
    return 'Write one more sentence here';
}

export default function NotiveNoticedPanel({
    skills,
    lessons,
    reflection,
    storySignal,
    mood,
    notiveInsights,
}: NotiveNoticedPanelProps) {
    const nextMove = buildNextMove(storySignal, skills, lessons);

    // Use LLM insights when available, otherwise derive from static data
    const hasLlmInsights = notiveInsights && notiveInsights.length > 0;

    const primaryDoodleKey: NotiveDoodle = hasLlmInsights
        ? (notiveInsights![0].doodle || 'sprout')
        : pickFallbackDoodle(mood, storySignal, lessons);
    const { name: doodleName, accent } = DOODLE_MAP[primaryDoodleKey] ?? DOODLE_MAP['sprout'];

    return (
        <div className="mt-5 pt-4 border-t border-[rgba(141,123,105,0.18)]">
            <div className="flex items-start gap-3">
                {/* Micro doodle — clipped to 20×20 via wrapper */}
                <div className="mt-0.5 shrink-0 opacity-70 w-5 h-5 overflow-hidden">
                    <NotebookDoodle name={doodleName} accent={accent} />
                </div>

                <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(141,123,105,0.9)]">
                        Notive Noticed
                    </span>

                    <ul className="mt-1.5 space-y-1">
                        {hasLlmInsights
                            ? notiveInsights!.map((insight, i) => (
                                <li key={i} className="flex gap-1.5 text-xs text-ink-secondary leading-relaxed">
                                    <span className="mt-[3px] shrink-0 h-1 w-1 rounded-full bg-[rgba(141,123,105,0.45)]" />
                                    <span>{insight.text}</span>
                                </li>
                            ))
                            : buildFallbackBullets(skills, lessons, reflection, storySignal).map((bullet, i) => (
                                <li key={i} className="flex gap-1.5 text-xs text-ink-secondary leading-relaxed">
                                    <span className="mt-[3px] shrink-0 h-1 w-1 rounded-full bg-[rgba(141,123,105,0.45)]" />
                                    <span>{bullet}</span>
                                </li>
                            ))
                        }
                    </ul>

                    <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[rgba(141,123,105,0.28)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[rgba(141,123,105,0.85)]">
                        {nextMove}
                    </div>
                </div>
            </div>
        </div>
    );
}
