'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

type PrimeTimeEntry = {
    createdAt: string;
    content?: string | null;
    mood?: string | null;
};

type PrimeTimePredictionProps = {
    entries: PrimeTimeEntry[];
};

const TIME_BLOCKS = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type TimeBlock = (typeof TIME_BLOCKS)[number];

function getTimeBlock(hour: number): TimeBlock {
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 22) return 'Evening';
    return 'Night';
}

const BLOCK_LABELS: Record<TimeBlock, string> = {
    Morning: '5a–12p',
    Afternoon: '12–5p',
    Evening: '5–10p',
    Night: '10p–5a',
};

type CellData = {
    count: number;
    avgLength: number;
};

type PrimeWindow = {
    day: string;
    block: TimeBlock;
    score: number;
};

export default function PrimeTimePrediction({ entries }: PrimeTimePredictionProps) {
    const { grid, topWindows, bestNarrative } = useMemo(() => {
        // Build 7×4 grid (day × time block)
        const cells: Record<string, CellData> = {};
        let maxScore = 0;

        for (const entry of entries) {
            const d = new Date(entry.createdAt);
            const dayIdx = d.getDay();
            const block = getTimeBlock(d.getHours());
            const key = `${dayIdx}-${block}`;
            const length = entry.content?.split(/\s+/).filter(Boolean).length ?? 0;

            if (!cells[key]) cells[key] = { count: 0, avgLength: 0 };
            const cell = cells[key];
            cell.avgLength = (cell.avgLength * cell.count + length) / (cell.count + 1);
            cell.count += 1;
        }

        // Compute grid with opacity values (0-1)
        const gridData: { day: number; block: TimeBlock; count: number; opacity: number }[] = [];

        for (let day = 0; day < 7; day++) {
            for (const block of TIME_BLOCKS) {
                const key = `${day}-${block}`;
                const cell = cells[key];
                const count = cell?.count ?? 0;
                const score = count + (cell?.avgLength ?? 0) / 100;
                if (score > maxScore) maxScore = score;
                gridData.push({ day, block, count, opacity: 0 });
            }
        }

        // Normalize opacities
        if (maxScore > 0) {
            for (const cell of gridData) {
                const key = `${cell.day}-${cell.block}`;
                const data = cells[key];
                const score = (data?.count ?? 0) + (data?.avgLength ?? 0) / 100;
                cell.opacity = Math.min(score / maxScore, 1);
            }
        }

        // Find top 3 windows
        const scored: PrimeWindow[] = [];
        for (let day = 0; day < 7; day++) {
            for (const block of TIME_BLOCKS) {
                const key = `${day}-${block}`;
                const cell = cells[key];
                if (cell && cell.count >= 2) {
                    scored.push({
                        day: DAY_LABELS[day],
                        block,
                        score: cell.count + cell.avgLength / 50,
                    });
                }
            }
        }
        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 3);

        // Generate narrative
        let narrative = '';
        if (top.length > 0) {
            const best = top[0];
            narrative = `Your deepest writing tends to happen ${best.day} ${best.block.toLowerCase()}s`;
            if (top.length > 1) {
                narrative += ` and ${top[1].day} ${top[1].block.toLowerCase()}s`;
            }
        }

        return { grid: gridData, topWindows: top, bestNarrative: narrative };
    }, [entries]);

    if (entries.length < 10 || topWindows.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.28 }}
            className="notebook-card-soft rounded-2xl p-4"
        >
            <p
                className="section-label mb-3"
                style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
            >
                Your prime time
            </p>

            {/* Heat strip grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {/* Day headers */}
                {DAY_LABELS.map((day) => (
                    <div
                        key={day}
                        className="text-center text-[0.6rem] pb-0.5"
                        style={{ color: 'rgb(var(--paper-ink-muted))' }}
                    >
                        {day}
                    </div>
                ))}

                {/* Cells — render by time-block rows */}
                {TIME_BLOCKS.map((block) =>
                    DAY_LABELS.map((_, dayIdx) => {
                        const cell = grid.find((c) => c.day === dayIdx && c.block === block);
                        const opacity = cell?.opacity ?? 0;
                        const isPrime = topWindows.some(
                            (w) => w.day === DAY_LABELS[dayIdx] && w.block === block
                        );

                        return (
                            <div
                                key={`${dayIdx}-${block}`}
                                className="aspect-square rounded-md transition-colors"
                                title={`${DAY_LABELS[dayIdx]} ${BLOCK_LABELS[block]}: ${cell?.count ?? 0} notes`}
                                style={{
                                    backgroundColor: opacity > 0
                                        ? `rgba(var(--brand-strong), ${0.12 + opacity * 0.55})`
                                        : 'rgba(var(--paper-border), 0.3)',
                                    boxShadow: isPrime
                                        ? 'inset 0 0 0 1.5px rgba(var(--brand-strong), 0.6)'
                                        : undefined,
                                }}
                            />
                        );
                    })
                )}
            </div>

            {/* Time block labels (row labels) */}
            <div className="flex justify-between px-0.5 mb-3">
                {TIME_BLOCKS.map((block) => (
                    <span
                        key={block}
                        className="text-[0.58rem]"
                        style={{ color: 'rgb(var(--paper-ink-muted))' }}
                    >
                        {BLOCK_LABELS[block]}
                    </span>
                ))}
            </div>

            {/* Narrative */}
            {bestNarrative && (
                <p className="notebook-copy text-[0.82rem]" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                    {bestNarrative}
                </p>
            )}
        </motion.div>
    );
}
