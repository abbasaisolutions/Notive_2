'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

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

function getWeekStart(ref?: Date): Date {
    const d = ref ? new Date(ref) : new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Sum approximate words written this week. */
function wordsThisWeek(entries: QuickPulseEntry[]): number {
    const weekStart = getWeekStart();
    let words = 0;
    for (const e of entries) {
        if (new Date(e.createdAt) >= weekStart) {
            const text = e.content || '';
            words += text.split(/\s+/).filter(Boolean).length;
        }
    }
    return words;
}

function wordsLastWeek(entries: QuickPulseEntry[]): number {
    const thisWeekStart = getWeekStart();
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    let w = 0;
    for (const e of entries) {
        const d = new Date(e.createdAt);
        if (d >= lastWeekStart && d < thisWeekStart)
            w += (e.content || '').split(/\s+/).filter(Boolean).length;
    }
    return w;
}

function entriesThisWeek(entries: QuickPulseEntry[]): number {
    const ws = getWeekStart();
    return entries.filter(e => new Date(e.createdAt) >= ws).length;
}

function entriesLastWeek(entries: QuickPulseEntry[]): number {
    const thisWS = getWeekStart();
    const lastWS = new Date(thisWS);
    lastWS.setDate(lastWS.getDate() - 7);
    return entries.filter(e => { const d = new Date(e.createdAt); return d >= lastWS && d < thisWS; }).length;
}

type PulsePill = {
    label: string;
    value: string;
    detail: string;
    accent: string;
    meter: boolean[];
    delta?: { text: string; positive: boolean } | null;
};

export default function QuickPulseStrip({ entries, streak, totalWords }: QuickPulseStripProps) {
    const uniqueMoods = useMemo(() => countUniqueMoods(entries), [entries]);
    const weekWords = useMemo(() => wordsThisWeek(entries), [entries]);
    const lastWeekW = useMemo(() => wordsLastWeek(entries), [entries]);
    const thisWeekEntries = useMemo(() => entriesThisWeek(entries), [entries]);
    const lastWeekEntries = useMemo(() => entriesLastWeek(entries), [entries]);

    const pills = useMemo<PulsePill[]>(() => {
        const result: PulsePill[] = [];

        if (typeof streak === 'number' && streak > 0) {
            result.push({
                label: 'Streak',
                value: `${streak}d`,
                detail: streak === 1 ? '1 day running' : `${streak} days running`,
                accent: 'rgba(138,154,111,0.9)',
                meter: Array.from({ length: 5 }, (_, index) => index < Math.min(5, streak)),
                delta: streak >= 7 ? { text: '🔥 keep going', positive: true } : streak >= 3 ? { text: 'building momentum', positive: true } : null,
            });
        }

        result.push({
            label: 'Range',
            value: String(uniqueMoods),
            detail: uniqueMoods === 1
                ? '1 mood named recently'
                : `${uniqueMoods} moods named recently`,
            accent: 'rgba(216,199,232,0.95)',
            meter: Array.from({ length: 4 }, (_, index) => index < Math.min(4, Math.max(uniqueMoods, entries.length > 0 ? 1 : 0))),
        });

        result.push({
            label: 'Notes',
            value: thisWeekEntries > 0 ? String(thisWeekEntries) : String(entries.length),
            detail: thisWeekEntries > 0 ? `${thisWeekEntries} ${thisWeekEntries === 1 ? 'note' : 'notes'} this week` : (entries.length === 1 ? '1 journal note' : `${entries.length} journal notes`),
            accent: 'rgba(191,214,221,0.95)',
            meter: Array.from({ length: 5 }, (_, index) => index < Math.min(5, Math.max(entries.length > 0 ? 1 : 0, Math.round(entries.length / 3)))),
            delta: lastWeekEntries > 0
                ? { text: thisWeekEntries > lastWeekEntries ? `↑${thisWeekEntries - lastWeekEntries} vs last week` : thisWeekEntries < lastWeekEntries ? `↓${lastWeekEntries - thisWeekEntries} vs last week` : 'Same as last week', positive: thisWeekEntries >= lastWeekEntries }
                : null,
        });

        if (weekWords > 0) {
            result.push({
                label: 'This week',
                value: weekWords >= 1000 ? `${(weekWords / 1000).toFixed(1)}k` : String(weekWords),
                detail: `${weekWords} words this week`,
                accent: 'rgba(234,216,189,0.95)',
                meter: Array.from({ length: 5 }, (_, index) => index < Math.min(5, Math.max(1, Math.round(weekWords / 240)))),
                delta: lastWeekW > 0
                    ? { text: weekWords > lastWeekW ? `↑${(weekWords - lastWeekW).toLocaleString()}w vs last week` : weekWords < lastWeekW ? `↓${(lastWeekW - weekWords).toLocaleString()}w` : 'Same as last week', positive: weekWords >= lastWeekW }
                    : null,
            });
        } else if (typeof totalWords === 'number' && totalWords > 0) {
            result.push({
                label: 'Total words',
                value: totalWords >= 1000 ? `${(totalWords / 1000).toFixed(1)}k` : String(totalWords),
                detail: `${totalWords} words written`,
                accent: 'rgba(234,216,189,0.95)',
                meter: Array.from({ length: 5 }, (_, index) => index < Math.min(5, Math.max(1, Math.round(totalWords / 1200)))),
            });
        }

        return result;
    }, [entries, streak, totalWords, uniqueMoods, weekWords, lastWeekW, thisWeekEntries, lastWeekEntries]);

    if (pills.length === 0) return null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="notebook-card rounded-[1.75rem] p-5"
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="section-label">Small wins</p>
                    <h3 className="notebook-title mt-2 text-[1.08rem] leading-[1.18]">
                        Momentum reads faster as signals.
                    </h3>
                </div>
                <span className="rounded-full border border-[rgba(92,92,92,0.12)] bg-[rgba(248,244,237,0.9)] px-2.5 py-1 text-[0.68rem] text-[rgb(107,107,107)]">
                    {entries.length > 0 ? `${entries.length} saved` : 'Ready'}
                </span>
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
                        <div className="flex items-start justify-between gap-2">
                            <p className="section-label">{pill.label}</p>
                            <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: pill.accent }}
                                aria-hidden="true"
                            />
                        </div>
                        <p
                            className="mt-2 text-xl font-semibold tabular-nums leading-none"
                            style={{ color: 'rgb(var(--paper-ink))' }}
                        >
                            {pill.value}
                        </p>
                        <p className="notebook-muted mt-1.5 text-[0.68rem] leading-5">
                            {pill.detail}
                        </p>
                        {pill.delta && (
                            <p className="mt-1.5 text-[0.6rem] leading-4 font-medium"
                               style={{ color: pill.delta.positive ? 'rgb(138,154,111)' : 'rgb(180,120,80)' }}>
                                {pill.delta.text}
                            </p>
                        )}
                        <div className="mt-2 flex items-end gap-1.5">
                            {pill.meter.map((filled, index) => (
                                <span
                                    key={`${pill.label}-${index}`}
                                    className="block rounded-full"
                                    style={{
                                        width: '7px',
                                        height: `${10 + index * 2}px`,
                                        backgroundColor: filled ? pill.accent : 'rgba(92,92,92,0.14)',
                                        opacity: filled ? 1 : 0.6,
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.section>
    );
}
