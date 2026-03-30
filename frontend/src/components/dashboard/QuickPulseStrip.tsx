'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';

type QuickPulseEntry = {
    mood: string | null;
    createdAt: string;
    content?: string | null;
};

type QuickPulseStripProps = {
    entries: QuickPulseEntry[];
    streak?: number | null;
    totalWords?: number | null;
};

/** Count unique moods used in the last 30 entries. */
function countUniqueMoods(entries: QuickPulseEntry[]): number {
    const moods = new Set<string>();
    for (const e of entries.slice(0, 30)) {
        if (e.mood) moods.add(e.mood);
    }
    return moods.size;
}

/** Sum approximate words written this week. */
function wordsThisWeek(entries: QuickPulseEntry[]): number {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    let words = 0;
    for (const e of entries) {
        if (new Date(e.createdAt) >= weekStart) {
            const text = e.content || '';
            words += text.split(/\s+/).filter(Boolean).length;
        }
    }
    return words;
}

type PulsePill = {
    label: string;
    value: string;
    detail: string;
};

export default function QuickPulseStrip({ entries, streak, totalWords }: QuickPulseStripProps) {
    const uniqueMoods = useMemo(() => countUniqueMoods(entries), [entries]);
    const weekWords = useMemo(() => wordsThisWeek(entries), [entries]);

    const pills = useMemo<PulsePill[]>(() => {
        const result: PulsePill[] = [];

        if (typeof streak === 'number' && streak > 0) {
            result.push({
                label: 'Streak',
                value: `${streak}d`,
                detail: streak === 1 ? '1 day running' : `${streak} days running`,
            });
        }

        result.push({
            label: 'Emotional range',
            value: String(uniqueMoods),
            detail: uniqueMoods === 1
                ? '1 mood named recently'
                : `${uniqueMoods} moods named recently`,
        });

        result.push({
            label: 'Notes',
            value: String(entries.length),
            detail: entries.length === 1 ? '1 journal note' : `${entries.length} journal notes`,
        });

        if (weekWords > 0) {
            result.push({
                label: 'This week',
                value: weekWords >= 1000 ? `${(weekWords / 1000).toFixed(1)}k` : String(weekWords),
                detail: `${weekWords} words this week`,
            });
        } else if (typeof totalWords === 'number' && totalWords > 0) {
            result.push({
                label: 'Total words',
                value: totalWords >= 1000 ? `${(totalWords / 1000).toFixed(1)}k` : String(totalWords),
                detail: `${totalWords} words written`,
            });
        }

        return result;
    }, [entries, streak, totalWords, uniqueMoods, weekWords]);

    const overview = useMemo(() => {
        if ((streak ?? 0) >= 4) {
            return 'Your writing rhythm stayed alive this week.';
        }
        if (entries.length >= 5) {
            return 'Your notebook is starting to show real shape.';
        }
        if (uniqueMoods >= 3) {
            return 'You are naming more range, not less.';
        }
        if (entries.length > 0) {
            return 'A few honest notes already count as momentum.';
        }
        return 'Small wins start with one note.';
    }, [entries.length, streak, uniqueMoods]);

    const detail = useMemo(() => {
        if (weekWords > 0) {
            return `You put down ${weekWords} words this week, which is enough for Notive to start finding a calmer thread.`;
        }
        if (entries.length > 0) {
            return `You have ${entries.length} ${entries.length === 1 ? 'note' : 'notes'} in the notebook so far.`;
        }
        return 'Once a few notes land here, this space turns them into gentle signals instead of scoreboard pressure.';
    }, [entries.length, weekWords]);

    if (pills.length === 0) return null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="notebook-card rounded-[1.75rem] p-5"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="max-w-2xl">
                    <p className="section-label">Small wins</p>
                    <h3 className="notebook-title mt-2 text-[1.25rem] leading-[1.18]">
                        {overview}
                    </h3>
                    <p className="notebook-copy mt-3 text-sm leading-7">
                        {detail}
                    </p>
                </div>
                <NotebookDoodle name="sprout" accent="sage" className="hidden shrink-0 sm:block" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                {pills.map((pill, i) => (
                    <motion.div
                        key={pill.label}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * i, duration: 0.24 }}
                        className="notebook-card-soft rounded-[1.3rem] px-4 py-3"
                        title={pill.detail}
                    >
                        <p className="section-label">{pill.label}</p>
                        <p
                            className="mt-2 text-xl font-semibold tabular-nums leading-none"
                            style={{ color: 'rgb(var(--paper-ink))' }}
                        >
                            {pill.value}
                        </p>
                        <p className="notebook-muted mt-2 text-xs leading-6">
                            {pill.detail}
                        </p>
                    </motion.div>
                ))}
            </div>
        </motion.section>
    );
}
