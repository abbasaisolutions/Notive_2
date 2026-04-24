'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { FiArrowUpRight } from 'react-icons/fi';

type StreakStripProps = {
    currentStreak: number;
    bestStreak?: number;
    timelineHref: string;
};

function streakCopy(currentStreak: number, bestStreak?: number) {
    if (currentStreak >= 30) {
        return {
            kicker: `${currentStreak}-day rhythm`,
            title: 'A month of steady reflection.',
            body: 'Your practice is compounding. The patterns Notive surfaces now are built on a real record.',
        };
    }
    if (currentStreak >= 14) {
        return {
            kicker: `${currentStreak} days in a row`,
            title: 'Two weeks of showing up.',
            body: 'You’re writing through easy days and awkward ones — that’s where the good insights come from.',
        };
    }
    if (currentStreak >= 7) {
        return {
            kicker: `${currentStreak}-day streak`,
            title: 'A full week of honesty with yourself.',
            body: bestStreak && bestStreak > currentStreak
                ? `Your best is ${bestStreak} days. You’re on the climb back.`
                : 'Keep going — the patterns start sharpening from here.',
        };
    }
    if (currentStreak >= 3) {
        return {
            kicker: `${currentStreak} days in a row`,
            title: 'You’ve got a rhythm going.',
            body: 'A few more days and Notive starts pulling threads across your notes.',
        };
    }
    return {
        kicker: `Day ${currentStreak}`,
        title: 'Back-to-back. Nice.',
        body: 'One more tomorrow and the streak earns its first doodle.',
    };
}

export default function StreakStrip({ currentStreak, bestStreak, timelineHref }: StreakStripProps) {
    const reducedMotion = useReducedMotion();
    if (currentStreak < 2) return null;

    const copy = streakCopy(currentStreak, bestStreak);
    const isMilestone = currentStreak >= 7;

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
            className="notebook-card-soft flex items-start gap-4 rounded-[1.75rem] px-5 py-4"
            aria-label={`${currentStreak} day writing streak`}
        >
            <motion.div
                aria-hidden="true"
                animate={reducedMotion || !isMilestone ? undefined : { rotate: [0, -4, 4, 0], scale: [1, 1.05, 1] }}
                transition={reducedMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    isMilestone
                        ? 'bg-[rgba(var(--paper-sage),0.18)] text-[rgb(var(--paper-sage))]'
                        : 'bg-[rgba(var(--paper-border),0.08)] text-[rgb(var(--paper-ink))]'
                }`}
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8.5 14.5a3.5 3.5 0 107 0c0-3-2.5-4-3.5-6.5-1 2.5-3.5 3.5-3.5 6.5z" />
                    <path d="M12 2c-1 3-3 4.5-3 7 0 1 .5 2 1.5 2.5" />
                </svg>
            </motion.div>
            <div className="min-w-0 flex-1">
                <p
                    className="type-overline"
                    style={{ color: isMilestone ? 'rgb(var(--paper-sage))' : 'rgb(var(--paper-ink-soft))' }}
                >
                    {copy.kicker}
                </p>
                <p
                    className="mt-1 text-sm font-semibold leading-6"
                    style={{ color: 'rgb(var(--paper-ink))', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                >
                    {copy.title}
                </p>
                <p className="mt-1 text-xs leading-5" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                    {copy.body}
                </p>
            </div>
            <Link
                href={timelineHref}
                aria-label="Open your timeline"
                className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(var(--paper-border),0.25)] text-[rgb(var(--paper-ink-soft))] transition-colors hover:bg-white"
            >
                <FiArrowUpRight size={14} aria-hidden="true" />
            </Link>
        </motion.section>
    );
}
