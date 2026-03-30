'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

type PersonMention = {
    name: string;
    count: number;
    avgMoodWhenMentioned: number;
    sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
    recentMention: string;
    contexts: string[];
};

type PeopleMap = {
    people: PersonMention[];
    totalPeopleMentioned: number;
    socialDiversity: number;
};

type PeopleConstellationProps = {
    peopleMap: PeopleMap;
};

const SENTIMENT_COLORS: Record<string, string> = {
    positive: 'rgba(199,220,203,0.9)',   // sage
    neutral: 'rgba(220,210,199,0.8)',     // warm neutral
    negative: 'rgba(232,186,167,0.85)',   // apricot
    mixed: 'rgba(216,199,232,0.85)',      // lilac
};

const SENTIMENT_GLOW: Record<string, string> = {
    positive: 'rgba(199,220,203,0.4)',
    neutral: 'rgba(220,210,199,0.3)',
    negative: 'rgba(232,186,167,0.35)',
    mixed: 'rgba(216,199,232,0.35)',
};

/**
 * PeopleConstellation — a star map of people in the student's journal.
 * Bigger stars = more mentions. Color = sentiment. Lines connect co-occurring people.
 * "Your social universe" — identity-affirming, never surveillance.
 */
export default function PeopleConstellation({ peopleMap }: PeopleConstellationProps) {
    const { people, totalPeopleMentioned, socialDiversity } = peopleMap;

    const stars = useMemo(() => {
        const sorted = [...people].sort((a, b) => b.count - a.count).slice(0, 12);
        const maxCount = sorted[0]?.count || 1;

        // Arrange in a constellation pattern — spiral from center
        const cx = 160, cy = 100;
        return sorted.map((person, i) => {
            const angle = (i * 2.39996) + 0.5; // golden angle in radians
            const radius = 25 + i * 12 + (i > 5 ? 10 : 0);
            const size = 5 + (person.count / maxCount) * 14;

            return {
                ...person,
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle),
                size,
            };
        });
    }, [people]);

    // Find connections (people with shared contexts)
    const connections = useMemo(() => {
        const lines: Array<{ from: number; to: number }> = [];
        for (let i = 0; i < stars.length; i++) {
            for (let j = i + 1; j < stars.length; j++) {
                const shared = stars[i].contexts.filter((c) => stars[j].contexts.includes(c));
                if (shared.length > 0) lines.push({ from: i, to: j });
            }
        }
        return lines.slice(0, 10); // limit for clarity
    }, [stars]);

    if (stars.length < 2) return null;

    const diversityLabel = socialDiversity > 0.7 ? 'Wide circle'
        : socialDiversity > 0.4 ? 'Focused circle'
            : 'Close-knit';

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="notebook-card rounded-[1.75rem] p-5 overflow-hidden"
        >
            <div className="flex items-center justify-between mb-3">
                <p
                    className="section-label"
                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                >
                    Your people
                </p>
                <span className="notebook-muted text-xs">
                    {totalPeopleMentioned} people mentioned
                </span>
            </div>

            {/* ── Star map ── */}
            <div className="w-full">
                <svg viewBox="0 0 320 200" className="w-full h-auto" aria-hidden="true">
                    {/* Constellation lines */}
                    {connections.map((conn, i) => (
                        <motion.line
                            key={`${conn.from}-${conn.to}`}
                            x1={stars[conn.from].x}
                            y1={stars[conn.from].y}
                            x2={stars[conn.to].x}
                            y2={stars[conn.to].y}
                            stroke="rgba(var(--paper-border), 0.2)"
                            strokeWidth="0.8"
                            strokeDasharray="4 3"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                        />
                    ))}

                    {/* Stars */}
                    {stars.map((star, i) => (
                        <motion.g
                            key={star.name}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: i * 0.06, type: 'spring', stiffness: 200 }}
                        >
                            {/* Glow */}
                            <circle
                                cx={star.x} cy={star.y}
                                r={star.size + 4}
                                fill={SENTIMENT_GLOW[star.sentiment]}
                            />
                            {/* Star body */}
                            <circle
                                cx={star.x} cy={star.y}
                                r={star.size}
                                fill={SENTIMENT_COLORS[star.sentiment]}
                                stroke="rgba(var(--paper-ink-muted), 0.2)"
                                strokeWidth="1"
                            />
                            {/* Name */}
                            <text
                                x={star.x}
                                y={star.y + star.size + 10}
                                textAnchor="middle"
                                fill="rgb(var(--paper-ink))"
                                fontSize="8"
                                fontFamily="var(--font-serif, Georgia, serif)"
                                fontStyle="italic"
                                opacity={0.8}
                            >
                                {star.name.length > 10 ? star.name.slice(0, 9) + '…' : star.name}
                            </text>
                            {/* Mention count */}
                            <text
                                x={star.x}
                                y={star.y + 2.5}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="rgb(var(--paper-ink))"
                                fontSize={star.size > 10 ? '8' : '6'}
                                fontWeight="600"
                                opacity={0.7}
                            >
                                {star.count}
                            </text>
                        </motion.g>
                    ))}
                </svg>
            </div>

            {/* ── Legend + stats ── */}
            <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1.5">
                    {(['positive', 'neutral', 'mixed', 'negative'] as const).map((s) => (
                        <div key={s} className="flex items-center gap-0.5">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: SENTIMENT_COLORS[s] }}
                            />
                            <span className="notebook-muted text-[0.55rem]">{s}</span>
                        </div>
                    ))}
                </div>
                <div className="ml-auto">
                    <span className="notebook-muted text-[0.6rem]">
                        {diversityLabel}
                    </span>
                </div>
            </div>

            {/* ── Top people chips ── */}
            <div className="flex flex-wrap gap-1.5 mt-3">
                {stars.slice(0, 5).map((star) => (
                    <span
                        key={star.name}
                        className="notebook-chip rounded-full px-2.5 py-1 text-[0.65rem] flex items-center gap-1"
                    >
                        <span
                            className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ backgroundColor: SENTIMENT_COLORS[star.sentiment] }}
                        />
                        {star.name}
                        <span className="opacity-50">×{star.count}</span>
                    </span>
                ))}
            </div>
        </motion.section>
    );
}
