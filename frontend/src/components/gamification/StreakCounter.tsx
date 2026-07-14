'use client';

import { useGamification } from '@/context/gamification-context';
import { cn } from '@/utils/cn';

// Feather (react-icons/fi) has no flame glyph. Hand-drawn to match Feather's
// stroke conventions (24x24 viewBox, 2px stroke, round caps/joins) so it
// doesn't visually clash with the rest of the icon set.
function FiFlame({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <path d="M12 2c1 3-2 4.5-2 7.5a2 2 0 0 0 4 0c1.5 1.5 2 3 2 4.5a5 5 0 0 1-10 0c0-3.5 2.5-5 3-7C9.5 5.5 10.5 3.5 12 2Z" />
        </svg>
    );
}

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
                ? "bg-primary/10 border-primary/30 text-primary shadow-lg shadow-primary/10"
                : "bg-white/5 border-white/10 text-ink-muted"
        )}>
            <FiFlame className={cn(
                "w-4 h-4",
                streak > 0 && "animate-bounce"
            )} />
            <span className="text-sm font-bold">
                {streak} day{streak !== 1 ? 's' : ''}
            </span>
        </div>
    );
}
