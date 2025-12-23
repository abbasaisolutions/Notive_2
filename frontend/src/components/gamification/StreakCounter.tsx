'use client';

import { useGamification } from '@/context/gamification-context';
import { cn } from '@/utils/cn';
import { Flame } from 'lucide-react';

export default function StreakCounter() {
    const { stats, isLoading } = useGamification();

    if (isLoading || !stats) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 animate-pulse">
                <div className="w-4 h-4 bg-white/10 rounded-full" />
                <div className="w-8 h-3 bg-white/10 rounded" />
            </div>
        );
    }

    const streak = stats.currentStreak || 0;

    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-500",
            streak > 0
                ? "bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-lg shadow-orange-500/10"
                : "bg-white/5 border-white/10 text-slate-500"
        )}>
            <Flame className={cn(
                "w-4 h-4",
                streak > 0 && "animate-bounce"
            )} />
            <span className="text-sm font-bold">
                {streak} day{streak !== 1 ? 's' : ''}
            </span>
        </div>
    );
}
