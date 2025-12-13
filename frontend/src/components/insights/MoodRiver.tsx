'use client';

import React from 'react';

interface MoodRiverProps {
    data: { date: string; mood: string; score: number }[];
}

const moodColors: Record<string, string> = {
    happy: '#22c55e',
    grateful: '#ec4899',
    motivated: '#8b5cf6',
    hopeful: '#fbbf24',
    calm: '#06b6d4',
    thoughtful: '#8b5cf6',
    neutral: '#6b7280',
    tired: '#64748b',
    anxious: '#f59e0b',
    sad: '#3b82f6',
    angry: '#ef4444',
};

export default function MoodRiver({ data }: MoodRiverProps) {
    if (data.length === 0) {
        return (
            <div className="glass-card p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4">Mood River</h3>
                <p className="text-slate-400">Start journaling to see your mood flow!</p>
            </div>
        );
    }

    const maxScore = 10;
    const height = 120;
    const width = 100;

    // Create smooth path
    const points = data.map((d, i) => ({
        x: (i / (data.length - 1 || 1)) * width,
        y: ((maxScore - d.score) / maxScore) * height,
        color: moodColors[d.mood] || moodColors.neutral,
        mood: d.mood,
        date: d.date,
    }));

    // Create SVG path with smooth curves
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

    // Create filled area path
    const createAreaPath = (pts: typeof points): string => {
        if (pts.length < 2) return '';

        const linePath = createPath(pts);
        const lastPoint = pts[pts.length - 1];
        const firstPoint = pts[0];

        return `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;
    };

    return (
        <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Mood River</h3>

            <div className="relative" style={{ height: `${height + 30}px` }}>
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full"
                    preserveAspectRatio="none"
                >
                    {/* Gradient definition */}
                    <defs>
                        <linearGradient id="moodGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            {points.map((p, i) => (
                                <stop
                                    key={i}
                                    offset={`${(i / (points.length - 1 || 1)) * 100}%`}
                                    stopColor={p.color}
                                />
                            ))}
                        </linearGradient>
                        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="url(#moodGradient)" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="url(#moodGradient)" stopOpacity="0.05" />
                        </linearGradient>
                    </defs>

                    {/* Filled area */}
                    <path
                        d={createAreaPath(points)}
                        fill="url(#areaGradient)"
                    />

                    {/* Line */}
                    <path
                        d={createPath(points)}
                        fill="none"
                        stroke="url(#moodGradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />

                    {/* Points */}
                    {points.map((p, i) => (
                        <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            fill={p.color}
                            className="transition-all hover:r-5"
                        >
                            <title>{`${p.date}: ${p.mood}`}</title>
                        </circle>
                    ))}
                </svg>

                {/* Labels */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-500">
                    <span>{points[0]?.date}</span>
                    <span>{points[points.length - 1]?.date}</span>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-4">
                {Array.from(new Set(data.map(d => d.mood))).slice(0, 5).map((mood) => (
                    <div key={mood} className="flex items-center gap-1 text-xs text-slate-400">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: moodColors[mood] || moodColors.neutral }}
                        />
                        <span className="capitalize">{mood}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
