'use client';

import React from 'react';
import { motion } from 'framer-motion';

type GrowthLanguage = {
    totalGrowthPhrases: number;
    growthDensity: number;
    topPhrases: Array<{ phrase: string; count: number }>;
    recentTrend: 'increasing' | 'stable' | 'decreasing';
    mindsetRatio: number;
    fixedMindsetCount: number;
    growthMindsetCount: number;
};

type SelfTalkProfile = {
    growthStatements: number;
    fixedStatements: number;
    ratio: number;
    label: string;
    topGrowthPhrases: string[];
    topFixedPhrases: string[];
};

type GrowthMindsetMeterProps = {
    growthLanguage: GrowthLanguage;
    selfTalk: SelfTalkProfile;
};

const TREND_LABELS: Record<string, { label: string; icon: string }> = {
    increasing: { label: 'Strengthening', icon: '↗' },
    stable: { label: 'Steady', icon: '→' },
    decreasing: { label: 'Shifting', icon: '↘' },
};

/**
 * GrowthMindsetMeter — visualizes the student's growth vs fixed mindset ratio.
 * A thermometer/gauge metaphor that fills with growth language.
 * Shows their self-talk profile label prominently.
 */
export default function GrowthMindsetMeter({ growthLanguage, selfTalk }: GrowthMindsetMeterProps) {
    const ratio = selfTalk.ratio; // 0 = all fixed, 1 = all growth
    const fillPercent = Math.round(ratio * 100);
    const trend = TREND_LABELS[growthLanguage.recentTrend] || TREND_LABELS.stable;

    // Color based on ratio
    const fillColor = ratio >= 0.7
        ? 'rgba(199,220,203,0.85)'  // sage
        : ratio >= 0.4
            ? 'rgba(234,216,189,0.85)' // amber
            : 'rgba(232,186,167,0.85)'; // apricot

    const totalStatements = selfTalk.growthStatements + selfTalk.fixedStatements;

    if (totalStatements < 3) return null;

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
                    Growth mindset
                </p>
                <span className="notebook-muted text-xs flex items-center gap-1">
                    {trend.icon} {trend.label}
                </span>
            </div>

            {/* ── Label + Gauge ── */}
            <div className="flex items-center gap-4">
                {/* Circular gauge */}
                <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
                    <svg viewBox="0 0 80 80" className="w-full h-full">
                        {/* Background track */}
                        <circle
                            cx="40" cy="40" r="32"
                            fill="none"
                            stroke="rgba(var(--paper-border), 0.2)"
                            strokeWidth="8"
                            strokeLinecap="round"
                        />
                        {/* Fill arc */}
                        <motion.circle
                            cx="40" cy="40" r="32"
                            fill="none"
                            stroke={fillColor}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 32}`}
                            strokeDashoffset={`${2 * Math.PI * 32 * (1 - ratio)}`}
                            transform="rotate(-90, 40, 40)"
                            initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - ratio) }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                        />
                        {/* Center text */}
                        <text
                            x="40" y="37"
                            textAnchor="middle"
                            fill="rgb(var(--paper-ink))"
                            fontSize="16"
                            fontWeight="700"
                        >
                            {fillPercent}%
                        </text>
                        <text
                            x="40" y="50"
                            textAnchor="middle"
                            fill="rgb(var(--paper-ink-soft))"
                            fontSize="7"
                            fontFamily="var(--font-serif, Georgia, serif)"
                        >
                            growth
                        </text>
                    </svg>
                </div>

                {/* Self-talk label */}
                <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold" style={{ color: 'rgb(var(--paper-ink))' }}>
                        {selfTalk.label}
                    </p>
                    <p className="notebook-muted text-xs mt-1">
                        {selfTalk.growthStatements} growth phrases · {selfTalk.fixedStatements} fixed phrases
                    </p>
                    {growthLanguage.growthDensity > 0 && (
                        <p className="notebook-muted text-[0.65rem] mt-0.5">
                            ~{growthLanguage.growthDensity} growth expressions per entry
                        </p>
                    )}
                </div>
            </div>

            {/* ── Growth vs Fixed bar ── */}
            <div className="mt-4">
                <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full rounded-l-full"
                        style={{ backgroundColor: 'rgba(199,220,203,0.85)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${fillPercent}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                    <motion.div
                        className="h-full rounded-r-full"
                        style={{ backgroundColor: 'rgba(232,186,167,0.6)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${100 - fillPercent}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                </div>
                <div className="flex justify-between mt-1">
                    <span className="text-[0.6rem]" style={{ color: 'rgba(120,140,120,0.8)' }}>Growth</span>
                    <span className="text-[0.6rem]" style={{ color: 'rgba(180,130,110,0.8)' }}>Fixed</span>
                </div>
            </div>

            {/* ── Top phrases ── */}
            {selfTalk.topGrowthPhrases.length > 0 && (
                <div className="mt-3">
                    <p className="notebook-muted text-[0.65rem] mb-1.5">Your growth language</p>
                    <div className="flex flex-wrap gap-1">
                        {selfTalk.topGrowthPhrases.slice(0, 5).map((phrase) => (
                            <span
                                key={phrase}
                                className="rounded-full px-2 py-0.5 text-[0.6rem]"
                                style={{
                                    backgroundColor: 'rgba(199,220,203,0.3)',
                                    color: 'rgb(var(--paper-ink))',
                                }}
                            >
                                &ldquo;{phrase}&rdquo;
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </motion.section>
    );
}
