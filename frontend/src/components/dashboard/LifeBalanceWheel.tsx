'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { normalizeLifeBalanceAreaKey } from './life-balance';

type LifeBalanceArea = {
    area: string;
    score: number;
    entryCount: number;
    dominantMood: string | null;
    recentTrend: 'up' | 'stable' | 'down';
};

type LifeBalance = {
    areas: LifeBalanceArea[];
    balanceScore: number;
    dominantArea: string;
    neglectedArea: string | null;
};

type LifeBalanceWheelProps = {
    lifeBalance: LifeBalance;
};

const AREA_ICONS: Record<string, string> = {
    school: '📚', friends: '👯', family: '🏠', self: '🧘',
    hobbies: '🎨', career: '💼', romance: '💝', health: '🏃',
};

const AREA_COLORS: Record<string, string> = {
    school: 'rgba(199,216,232,0.85)',    // sky
    friends: 'rgba(216,199,232,0.85)',    // lilac
    family: 'rgba(234,216,189,0.85)',     // amber
    self: 'rgba(199,220,203,0.85)',       // sage
    hobbies: 'rgba(232,186,167,0.85)',    // apricot
    career: 'rgba(199,216,232,0.7)',      // sky-soft
    romance: 'rgba(216,199,232,0.7)',     // lilac-soft
    health: 'rgba(199,220,203,0.7)',      // sage-soft
};

const TREND_ARROWS: Record<string, string> = { up: '↑', stable: '·', down: '↓' };

/**
 * LifeBalanceWheel — organic radar/petal chart showing life area coverage.
 * Hand-drawn SVG feel, notebook aesthetic.
 */
export default function LifeBalanceWheel({ lifeBalance }: LifeBalanceWheelProps) {
    const { areas, balanceScore, dominantArea, neglectedArea } = lifeBalance;

    const validAreas = useMemo(() =>
        areas.filter((a) => a.entryCount > 0).slice(0, 8),
        [areas]
    );

    if (validAreas.length < 3) return null;

    const dominantAreaKey = normalizeLifeBalanceAreaKey(dominantArea);
    const neglectedAreaKey = normalizeLifeBalanceAreaKey(neglectedArea);

    const cx = 130, cy = 115, maxR = 85;
    const n = validAreas.length;
    const angleStep = (2 * Math.PI) / n;

    // Build polygon points
    const points = validAreas.map((area, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const r = maxR * Math.max(area.score, 0.12);
        return {
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
            labelX: cx + (maxR + 16) * Math.cos(angle),
            labelY: cy + (maxR + 16) * Math.sin(angle),
            area,
        };
    });

    const polygonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';

    // Background guide rings
    const rings = [0.33, 0.66, 1.0];

    // Balance label
    const balanceLabel = balanceScore >= 75 ? 'Well-rounded'
        : balanceScore >= 50 ? 'Balanced'
            : balanceScore >= 30 ? 'Focused'
                : 'Narrow focus';

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="notebook-card rounded-[1.75rem] p-5"
        >
            <div className="flex items-center justify-between mb-2">
                <p
                    className="section-label"
                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                >
                    Life balance
                </p>
                <span className="notebook-muted text-xs">
                    {balanceLabel} · {balanceScore}/100
                </span>
            </div>

            {/* ── SVG Radar ── */}
            <div className="w-full flex justify-center">
                <svg viewBox="0 0 260 240" className="w-full max-w-[280px] h-auto" aria-hidden="true">
                    {/* Guide rings */}
                    {rings.map((frac) => (
                        <circle
                            key={frac}
                            cx={cx} cy={cy} r={maxR * frac}
                            fill="none"
                            stroke="rgba(var(--paper-border), 0.2)"
                            strokeWidth="0.8"
                            strokeDasharray="3 3"
                        />
                    ))}

                    {/* Axis lines */}
                    {validAreas.map((_, i) => {
                        const angle = -Math.PI / 2 + i * angleStep;
                        return (
                            <line
                                key={i}
                                x1={cx} y1={cy}
                                x2={cx + maxR * Math.cos(angle)}
                                y2={cy + maxR * Math.sin(angle)}
                                stroke="rgba(var(--paper-border), 0.15)"
                                strokeWidth="0.8"
                            />
                        );
                    })}

                    {/* Filled shape */}
                    <motion.path
                        d={polygonPath}
                        fill="rgba(199,220,203,0.25)"
                        stroke="rgba(199,220,203,0.7)"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, type: 'spring' }}
                        style={{ transformOrigin: `${cx}px ${cy}px` }}
                    />

                    {/* Data points + labels */}
                    {points.map((p, i) => {
                        const areaKey = normalizeLifeBalanceAreaKey(p.area.area);

                        return (
                            <g key={p.area.area}>
                            {/* Dot */}
                            <motion.circle
                                cx={p.x} cy={p.y} r={4.5}
                                fill={AREA_COLORS[areaKey] || 'rgba(199,220,203,0.85)'}
                                stroke="rgba(var(--paper-ink-muted), 0.3)"
                                strokeWidth="1.5"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.06 }}
                            />
                            {/* Label */}
                            <text
                                x={p.labelX}
                                y={p.labelY}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="rgb(var(--paper-ink))"
                                fontSize="8.5"
                                fontFamily="var(--font-serif, Georgia, serif)"
                            >
                                {AREA_ICONS[areaKey] || '○'} {p.area.area}
                            </text>
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* ── Insights strip ── */}
            <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="notebook-card-soft rounded-xl px-3 py-2">
                    <p className="notebook-muted text-[0.65rem]">Most present</p>
                    <p className="text-xs font-medium" style={{ color: 'rgb(var(--paper-ink))' }}>
                        {AREA_ICONS[dominantAreaKey] || '○'} {dominantArea}
                    </p>
                </div>
                {neglectedArea && (
                    <div className="notebook-card-soft rounded-xl px-3 py-2">
                        <p className="notebook-muted text-[0.65rem]">Less present</p>
                        <p className="text-xs font-medium" style={{ color: 'rgb(var(--paper-ink))' }}>
                            {AREA_ICONS[neglectedAreaKey] || '○'} {neglectedArea}
                        </p>
                    </div>
                )}
            </div>

            {/* ── Trend chips ── */}
            <div className="flex flex-wrap gap-1.5 mt-3">
                {validAreas.filter((a) => a.recentTrend !== 'stable').map((a) => (
                    <span
                        key={a.area}
                        className="notebook-chip rounded-full px-2 py-0.5 text-[0.65rem] flex items-center gap-0.5"
                    >
                        {a.area} {TREND_ARROWS[a.recentTrend]}
                    </span>
                ))}
            </div>
        </motion.section>
    );
}
