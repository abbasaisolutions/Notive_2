'use client';

import React from 'react';
import Link from 'next/link';

type EntryDay = {
    date: string;
    mood: string | null;
    entryId: string;
};

type ScribbleStreakProps = {
    entries: Array<{ id: string; createdAt: string; mood: string | null }>;
    openEntryHref: (id: string) => string;
};

const MOOD_SHAPES: Record<string, string> = {
    happy: 'M6 10c1-3 5-3 6 0M4 7a1 1 0 110-2 1 1 0 010 2zM12 7a1 1 0 110-2 1 1 0 010 2z',
    calm: 'M4 9c2 1 6 1 8 0M5 6a0.5 0.5 0 110-1 0.5 0.5 0 010 1zM11 6a0.5 0.5 0 110-1 0.5 0.5 0 010 1z',
    sad: 'M6 11c1 2 5 2 6 0M5 7a0.5 0.5 0 110-1 0.5 0.5 0 010 1zM11 7a0.5 0.5 0 110-1 0.5 0.5 0 010 1z',
    anxious: 'M5 10c2-1 4-1 6 0M4 5l2 2M12 5l-2 2',
    thoughtful: 'M6 10h4M5 6a0.5 0.5 0 110-1 0.5 0.5 0 010 1zM11 7a1 1 0 110-2 1 1 0 010 2z',
};

const DEFAULT_SHAPE = 'M5 8c2 2 5 2 7 0';

function buildCalendar(entries: ScribbleStreakProps['entries']): { days: (EntryDay | null)[]; monthLabel: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    const entryMap = new Map<string, { mood: string | null; id: string }>();
    for (const entry of entries) {
        const d = new Date(entry.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!entryMap.has(key)) {
            entryMap.set(key, { mood: entry.mood, id: entry.id });
        }
    }

    const days: (EntryDay | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
        const key = `${year}-${month}-${day}`;
        const entry = entryMap.get(key);
        if (entry) {
            days.push({ date: String(day), mood: entry.mood, entryId: entry.id });
        } else {
            days.push({ date: String(day), mood: null, entryId: '' });
        }
    }

    const monthLabel = now.toLocaleString('default', { month: 'long' });
    return { days, monthLabel };
}

export default function ScribbleStreak({ entries, openEntryHref }: ScribbleStreakProps) {
    const { days, monthLabel } = buildCalendar(entries);

    return (
        <div className="notebook-card-soft rounded-2xl p-4">
            <p className="notebook-kicker mb-3" style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                {monthLabel}
            </p>
            <div className="grid grid-cols-7 gap-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="text-center pb-1" style={{ fontSize: '0.6rem', color: 'rgb(var(--paper-ink-muted))' }}>
                        {d}
                    </div>
                ))}
                {days.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} />;
                    const hasEntry = day.entryId.length > 0;
                    const shape = day.mood ? (MOOD_SHAPES[day.mood] || DEFAULT_SHAPE) : DEFAULT_SHAPE;
                    const today = new Date();
                    const isToday = Number(day.date) === today.getDate() && today.getMonth() === new Date().getMonth();

                    if (hasEntry) {
                        return (
                            <Link
                                key={`day-${day.date}`}
                                href={openEntryHref(day.entryId)}
                                className="aspect-square flex items-center justify-center rounded-lg transition-colors group"
                                style={{ backgroundColor: 'transparent' }}
                                title={`Day ${day.date}`}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(var(--paper-sage), 0.25)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <svg viewBox="0 0 16 16" className="w-5 h-5 transition-colors" style={{ color: 'rgba(var(--paper-sage), 0.9)' }}>
                                    <path d={shape} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            </Link>
                        );
                    }

                    return (
                        <div
                            key={`day-${day.date}`}
                            className="aspect-square flex items-center justify-center rounded-lg"
                            style={isToday ? { boxShadow: 'inset 0 0 0 1px rgba(var(--paper-border), 0.6)' } : undefined}
                        >
                            <span style={{ fontSize: '0.6rem', color: 'rgb(var(--paper-ink-muted))' }}>{day.date}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
