'use client';

import React from 'react';

type MoodSparklineProps = {
    entries: Array<{ mood: string | null; createdAt: string }>;
};

const RECENT_WINDOW_DAYS = 14;

const toDateKey = (value: Date) => `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;

const getRecentMoodDayCount = (entries: MoodSparklineProps['entries']) => {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (RECENT_WINDOW_DAYS - 1));

    const recentDays = new Set<string>();
    entries.forEach((entry) => {
        if (!entry.mood || MOOD_VALENCE[entry.mood] === undefined) return;
        const createdAt = new Date(entry.createdAt);
        if (createdAt < cutoff) return;
        recentDays.add(toDateKey(createdAt));
    });

    return recentDays.size;
};

const MOOD_VALENCE: Record<string, number> = {
    happy: 5, excited: 5, motivated: 5, proud: 5,
    grateful: 4, hopeful: 4, calm: 4,
    thoughtful: 3,
    tired: 2, sad: 2,
    anxious: 1, frustrated: 1,
};

const MOOD_EMOJI: Record<string, string> = {
    happy: '😊', calm: '😌', sad: '😔', anxious: '😟',
    frustrated: '😤', thoughtful: '🤔', motivated: '⚡', tired: '😴',
    grateful: '🙏', hopeful: '🌱', excited: '🎉', proud: '💪',
};

export const hasMeaningfulMoodHistory = (entries: MoodSparklineProps['entries']) =>
    getRecentMoodDayCount(entries) >= 5;

function getDayName(dayIndex: number): string {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex] ?? '';
}

export default function MoodSparkline({ entries }: MoodSparklineProps) {
    // Build 14-day mood data (most recent 14 days)
    const now = new Date();
    const dayBuckets: Array<{ dayLabel: string; valence: number | null; mood: string | null }> = [];

    for (let i = 13; i >= 0; i--) {
        const target = new Date(now);
        target.setDate(target.getDate() - i);
        const dateKey = `${target.getFullYear()}-${target.getMonth()}-${target.getDate()}`;

        const dayEntries = entries.filter((e) => {
            const d = new Date(e.createdAt);
            return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === dateKey;
        });

        const moodEntry = dayEntries.find((e) => e.mood && MOOD_VALENCE[e.mood] !== undefined);
        dayBuckets.push({
            dayLabel: getDayName(target.getDay()),
            valence: moodEntry?.mood ? (MOOD_VALENCE[moodEntry.mood] ?? 3) : null,
            mood: moodEntry?.mood ?? null,
        });
    }

    // Find dominant mood this period
    const moodCounts = new Map<string, number>();
    for (const b of dayBuckets) {
        if (b.mood) moodCounts.set(b.mood, (moodCounts.get(b.mood) ?? 0) + 1);
    }
    const dominantMood = moodCounts.size > 0
        ? [...moodCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : null;

    // Trend direction (compare first half vs second half average)
    const filledBuckets = dayBuckets.filter((b) => b.valence !== null);
    let trendLabel = '';
    if (filledBuckets.length >= 4) {
        const mid = Math.floor(filledBuckets.length / 2);
        const firstHalf = filledBuckets.slice(0, mid).reduce((s, b) => s + (b.valence ?? 0), 0) / mid;
        const secondHalf = filledBuckets.slice(mid).reduce((s, b) => s + (b.valence ?? 0), 0) / (filledBuckets.length - mid);
        const diff = secondHalf - firstHalf;
        if (diff > 0.5) trendLabel = 'trending up';
        else if (diff < -0.5) trendLabel = 'dipping';
        else trendLabel = 'steady';
    }

    // Best day (most common day-of-week with highest valence)
    const dayValences = new Map<string, number[]>();
    for (const b of dayBuckets) {
        if (b.valence !== null) {
            const existing = dayValences.get(b.dayLabel) ?? [];
            existing.push(b.valence);
            dayValences.set(b.dayLabel, existing);
        }
    }
    let bestDay = '';
    let bestAvg = 0;
    dayValences.forEach((vals, day) => {
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        if (avg > bestAvg) { bestAvg = avg; bestDay = day; }
    });

    // Top theme (from most common mood)
    const topThinkingAbout = dominantMood
        ? (dominantMood === 'anxious' ? 'what\u2019s ahead'
            : dominantMood === 'thoughtful' ? 'the bigger picture'
                : dominantMood === 'calm' ? 'finding your pace'
                    : dominantMood === 'motivated' ? 'making moves'
                        : dominantMood === 'sad' ? 'working through it'
                            : dominantMood === 'happy' ? 'what\u2019s going well'
                                : dominantMood === 'grateful' ? 'what matters'
                                    : dominantMood === 'tired' ? 'taking it slow'
                                        : 'your rhythm')
        : null;
    const moodLabel = dominantMood ? dominantMood.charAt(0).toUpperCase() + dominantMood.slice(1) : null;

    // Build SVG sparkline path
    const width = 200;
    const height = 36;
    const padding = 4;
    const points = dayBuckets.map((b, i) => ({
        x: padding + (i / 13) * (width - padding * 2),
        y: b.valence !== null
            ? padding + ((5 - b.valence) / 4) * (height - padding * 2)
            : null,
    }));

    // Connect non-null points with a smooth curve
    const validPoints = points.filter((p) => p.y !== null) as Array<{ x: number; y: number }>;
    let pathD = '';
    if (validPoints.length >= 2) {
        pathD = `M${validPoints[0].x},${validPoints[0].y}`;
        for (let i = 1; i < validPoints.length; i++) {
            const prev = validPoints[i - 1];
            const curr = validPoints[i];
            const cpx = (prev.x + curr.x) / 2;
            pathD += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
        }
    }

    if (filledBuckets.length === 0) return null;

    return (
        <div className="notebook-card-soft rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
                <p
                    className="section-label"
                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                >
                    How you&rsquo;ve been
                </p>
                {dominantMood && (
                    <span className="text-sm" title={dominantMood}>
                        {MOOD_EMOJI[dominantMood] ?? ''}
                    </span>
                )}
            </div>

            {/* Sparkline */}
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-12 w-full"
                aria-hidden="true"
            >
                {pathD && (
                    <path
                        d={pathD}
                        fill="none"
                        stroke="rgba(var(--brand-strong), 0.95)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {/* Dots for each data point */}
                {validPoints.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="3"
                        fill="rgb(var(--brand-strong))"
                    />
                ))}
            </svg>

            {/* Summary line */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                {moodLabel && trendLabel && (
                    <span className="notebook-copy text-[0.82rem]" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                        {moodLabel}{' '}
                        <span style={{ color: 'rgb(155 143 120)' }}>
                            {trendLabel === 'trending up' ? '↗' : trendLabel === 'dipping' ? '↘' : '→'}
                        </span>
                    </span>
                )}
                {bestDay && (
                    <span className="notebook-muted text-[0.82rem]" style={{ color: 'rgb(155 143 120)' }}>
                        Best day: {bestDay}
                    </span>
                )}
                {topThinkingAbout && (
                    <span className="notebook-muted text-[0.82rem]" style={{ color: 'rgb(155 143 120)' }}>
                        Thinking about {topThinkingAbout}
                    </span>
                )}
            </div>
        </div>
    );
}
