'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

type VocabularyProfile = {
    totalUniqueWords: number;
    richness: number;
    readingGradeLevel: number;
    avgWordsPerEntry: number;
    emotionWordCount: number;
    emotionWords: string[];
    rarityScore: number;
    recentNewWords: string[];
    growthRate: number;
};

type WordGardenProps = {
    vocabulary: VocabularyProfile;
};

// Map word length/rarity to organic SVG petal sizes
const PETAL_COLORS = [
    'rgba(199,220,203,0.85)',   // sage
    'rgba(216,199,232,0.8)',    // lilac
    'rgba(234,216,189,0.85)',   // amber
    'rgba(199,216,232,0.8)',    // sky
    'rgba(232,186,167,0.8)',    // apricot
    'rgba(220,210,199,0.7)',    // warm neutral
];

function hashWord(word: string): number {
    let h = 0;
    for (let i = 0; i < word.length; i++) h = ((h << 5) - h + word.charCodeAt(i)) | 0;
    return Math.abs(h);
}

/**
 * WordGarden — vocabulary growth visualized as an organic garden.
 * New words bloom as petals. Emotional words glow brighter.
 * The garden grows denser as vocabulary expands.
 */
export default function WordGarden({ vocabulary }: WordGardenProps) {
    const { recentNewWords, emotionWords, totalUniqueWords, richness, growthRate, rarityScore } = vocabulary;

    // Combine new + emotion words for the garden, max 18
    const gardenWords = useMemo(() => {
        const wordSet = new Set<string>();
        const emotionSet = new Set(emotionWords.map((w) => w.toLowerCase()));

        // Prioritize recent new words
        for (const w of recentNewWords) wordSet.add(w.toLowerCase());
        // Fill with emotion words
        for (const w of emotionWords) {
            if (wordSet.size >= 18) break;
            wordSet.add(w.toLowerCase());
        }

        return [...wordSet].slice(0, 18).map((word) => ({
            word,
            isEmotion: emotionSet.has(word),
            hash: hashWord(word),
            size: Math.min(word.length * 3.5 + 14, 52),
        }));
    }, [recentNewWords, emotionWords]);

    // Garden density based on total unique words
    const density = Math.min(totalUniqueWords / 500, 1);

    // Growth label
    const growthLabel = growthRate > 15 ? 'Blooming'
        : growthRate > 5 ? 'Growing'
            : growthRate > 0 ? 'Sprouting'
                : 'Steady';

    const rarityLabel = rarityScore > 70 ? 'Rich & rare'
        : rarityScore > 40 ? 'Expanding'
            : 'Building';

    if (gardenWords.length === 0) return null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="notebook-card rounded-[1.75rem] p-5 overflow-hidden"
        >
            <div className="flex items-center justify-between mb-4">
                <p
                    className="section-label"
                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                >
                    Word garden
                </p>
                <span className="notebook-muted text-xs">
                    {totalUniqueWords.toLocaleString()} unique words
                </span>
            </div>

            {/* ── The garden: organic petal layout ── */}
            <div className="relative w-full" style={{ minHeight: 140 }}>
                <svg viewBox="0 0 320 140" className="w-full h-auto" aria-hidden="true">
                    {/* Ground line — organic hand-drawn feel */}
                    <path
                        d="M 0 130 Q 40 125, 80 128 T 160 126 T 240 129 T 320 127"
                        fill="none"
                        stroke="rgba(var(--paper-border), 0.4)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />

                    {/* Petals / word blooms */}
                    {gardenWords.map((w, i) => {
                        const x = 20 + (i % 6) * 50 + ((w.hash % 20) - 10);
                        const row = Math.floor(i / 6);
                        const y = 110 - row * 38 - ((w.hash % 15));
                        const color = PETAL_COLORS[w.hash % PETAL_COLORS.length];
                        const r = w.size / 2.8;

                        return (
                            <motion.g
                                key={w.word}
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: i * 0.05, type: 'spring', stiffness: 180 }}
                            >
                                {/* Stem */}
                                <line
                                    x1={x} y1={y + r}
                                    x2={x + (w.hash % 3 - 1)} y2={128}
                                    stroke="rgba(var(--paper-border), 0.3)"
                                    strokeWidth="1"
                                />
                                {/* Petal circle */}
                                <circle
                                    cx={x} cy={y}
                                    r={r}
                                    fill={color}
                                    stroke={w.isEmotion ? 'rgba(216,199,232,0.6)' : 'transparent'}
                                    strokeWidth={w.isEmotion ? 2 : 0}
                                />
                                {/* Word label */}
                                <text
                                    x={x} y={y + 1}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="rgb(var(--paper-ink))"
                                    fontSize={Math.max(7, Math.min(10, 32 / Math.max(w.word.length, 3)))}
                                    fontFamily="var(--font-serif, Georgia, serif)"
                                    fontStyle="italic"
                                    opacity={0.85}
                                >
                                    {w.word.length > 9 ? w.word.slice(0, 8) + '…' : w.word}
                                </text>
                            </motion.g>
                        );
                    })}
                </svg>
            </div>

            {/* ── Stats strip ── */}
            <div className="flex items-center justify-between mt-3 gap-2">
                <div className="flex items-center gap-3">
                    <div className="text-center">
                        <p className="text-xs font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                            {growthLabel}
                        </p>
                        <p className="notebook-muted text-[0.6rem]">
                            {growthRate > 0 ? `+${growthRate}%` : 'stable'}
                        </p>
                    </div>
                    <div
                        className="h-6 w-px"
                        style={{ backgroundColor: 'rgba(var(--paper-border), 0.3)' }}
                    />
                    <div className="text-center">
                        <p className="text-xs font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                            {rarityLabel}
                        </p>
                        <p className="notebook-muted text-[0.6rem]">
                            vocabulary depth
                        </p>
                    </div>
                </div>
                {/* Richness indicator as growing bar */}
                <div className="flex items-center gap-1.5">
                    <div
                        className="h-2 rounded-full"
                        style={{
                            width: `${Math.max(20, richness * 80)}px`,
                            backgroundColor: 'rgba(199,220,203,0.7)',
                        }}
                    />
                    <span className="notebook-muted text-[0.6rem]">
                        {Math.round(richness * 100)}% diverse
                    </span>
                </div>
            </div>

            {/* ── New words callout ── */}
            {recentNewWords.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-3 notebook-card-soft rounded-xl px-3 py-2"
                >
                    <p className="text-[0.7rem] font-medium" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                        New blooms this week
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {recentNewWords.slice(0, 8).map((w) => (
                            <span
                                key={w}
                                className="notebook-chip rounded-full px-2 py-0.5 text-[0.65rem]"
                            >
                                {w}
                            </span>
                        ))}
                    </div>
                </motion.div>
            )}
        </motion.section>
    );
}
