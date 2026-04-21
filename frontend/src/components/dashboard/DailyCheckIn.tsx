'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CHECKIN_MOODS, MOOD_EMOJIS } from '@/constants/moods';
import { useToast } from '@/context/toast-context';
import { useChipScroller } from '@/hooks/use-chip-scroller';

const QUICK_MOODS = CHECKIN_MOODS;

type CheckInState = 'idle' | 'selected' | 'writing' | 'saving' | 'done';

interface DailyCheckInProps {
    hasCheckedInToday: boolean;
    todayMood?: string | null;
    onSubmit: (mood: string, note: string) => Promise<void>;
}

export default function DailyCheckIn({ hasCheckedInToday, todayMood = null, onSubmit }: DailyCheckInProps) {
    const [state, setState] = useState<CheckInState>(hasCheckedInToday ? 'done' : 'idle');
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const toast = useToast();
    const { containerRef: moodRowRef, registerItem: registerMoodChip } = useChipScroller(selectedMood);

    useEffect(() => {
        if (hasCheckedInToday) {
            setState('done');
            setError(null);
            return;
        }

        setState((current) => (current === 'done' ? 'idle' : current));
        setSelectedMood(null);
        setNote('');
        setError(null);
    }, [hasCheckedInToday]);

    useEffect(() => () => {
        if (focusTimerRef.current) {
            clearTimeout(focusTimerRef.current);
        }
    }, []);

    const handleMoodTap = useCallback((mood: string) => {
        setSelectedMood(mood);
        setState('selected');
        setError(null);
        // Auto-focus the note input after a beat
        if (focusTimerRef.current) {
            clearTimeout(focusTimerRef.current);
        }
        focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 200);
    }, []);

    const handleSave = useCallback(async () => {
        if (!selectedMood) return;
        setState('saving');
        setError(null);
        try {
            await onSubmit(selectedMood, note.trim());
            setState('done');
            toast.success('Check-in saved', 'Your dashboard will start weaving this into today’s signals.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Couldn’t save your check-in. Please try again.';
            setError(message);
            setState(note.trim() ? 'writing' : 'selected');
            toast.error('Couldn’t save check-in', message);
        }
    }, [note, onSubmit, selectedMood, toast]);

    if (state === 'done') {
        const moodLabel = todayMood || selectedMood;
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-[1.25rem] border border-[rgba(138,154,111,0.2)] bg-[rgba(138,154,111,0.06)] px-4 py-3 text-center"
            >
                <p className="text-[0.78rem] font-medium text-[rgb(138,154,111)]">
                    ✓ Checked in today{moodLabel ? ` — feeling ${moodLabel} ${MOOD_EMOJIS[moodLabel] ?? ''}` : ''}
                </p>
            </motion.div>
        );
    }

    return (
        <div className="rounded-[1.25rem] border border-[rgba(92,92,92,0.12)] bg-[rgba(248,244,237,0.94)] px-4 py-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <p className="section-label">Quick check-in</p>
                <p className="text-[0.62rem] text-[rgb(107,107,107)]">Counts toward your streak</p>
            </div>

            {/* Mood emoji row — horizontal scroll, most common first, swipe left for more */}
            <div
                ref={moodRowRef}
                className="chip-scroller mt-3 -mx-4 px-4 sm:gap-2"
                role="radiogroup"
                aria-label="How are you feeling"
            >
                {QUICK_MOODS.map((mood) => {
                    const isSelected = selectedMood === mood;
                    return (
                        <motion.button
                            key={mood}
                            ref={registerMoodChip(mood)}
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleMoodTap(mood)}
                            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition-colors ${
                                isSelected
                                    ? 'bg-[rgba(138,154,111,0.15)] ring-1 ring-[rgba(138,154,111,0.4)]'
                                    : 'hover:bg-[rgba(92,92,92,0.06)]'
                            }`}
                            role="radio"
                            aria-label={mood}
                            aria-checked={isSelected}
                        >
                            <span className={`text-xl transition-transform ${isSelected ? 'scale-110' : ''}`}>
                                {MOOD_EMOJIS[mood] ?? '😐'}
                            </span>
                            <span className={`text-[0.55rem] capitalize leading-none ${
                                isSelected ? 'font-semibold text-[rgb(138,154,111)]' : 'text-[rgb(140,140,140)]'
                            }`}>
                                {mood}
                            </span>
                        </motion.button>
                    );
                })}
            </div>

            {/* Expandable note + save */}
            <AnimatePresence>
                {(state === 'selected' || state === 'writing' || state === 'saving') && selectedMood && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div className="mt-3 flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={note}
                                onChange={(e) => {
                                    setNote(e.target.value);
                                    if (state !== 'writing') setState('writing');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleSave();
                                }}
                                placeholder="One sentence about today (optional)"
                                maxLength={280}
                                className="flex-1 rounded-xl border border-[rgba(92,92,92,0.12)] bg-white/60 px-3 py-2.5 text-[0.82rem] text-[rgb(var(--paper-ink))] placeholder:text-[rgb(170,170,170)] focus:border-[rgba(138,154,111,0.4)] focus:outline-none focus:ring-1 focus:ring-[rgba(138,154,111,0.2)]"
                            />
                            <motion.button
                                type="button"
                                whileTap={{ scale: 0.95 }}
                                onClick={() => void handleSave()}
                                disabled={state === 'saving'}
                                className="shrink-0 rounded-xl bg-[rgba(138,154,111,0.85)] px-4 py-2.5 text-[0.78rem] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                                {state === 'saving' ? '...' : 'Save'}
                            </motion.button>
                        </div>
                        {error && (
                            <p className="mt-2 text-[0.72rem] leading-5 text-[rgb(180,120,80)]" role="status">
                                {error}
                            </p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
