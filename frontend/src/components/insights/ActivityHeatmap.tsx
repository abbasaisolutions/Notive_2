'use client';

import React, { useMemo, useState } from 'react';

interface ActivityHeatmapProps {
    data: { date: string; count: number }[];
    weeks?: number;
}

interface DayCell {
    date: string;
    count: number;
}

const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeDateKey = (value: string): string => value.slice(0, 10);

const formatShortDate = (dateKey: string): string => {
    const [year, month, day] = dateKey.split('-').map(Number);
    if (!year || !month || !day) return dateKey;
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
};

export default function ActivityHeatmap({ data, weeks = 12 }: ActivityHeatmapProps) {
    const [hoveredDay, setHoveredDay] = useState<DayCell | null>(null);

    const { grid, flatGrid } = useMemo(() => {
        const today = new Date();
        const builtGrid: DayCell[][] = [];
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (weeks * 7) - startDate.getDay());
        const dataMap = new Map(data.map((d) => [normalizeDateKey(d.date), d.count]));

        for (let week = 0; week < weeks; week++) {
            const weekData: DayCell[] = [];
            for (let day = 0; day < 7; day++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(currentDate.getDate() + (week * 7) + day);
                const date = formatDateKey(currentDate);
                weekData.push({
                    date,
                    count: dataMap.get(date) || 0,
                });
            }
            builtGrid.push(weekData);
        }

        return { grid: builtGrid, flatGrid: builtGrid.flat() };
    }, [data, weeks]);

    const totalEntries = flatGrid.reduce((sum, day) => sum + day.count, 0);
    const activeDays = flatGrid.filter((day) => day.count > 0).length;
    const peakCount = flatGrid.reduce((max, day) => Math.max(max, day.count), 0);
    let runningStreak = 0;
    let longestStreak = 0;
    for (const day of flatGrid) {
        if (day.count > 0) {
            runningStreak += 1;
            longestStreak = Math.max(longestStreak, runningStreak);
        } else {
            runningStreak = 0;
        }
    }

    const lastActiveDay = [...flatGrid].reverse().find((day) => day.count > 0) || null;
    const selectedDay = hoveredDay || lastActiveDay || flatGrid[flatGrid.length - 1] || null;
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const getCellClass = (count: number): string => {
        if (count === 0) return 'border border-white/5 bg-white/[0.03]';
        if (count === 1) return 'border border-primary/25 bg-primary/20';
        if (count === 2) return 'border border-primary/35 bg-primary/35';
        if (count === 3) return 'border border-primary/45 bg-primary/55';
        return 'border border-primary/60 bg-primary/80 shadow-[0_0_12px_rgba(56,189,248,0.35)]';
    };

    return (
        <div className="glass-card p-6 rounded-2xl">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-white">Journal Activity</h3>
                    <p className="text-xs text-ink-muted">Consistency map for the last {weeks} weeks</p>
                </div>
                {selectedDay && (
                    <div className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-right">
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Focused Day</p>
                        <p className="text-sm font-semibold text-white">{formatShortDate(selectedDay.date)}</p>
                        <p className="text-xs text-ink-secondary">
                            {selectedDay.count} {selectedDay.count === 1 ? 'entry' : 'entries'}
                        </p>
                    </div>
                )}
            </div>

            <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Active Days</p>
                    <p className="text-lg font-semibold text-white">{activeDays}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Entries</p>
                    <p className="text-lg font-semibold text-white">{totalEntries}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Peak Day</p>
                    <p className="text-lg font-semibold text-white">{peakCount}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Best Streak</p>
                    <p className="text-lg font-semibold text-white">{longestStreak}d</p>
                </div>
            </div>

            <div className="overflow-x-auto pb-1">
                <div className="inline-flex min-w-max gap-1.5">
                    <div className="mr-1 flex flex-col gap-1 text-xs text-ink-muted">
                        {weekDays.map((day, i) => (
                            <div
                                key={`${day}-${i}`}
                                className="flex h-3.5 items-center"
                                style={{ opacity: i % 2 === 0 ? 0 : 1 }}
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-1">
                        {grid.map((week, weekIndex) => (
                            <div key={weekIndex} className="flex flex-col gap-1">
                                {week.map((day) => (
                                    <button
                                        type="button"
                                        key={day.date}
                                        onMouseEnter={() => setHoveredDay(day)}
                                        onMouseLeave={() => setHoveredDay(null)}
                                        onFocus={() => setHoveredDay(day)}
                                        onBlur={() => setHoveredDay(null)}
                                        className={`h-3.5 w-3.5 rounded-[3px] transition-transform hover:scale-125 focus-visible:scale-125 ${getCellClass(day.count)}`}
                                        title={`${formatShortDate(day.date)}: ${day.count} entries`}
                                        aria-label={`${formatShortDate(day.date)} ${day.count} entries`}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
                <div className="flex items-center gap-1.5">
                    <span>Low</span>
                    {[0, 1, 2, 3, 4].map((count) => (
                        <span
                            key={`legend-${count}`}
                            className={`h-3 w-3 rounded-[3px] ${getCellClass(count)}`}
                            aria-hidden="true"
                        />
                    ))}
                    <span>High</span>
                </div>
                {selectedDay && (
                    <span className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1">
                        {selectedDay.count === 0
                            ? `No entries on ${formatShortDate(selectedDay.date)}`
                            : `${selectedDay.count} ${selectedDay.count === 1 ? 'entry' : 'entries'} on ${formatShortDate(selectedDay.date)}`}
                    </span>
                )}
            </div>
        </div>
    );
}

