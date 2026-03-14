'use client';

import React, { useId, useMemo } from 'react';
import { getMoodColor, getMoodEmoji, normalizeMood } from '@/constants/moods';
import { FiTrendingUp } from 'react-icons/fi';

interface MoodRiverProps {
    data: { date: string; mood: string; score: number }[];
}

const formatShortDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
    return parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
};

const formatMoodLabel = (mood: string) => mood.charAt(0).toUpperCase() + mood.slice(1);

export default function MoodRiver({ data }: MoodRiverProps) {
    const chartId = useId().replace(/:/g, '');
    const normalizedData = useMemo(
        () =>
            data.map((item) => ({
                ...item,
                mood: normalizeMood(item.mood) || 'neutral',
            })),
        [data]
    );

    if (normalizedData.length === 0) {
        return (
            <div className="glass-card p-6 rounded-2xl text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03]">
                    <FiTrendingUp size={24} className="text-ink-secondary" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-white">Mood River</h3>
                <p className="mt-1 text-sm text-ink-secondary">Add entries to reveal your emotional trajectory.</p>
            </div>
        );
    }

    const averageScore = Number(
        (normalizedData.reduce((sum, item) => sum + item.score, 0) / normalizedData.length).toFixed(1)
    );
    const scoreDelta = normalizedData.length > 1
        ? Number((normalizedData[normalizedData.length - 1].score - normalizedData[0].score).toFixed(1))
        : 0;

    let trendLabel = 'Stable';
    let trendClass = 'border-white/20 bg-white/10 text-ink-secondary';
    if (scoreDelta > 0.3) {
        trendLabel = 'Rising';
        trendClass = 'border-white/15 bg-white/[0.04] text-white';
    } else if (scoreDelta < -0.3) {
        trendLabel = 'Falling';
        trendClass = 'border-zinc-400/35 bg-zinc-500/12 text-zinc-200';
    }

    const moodCounts = new Map<string, number>();
    for (const item of normalizedData) {
        moodCounts.set(item.mood, (moodCounts.get(item.mood) || 0) + 1);
    }
    const dominantMood = [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
    const legendMoods = Array.from(new Set(normalizedData.map((item) => item.mood))).slice(0, 5);

    const maxScore = 10;
    const height = 120;
    const width = 100;

    const points = normalizedData.map((d, i) => ({
        x: (i / (normalizedData.length - 1 || 1)) * width,
        y: ((maxScore - d.score) / maxScore) * height,
        color: getMoodColor(d.mood),
        mood: d.mood,
        date: d.date,
    }));

    const createPath = (pts: typeof points): string => {
        if (pts.length < 2) return '';

        let path = `M ${pts[0].x} ${pts[0].y}`;

        for (let i = 1; i < pts.length; i++) {
            const prev = pts[i - 1];
            const curr = pts[i];
            const cpx = (prev.x + curr.x) / 2;

            path += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
        }

        return path;
    };

    const createAreaPath = (pts: typeof points): string => {
        if (pts.length < 2) return '';

        const linePath = createPath(pts);
        if (!linePath) return '';
        const lastPoint = pts[pts.length - 1];
        const firstPoint = pts[0];

        return `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;
    };

    const linePath = createPath(points);
    const areaPath = createAreaPath(points);
    const lineGradientId = `mood-line-${chartId}`;

    return (
        <div className="glass-card p-6 rounded-2xl">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-white">Mood River</h3>
                    <p className="text-xs text-ink-muted">Emotional flow across recent entries</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${trendClass}`}>
                    {trendLabel}
                </span>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Avg Score</p>
                    <p className="text-lg font-semibold text-white">{averageScore}/10</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Change</p>
                    <p className={`text-lg font-semibold ${scoreDelta >= 0 ? 'text-ink-secondary' : 'text-zinc-300'}`}>
                        {scoreDelta >= 0 ? '+' : ''}{scoreDelta}
                    </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Dominant</p>
                    <p className="text-lg font-semibold text-white">
                        {getMoodEmoji(dominantMood)} {formatMoodLabel(dominantMood)}
                    </p>
                </div>
            </div>

            <div className="relative" style={{ height: `${height + 30}px` }}>
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full"
                    preserveAspectRatio="none"
                >
                    <defs>
                        <linearGradient id={lineGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                            {points.map((p, i) => (
                                <stop
                                    key={i}
                                    offset={`${(i / (points.length - 1 || 1)) * 100}%`}
                                    stopColor={p.color}
                                />
                            ))}
                        </linearGradient>
                    </defs>

                    {[0, height / 2, height].map((y) => (
                        <line
                            key={`grid-${y}`}
                            x1="0"
                            y1={y}
                            x2={width}
                            y2={y}
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="0.4"
                            strokeDasharray="1.5 2"
                        />
                    ))}

                    {areaPath && (
                        <path
                            d={areaPath}
                            fill={`url(#${lineGradientId})`}
                            fillOpacity="0.18"
                        />
                    )}

                    {linePath && (
                        <path
                            d={linePath}
                            fill="none"
                            stroke={`url(#${lineGradientId})`}
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    )}

                    {points.map((p, i) => (
                        <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill={p.color}
                            className="transition-all hover:r-5"
                        >
                            <title>{`${formatShortDate(p.date)}: ${formatMoodLabel(p.mood)} (${normalizedData[i].score}/10)`}</title>
                        </circle>
                    ))}
                </svg>

                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-ink-muted">
                    <span>{formatShortDate(points[0]?.date || '')}</span>
                    <span>{formatShortDate(points[points.length - 1]?.date || '')}</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
                {legendMoods.map((mood) => (
                    <span
                        key={mood}
                        className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary"
                    >
                        <span style={{ color: getMoodColor(mood) }}>{getMoodEmoji(mood)}</span>
                        <span>{formatMoodLabel(mood)}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}

