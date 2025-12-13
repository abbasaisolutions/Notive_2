'use client';

import React from 'react';

interface ActivityHeatmapProps {
    data: { date: string; count: number }[];
    weeks?: number;
}

export default function ActivityHeatmap({ data, weeks = 12 }: ActivityHeatmapProps) {
    // Generate grid for the last N weeks
    const today = new Date();
    const grid: { date: string; count: number; dayOfWeek: number }[][] = [];

    // Start from the beginning of the week, N weeks ago
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (weeks * 7) - startDate.getDay());

    // Create data lookup
    const dataMap = new Map(data.map(d => [d.date, d.count]));

    // Build grid
    for (let week = 0; week < weeks; week++) {
        const weekData: { date: string; count: number; dayOfWeek: number }[] = [];

        for (let day = 0; day < 7; day++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + (week * 7) + day);

            const dateStr = currentDate.toISOString().split('T')[0];
            const count = dataMap.get(dateStr) || 0;

            weekData.push({
                date: dateStr,
                count,
                dayOfWeek: day,
            });
        }

        grid.push(weekData);
    }

    // Intensity colors
    const getColor = (count: number): string => {
        if (count === 0) return 'bg-white/5';
        if (count === 1) return 'bg-primary/30';
        if (count === 2) return 'bg-primary/50';
        if (count === 3) return 'bg-primary/70';
        return 'bg-primary';
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
        <div className="glass-card p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Journal Activity</h3>

            <div className="flex gap-1">
                {/* Day labels */}
                <div className="flex flex-col gap-1 mr-2 text-xs text-slate-500">
                    {weekDays.map((day, i) => (
                        <div key={i} className="h-3 flex items-center" style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="flex gap-1">
                    {grid.map((week, weekIndex) => (
                        <div key={weekIndex} className="flex flex-col gap-1">
                            {week.map((day, dayIndex) => (
                                <div
                                    key={dayIndex}
                                    className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-all hover:scale-125`}
                                    title={`${day.date}: ${day.count} entries`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-slate-500">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-white/5" />
                <div className="w-3 h-3 rounded-sm bg-primary/30" />
                <div className="w-3 h-3 rounded-sm bg-primary/50" />
                <div className="w-3 h-3 rounded-sm bg-primary/70" />
                <div className="w-3 h-3 rounded-sm bg-primary" />
                <span>More</span>
            </div>
        </div>
    );
}
