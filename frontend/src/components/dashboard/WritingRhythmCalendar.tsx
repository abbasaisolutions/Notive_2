'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

type RhythmEntry = {
    createdAt: string;
    mood: string | null;
};

type WritingRhythmCalendarProps = {
    entries: RhythmEntry[];
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const BLOCK_LABELS = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;

type BlockName = (typeof BLOCK_LABELS)[number];

function getBlock(hour: number): BlockName {
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 22) return 'Evening';
    return 'Night';
}

/** Map mood to a notebook accent color for the dot. */
const MOOD_DOT_COLORS: Record<string, string> = {
    happy: 'rgba(199,220,203,0.95)',    // sage
    calm: 'rgba(191,214,221,0.95)',     // sky
    grateful: 'rgba(199,220,203,0.95)', // sage
    motivated: 'rgba(240,205,184,0.95)',// apricot
    thoughtful: 'rgba(216,199,232,0.95)', // lilac
    sad: 'rgba(216,199,232,0.7)',       // lilac muted
    anxious: 'rgba(234,216,189,0.9)',   // amber
    frustrated: 'rgba(234,216,189,0.7)',// amber muted
    tired: 'rgba(191,214,221,0.6)',     // sky muted
};
const DEFAULT_DOT_COLOR = 'rgba(var(--brand-strong), 0.55)';

type CellData = {
    count: number;
    dominantMood: string | null;
};

type Ritual = {
    day: string;
    block: BlockName;
    weeks: number;
};

export default function WritingRhythmCalendar({ entries }: WritingRhythmCalendarProps) {
    const { cells, maxCount, rituals } = useMemo(() => {
        const cellMap = new Map<string, { count: number; moods: Map<string, number> }>();
        let max = 0;

        for (const entry of entries) {
            const d = new Date(entry.createdAt);
            const dayIdx = d.getDay();
            const block = getBlock(d.getHours());
            const key = `${dayIdx}-${block}`;

            if (!cellMap.has(key)) cellMap.set(key, { count: 0, moods: new Map() });
            const cell = cellMap.get(key)!;
            cell.count += 1;
            if (cell.count > max) max = cell.count;

            if (entry.mood) {
                cell.moods.set(entry.mood, (cell.moods.get(entry.mood) ?? 0) + 1);
            }
        }

        // Build final grid data
        const result: Record<string, CellData> = {};
        for (const [key, val] of cellMap) {
            let dominantMood: string | null = null;
            let topCount = 0;
            for (const [mood, count] of val.moods) {
                if (count > topCount) {
                    topCount = count;
                    dominantMood = mood;
                }
            }
            result[key] = { count: val.count, dominantMood };
        }

        // Detect rituals: same day+block appearing 3+ weeks
        const ritualList: Ritual[] = [];
        for (const [key, val] of cellMap) {
            // Rough heuristic: if count >= 3 and entries span at least 3 weeks
            if (val.count >= 3) {
                const [dayStr, block] = key.split('-') as [string, BlockName];
                const dayIdx = parseInt(dayStr, 10);

                // Count distinct weeks for this day+block
                const weekSet = new Set<string>();
                for (const entry of entries) {
                    const d = new Date(entry.createdAt);
                    if (d.getDay() === dayIdx && getBlock(d.getHours()) === block) {
                        // Use ISO week identifier
                        const weekStart = new Date(d);
                        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                        weekSet.add(weekStart.toISOString().slice(0, 10));
                    }
                }

                if (weekSet.size >= 3) {
                    ritualList.push({
                        day: DAY_LABELS[dayIdx],
                        block,
                        weeks: weekSet.size,
                    });
                }
            }
        }
        ritualList.sort((a, b) => b.weeks - a.weeks);

        return { cells: result, maxCount: max, rituals: ritualList.slice(0, 2) };
    }, [entries]);

    if (entries.length < 5) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.28 }}
            className="notebook-card-soft rounded-2xl p-4"
        >
            <p
                className="section-label mb-3"
                style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
            >
                Writing rhythm
            </p>

            {/* 7×4 mood quilt */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
                {/* Day headers */}
                {DAY_LABELS.map((day) => (
                    <div
                        key={day}
                        className="text-center text-[0.58rem]"
                        style={{ color: 'rgb(var(--paper-ink-muted))' }}
                    >
                        {day}
                    </div>
                ))}

                {/* Cells by time-block row */}
                {BLOCK_LABELS.map((block) =>
                    DAY_LABELS.map((_, dayIdx) => {
                        const key = `${dayIdx}-${block}`;
                        const cell = cells[key];
                        const count = cell?.count ?? 0;
                        const sizeRatio = maxCount > 0 ? Math.max(count / maxCount, 0) : 0;
                        const dotSize = count > 0 ? 4 + sizeRatio * 10 : 0;
                        const color = cell?.dominantMood
                            ? MOOD_DOT_COLORS[cell.dominantMood] ?? DEFAULT_DOT_COLOR
                            : DEFAULT_DOT_COLOR;

                        return (
                            <div
                                key={key}
                                className="aspect-square flex items-center justify-center"
                                title={count > 0 ? `${DAY_LABELS[dayIdx]} ${block}: ${count} notes` : undefined}
                            >
                                {count > 0 && (
                                    <div
                                        className="rounded-full transition-all"
                                        style={{
                                            width: `${dotSize}px`,
                                            height: `${dotSize}px`,
                                            backgroundColor: color,
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Block labels */}
            <div className="flex justify-between px-1 mb-2">
                {BLOCK_LABELS.map((block) => (
                    <span
                        key={block}
                        className="text-[0.55rem]"
                        style={{ color: 'rgb(var(--paper-ink-muted))' }}
                    >
                        {block}
                    </span>
                ))}
            </div>

            {/* Ritual detection */}
            {rituals.length > 0 && (
                <p className="notebook-copy text-[0.82rem]" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                    {rituals.length === 1
                        ? `You have a ${rituals[0].day} ${rituals[0].block.toLowerCase()} ritual.`
                        : `You have a ${rituals[0].day} ${rituals[0].block.toLowerCase()} and ${rituals[1].day} ${rituals[1].block.toLowerCase()} ritual.`}
                </p>
            )}
        </motion.div>
    );
}
