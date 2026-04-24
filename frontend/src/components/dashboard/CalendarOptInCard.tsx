'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    shouldShowCalendarOptIn,
    requestCalendarPermission,
    markCalendarDeclined,
    getCalendarOptInState,
} from '@/services/calendar.service';
import { isNativePlatform } from '@/utils/platform';
import { hapticLight, hapticSuccess } from '@/services/haptics.service';

interface Props {
    onGranted: () => void; // parent refreshes event list
    streak?: number;       // used to personalise the re-prompt copy
}

type CardVariant = 'full' | 'mini' | 'settings' | 'hidden';

export default function CalendarOptInCard({ onGranted, streak }: Props) {
    const [variant, setVariant] = useState<CardVariant>('hidden');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isNativePlatform()) return;
        (async () => {
            const show = await shouldShowCalendarOptIn();
            if (!show) return;
            const state = await getCalendarOptInState();
            if (state.status === 'os_denied') setVariant('settings');
            else if (state.status === 'declined') setVariant('mini');
            else setVariant('full');
        })();
    }, []);

    if (variant === 'hidden') return null;

    const handleAllow = async () => {
        setLoading(true);
        hapticLight();
        const result = await requestCalendarPermission();
        setLoading(false);
        if (result === 'granted') {
            hapticSuccess();
            setVariant('hidden');
            onGranted();
        } else {
            // OS denied → switch to settings card
            setVariant('settings');
        }
    };

    const handleDecline = async () => {
        await markCalendarDeclined();
        setVariant('hidden');
    };

    const handleOpenSettings = () => {
        // Capacitor App plugin opens native app settings
        import('@capacitor/app').then(({ App }) => {
            (App as any).openUrl?.({ url: 'app-settings:' }).catch(() => {});
        });
    };

    if (variant === 'settings') {
        return (
            <AnimatePresence>
                <motion.section
                    key="cal-settings"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="notebook-card-soft rounded-[1.75rem] px-5 py-4 flex items-start gap-4"
                    aria-label="Calendar permission required"
                >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--paper-sage),0.12)]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--paper-sage))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="type-overline" style={{ color: 'rgb(var(--paper-sage))' }}>Calendar access needed</p>
                        <p className="mt-1 text-sm font-semibold leading-5" style={{ color: 'rgb(var(--paper-ink))', fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                            Enable in Settings to get life-aware prompts.
                        </p>
                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={handleOpenSettings}
                                className="rounded-full bg-[rgb(var(--paper-sage))] px-4 py-1.5 text-xs font-semibold text-white transition-opacity active:opacity-70"
                            >
                                Open Settings
                            </button>
                            <button
                                onClick={handleDecline}
                                className="rounded-full px-3 py-1.5 text-xs"
                                style={{ color: 'rgb(var(--paper-ink-soft))' }}
                            >
                                Later
                            </button>
                        </div>
                    </div>
                </motion.section>
            </AnimatePresence>
        );
    }

    if (variant === 'mini') {
        const streakLine = streak && streak >= 7
            ? `You've journaled ${streak} days straight — calendar context makes each prompt sharper.`
            : 'Your upcoming events can shape today\'s journal question.';

        return (
            <AnimatePresence>
                <motion.section
                    key="cal-mini"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="notebook-card-soft rounded-[1.75rem] px-5 py-3.5 flex items-center gap-3"
                    aria-label="Calendar opt-in reminder"
                >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--paper-sage),0.10)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--paper-sage))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <p className="flex-1 text-xs leading-5" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                        {streakLine}
                    </p>
                    <div className="flex shrink-0 gap-2">
                        <button
                            onClick={handleAllow}
                            disabled={loading}
                            className="rounded-full bg-[rgb(var(--paper-sage))] px-3 py-1 text-xs font-semibold text-white transition-opacity active:opacity-70 disabled:opacity-50"
                        >
                            {loading ? '…' : 'Connect'}
                        </button>
                        <button
                            onClick={handleDecline}
                            className="rounded-full px-2 py-1 text-xs"
                            style={{ color: 'rgb(var(--paper-ink-muted))' }}
                        >
                            ✕
                        </button>
                    </div>
                </motion.section>
            </AnimatePresence>
        );
    }

    // variant === 'full'
    return (
        <AnimatePresence>
            <motion.section
                key="cal-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
                className="notebook-card-soft rounded-[1.75rem] px-5 py-5"
                aria-label="Connect your calendar"
            >
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--paper-sage),0.13)]">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--paper-sage))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="type-overline" style={{ color: 'rgb(var(--paper-sage))' }}>Life-aware prompts</p>
                        <p className="mt-1 text-sm font-semibold leading-6" style={{ color: 'rgb(var(--paper-ink))', fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                            Let Notive see what's coming up.
                        </p>
                    </div>
                </div>

                <ul className="mt-4 space-y-2">
                    {[
                        'Big interview tomorrow? "How do you want to walk in?"',
                        'Exam in 2 days? "What do you still need to make peace with?"',
                        'Team sync today? "What do you need them to understand?"',
                    ].map((line) => (
                        <li key={line} className="flex items-start gap-2 text-xs leading-5" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                            <span className="mt-0.5 shrink-0 text-[rgb(var(--paper-sage))]">·</span>
                            <span className="italic">{line}</span>
                        </li>
                    ))}
                </ul>

                <p className="mt-3 text-[11px] leading-4" style={{ color: 'rgb(var(--paper-ink-muted))' }}>
                    Read-only access. Event titles never leave your device.
                </p>

                <div className="mt-4 flex gap-3">
                    <button
                        onClick={handleAllow}
                        disabled={loading}
                        className="flex-1 rounded-full bg-[rgb(var(--paper-sage))] py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-70 disabled:opacity-50"
                    >
                        {loading ? 'Connecting…' : 'Connect calendar'}
                    </button>
                    <button
                        onClick={handleDecline}
                        className="rounded-full border border-[rgba(var(--paper-border),0.3)] px-4 py-2.5 text-sm"
                        style={{ color: 'rgb(var(--paper-ink-soft))' }}
                    >
                        Not now
                    </button>
                </div>
            </motion.section>
        </AnimatePresence>
    );
}
