'use client';

import React, { useEffect } from 'react';
import { useGamification } from '@/context/gamification-context';
import { FiAward, FiTrendingUp } from 'react-icons/fi';

const AUTO_DISMISS_MS = 4000;

/**
 * Quiet milestone acknowledgment. Replaced the confetti + modal version:
 * a private diary doesn't interrupt writing to congratulate itself.
 */
export default function CelebrationModal() {
    const { showCelebration, celebrationType, newBadge, dismissCelebration, stats } = useGamification();

    useEffect(() => {
        if (!showCelebration) return;
        const timer = window.setTimeout(dismissCelebration, AUTO_DISMISS_MS);
        return () => window.clearTimeout(timer);
    }, [showCelebration, dismissCelebration]);

    if (!showCelebration) return null;

    const BadgeIcon = celebrationType === 'badge' && newBadge ? newBadge.icon : null;
    const line = celebrationType === 'badge' && newBadge
        ? newBadge.name
        : celebrationType === 'levelup'
            ? `Level ${stats?.level}`
            : celebrationType === 'streak'
                ? `${stats?.currentStreak}-day streak`
                : null;
    if (!line) return null;

    return (
        <div
            role="status"
            className="fixed bottom-[calc(var(--app-bottom-clearance,4.5rem)+0.75rem)] left-1/2 z-50 -translate-x-1/2"
        >
            <button
                type="button"
                onClick={dismissCelebration}
                className="notebook-card-soft flex items-center gap-2.5 rounded-full border border-[rgba(var(--paper-border),0.4)] py-2 pl-3 pr-4 shadow-lg transition-opacity hover:opacity-80"
            >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/12 text-primary" aria-hidden="true">
                    {BadgeIcon ? <BadgeIcon size={15} />
                        : celebrationType === 'levelup' ? <FiAward size={15} />
                        : <FiTrendingUp size={15} />}
                </span>
                <span className="text-sm font-semibold text-paper-ink">{line}</span>
                {celebrationType === 'badge' && newBadge?.description && (
                    <span className="hidden text-xs text-paper-soft sm:inline">{newBadge.description}</span>
                )}
            </button>
        </div>
    );
}
