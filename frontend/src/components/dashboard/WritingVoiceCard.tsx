'use client';

import React from 'react';
import { motion } from 'framer-motion';

type WritingVoice = {
    avgSentenceLength: number;
    avgParagraphLength: number;
    readingLevel: string;
    readingGrade: number;
    questionFrequency: number;
    exclamationFrequency: number;
    firstPersonRatio: number;
    tenseDistribution: { past: number; present: number; future: number };
};

type EmotionalRange = {
    uniqueEmotions: number;
    emotionList: string[];
    rangeScore: number;
    dominantEmotion: string;
    rarestEmotion: string | null;
    emotionFrequency: Array<{ emotion: string; count: number; percentage: number }>;
    complexityScore: number;
};

type WritingVoiceCardProps = {
    writingVoice: WritingVoice;
    emotionalRange: EmotionalRange;
};

const TENSE_COLORS = {
    past: 'rgba(216,199,232,0.85)',    // lilac
    present: 'rgba(199,220,203,0.85)', // sage
    future: 'rgba(199,216,232,0.85)',  // sky
};

const TENSE_COPY = {
    past: {
        label: 'Past',
        helper: 'Replaying what already happened',
    },
    present: {
        label: 'Present',
        helper: 'Describing what feels true right now',
    },
    future: {
        label: 'Future',
        helper: 'Thinking ahead or imagining what comes next',
    },
} as const;

/**
 * WritingVoiceCard — combined writing style + emotional fingerprint DNA card.
 * Shows tense distribution as a stacked bar, reading level, emotional range as
 * a compact petal/bubble chart, and voice characteristics.
 */
export default function WritingVoiceCard({ writingVoice, emotionalRange }: WritingVoiceCardProps) {
    const { readingLevel, readingGrade, questionFrequency, firstPersonRatio, tenseDistribution } = writingVoice;
    const { uniqueEmotions, dominantEmotion, rarestEmotion, complexityScore, emotionFrequency } = emotionalRange;
    const tenseOrder = ['past', 'present', 'future'] as const;
    const dominantTense = tenseOrder.reduce((current, tense) => (
        tenseDistribution[tense] > tenseDistribution[current] ? tense : current
    ), 'present' as (typeof tenseOrder)[number]);

    // Voice character description
    const voiceLabel = questionFrequency > 1.5
        ? 'Curious explorer'
        : firstPersonRatio > 0.08
            ? 'Deep self-reflector'
            : tenseDistribution.future > 30
                ? 'Future thinker'
                : tenseDistribution.past > 50
                    ? 'Storyteller'
                    : 'Present observer';

    const complexityLabel = complexityScore >= 70 ? 'Nuanced'
        : complexityScore >= 40 ? 'Developing'
            : 'Building';

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="notebook-card rounded-[1.75rem] p-5"
        >
            <div className="flex items-center justify-between mb-3">
                <p
                    className="section-label"
                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                >
                    Your writing voice
                </p>
                <span className="notebook-chip rounded-full px-2.5 py-1 text-[0.65rem]">
                    {voiceLabel}
                </span>
            </div>

            {/* ── Time lens: clearer split view ── */}
            <div className="mb-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="notebook-muted text-[0.65rem]">Time lens</p>
                    <span className="notebook-chip rounded-full px-2 py-0.5 text-[0.55rem]">
                        Mostly {TENSE_COPY[dominantTense].label.toLowerCase()}-focused
                    </span>
                </div>
                <p className="notebook-muted text-[0.58rem] leading-5">
                    This is a split of where your writing leans, not a score. The three bars together make up 100%.
                </p>
                <div className="mt-3 space-y-2.5">
                    {tenseOrder.map((tense, index) => (
                        <div key={tense} className="rounded-[1rem] bg-[rgba(var(--paper-border),0.08)] px-3 py-2.5">
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[0.72rem] font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                                        {TENSE_COPY[tense].label}
                                    </p>
                                    <p className="text-[0.55rem] leading-4" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                                        {TENSE_COPY[tense].helper}
                                    </p>
                                </div>
                                <span className="text-[0.68rem] font-semibold tabular-nums" style={{ color: 'rgb(var(--paper-ink))' }}>
                                    {tenseDistribution[tense]}%
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[rgba(var(--paper-border),0.18)]">
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: TENSE_COLORS[tense] }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${tenseDistribution[tense]}%` }}
                                    transition={{ delay: index * 0.08, duration: 0.55, ease: 'easeOut' }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Emotional Range mini-chart ── */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                    <p className="notebook-muted text-[0.65rem]">Emotional palette</p>
                    <span className="notebook-muted text-[0.6rem]">
                        {uniqueEmotions} unique · {complexityLabel}
                    </span>
                </div>
                <div className="flex items-end gap-0.5 h-10">
                    {emotionFrequency.slice(0, 10).map((ef, i) => (
                        <motion.div
                            key={ef.emotion}
                            className="rounded-t-sm flex-1"
                            style={{
                                backgroundColor: i === 0
                                    ? 'rgba(199,220,203,0.85)'
                                    : i < 3
                                        ? 'rgba(216,199,232,0.7)'
                                        : 'rgba(var(--paper-border), 0.3)',
                            }}
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(15, ef.percentage)}%` }}
                            transition={{ delay: i * 0.04, duration: 0.5 }}
                            title={`${ef.emotion}: ${ef.percentage}%`}
                        />
                    ))}
                </div>
                <div className="flex justify-between mt-1">
                    <span className="text-[0.55rem]" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                        {dominantEmotion}
                    </span>
                    {rarestEmotion && (
                        <span className="text-[0.55rem]" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                            rarest: {rarestEmotion}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Quick stats grid ── */}
            <div className="grid grid-cols-3 gap-2">
                <div className="notebook-card-soft rounded-xl px-2 py-2 text-center">
                    <p className="text-xs font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                        {readingLevel}
                    </p>
                    <p className="notebook-muted text-[0.55rem]">
                        Grade {readingGrade}
                    </p>
                </div>
                <div className="notebook-card-soft rounded-xl px-2 py-2 text-center">
                    <p className="text-xs font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                        {questionFrequency}/entry
                    </p>
                    <p className="notebook-muted text-[0.55rem]">
                        questions asked
                    </p>
                </div>
                <div className="notebook-card-soft rounded-xl px-2 py-2 text-center">
                    <p className="text-xs font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                        {Math.round(firstPersonRatio * 100)}%
                    </p>
                    <p className="notebook-muted text-[0.55rem]">
                        uses I / me
                    </p>
                </div>
            </div>
        </motion.section>
    );
}
