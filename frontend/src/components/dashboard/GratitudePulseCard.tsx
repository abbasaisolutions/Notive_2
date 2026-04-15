'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

type GratitudePulse = {
    totalExpressions: number;
    avgPerWeek: number;
    streak: number;
    topThemes: string[];
    recentTrend: 'growing' | 'stable' | 'fading';
    depthScore: number;
};

type GratitudePulseCardProps = {
    gratitude: GratitudePulse;
};

const TREND_INFO: Record<string, { label: string; color: string }> = {
    growing: { label: 'Growing', color: 'rgba(199,220,203,0.85)' },
    stable: { label: 'Steady', color: 'rgba(234,216,189,0.85)' },
    fading: { label: 'Fading', color: 'rgba(232,186,167,0.7)' },
};

function hashValue(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

/**
 * GratitudePulseCard — heartbeat-style visualization of gratitude expressions.
 * Shows streak, depth, and trending themes.
 */
export default function GratitudePulseCard({ gratitude }: GratitudePulseCardProps) {
    const { totalExpressions, avgPerWeek, streak, topThemes, recentTrend, depthScore } = gratitude;

    const trend = TREND_INFO[recentTrend] || TREND_INFO.stable;

    // Build a deterministic heartbeat from the actual gratitude profile so
    // the visual feels organic without changing shape on every render.
    const pulsePoints = useMemo(() => {
        const seed = hashValue([
            totalExpressions,
            avgPerWeek.toFixed(1),
            streak,
            depthScore,
            recentTrend,
            topThemes.join('|'),
        ].join(':'));

        return Array.from({ length: 12 }, (_, i) => {
            const x = (i / 11) * 280 + 20;
            const wave = (seed + i * 17) % 9;
            const isPeak = i % 4 === 1 || i % 6 === 4;
            const base = 43 - (wave % 5);
            const y = isPeak
                ? 14 + (wave % 7)
                : base + ((i + seed) % 4);
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(0)} ${y.toFixed(0)}`;
        }).join(' ');
    }, [avgPerWeek, depthScore, recentTrend, streak, topThemes, totalExpressions]);

    const depthLabel = depthScore >= 70 ? 'Deep & specific'
        : depthScore >= 40 ? 'Getting specific'
            : 'General';

    if (totalExpressions < 2) return null;

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
                    Gratitude pulse
                </p>
                <div className="flex items-center gap-1.5">
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: trend.color }}
                    />
                    <span className="notebook-muted text-xs">{trend.label}</span>
                </div>
            </div>

            {/* ── Pulse line ── */}
            <div className="w-full">
                <svg viewBox="0 0 320 60" className="w-full h-auto" aria-hidden="true">
                    <motion.path
                        d={pulsePoints}
                        fill="none"
                        stroke={trend.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                    {/* Pulse glow */}
                    <motion.path
                        d={pulsePoints}
                        fill="none"
                        stroke={trend.color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        opacity={0.15}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                </svg>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="notebook-card-soft rounded-xl px-3 py-2 text-center">
                    <p className="text-sm font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                        {totalExpressions}
                    </p>
                    <p className="notebook-muted text-[0.6rem]">expressions</p>
                </div>
                <div className="notebook-card-soft rounded-xl px-3 py-2 text-center">
                    <p className="text-sm font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                        {avgPerWeek}/wk
                    </p>
                    <p className="notebook-muted text-[0.6rem]">frequency</p>
                </div>
                <div className="notebook-card-soft rounded-xl px-3 py-2 text-center">
                    <p className="text-sm font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                        {streak > 0 ? `${streak}d` : '—'}
                    </p>
                    <p className="notebook-muted text-[0.6rem]">streak</p>
                </div>
            </div>

            {/* ── Depth + themes ── */}
            <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                    {/* Depth bar */}
                    <div className="flex items-center gap-1.5">
                        <div
                            className="h-1.5 rounded-full"
                            style={{
                                width: `${Math.max(16, depthScore * 0.6)}px`,
                                backgroundColor: trend.color,
                            }}
                        />
                        <span className="notebook-muted text-[0.6rem]">{depthLabel}</span>
                    </div>
                </div>
            </div>

            {topThemes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {topThemes.slice(0, 4).map((theme) => (
                        <span
                            key={theme}
                            className="notebook-chip rounded-full px-2 py-0.5 text-[0.6rem]"
                        >
                            {theme}
                        </span>
                    ))}
                </div>
            )}
        </motion.section>
    );
}
