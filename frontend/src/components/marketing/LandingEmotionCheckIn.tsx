'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiCheckCircle, FiEdit3, FiLock } from 'react-icons/fi';
import { CHECKIN_MOODS, MOOD_EMOJIS } from '@/constants/moods';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import useApi from '@/hooks/use-api';
import useTelemetry from '@/hooks/use-telemetry';
import { useChipScroller } from '@/hooks/use-chip-scroller';
import {
    LANDING_CHECKIN_SOURCE,
    buildLandingCheckInText,
    rememberLandingEvent,
    saveLandingCheckInDraft,
} from '@/utils/landing-checkin';

const VISIBLE_MOOD_COUNT = 7;

export default function LandingEmotionCheckIn() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { apiFetch } = useApi();
    const toast = useToast();
    const { trackEvent } = useTelemetry();
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [error, setError] = useState('');
    const startedRef = useRef(false);
    const { containerRef: moodRowRef, registerItem: registerMoodChip } = useChipScroller(selectedMood);

    const registerHref = useMemo(
        () => `/register?returnTo=${encodeURIComponent(`/entry/new?source=${LANDING_CHECKIN_SOURCE}`)}`,
        []
    );

    const trackLanding = useCallback((eventType: string, value?: string | null, metadata?: Record<string, unknown>) => {
        rememberLandingEvent(eventType, value, metadata);

        if (user) {
            void trackEvent({
                eventType,
                value: value ?? undefined,
                metadata: {
                    surface: 'homepage_checkin',
                    ...metadata,
                },
            });
        }
    }, [trackEvent, user]);

    const markStarted = useCallback(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        trackLanding('homepage_checkin_started');
    }, [trackLanding]);

    const handleMoodSelect = useCallback((mood: string) => {
        setSelectedMood(mood);
        setIsSaved(false);
        setError('');
        markStarted();
        trackLanding('homepage_mood_selected', mood, {
            visibleWithoutScroll: CHECKIN_MOODS.slice(0, VISIBLE_MOOD_COUNT).includes(mood as typeof CHECKIN_MOODS[number]),
        });
    }, [markStarted, trackLanding]);

    const handleNoteChange = useCallback((value: string) => {
        setNote(value);
        setIsSaved(false);
        setError('');
        markStarted();
    }, [markStarted]);

    const handleSubmit = useCallback(async () => {
        if (!selectedMood || isSaving) return;

        setIsSaving(true);
        setError('');

        try {
            if (!user) {
                saveLandingCheckInDraft(selectedMood, note.trim());
                trackLanding('homepage_checkin_register_clicked', selectedMood, {
                    hasNote: note.trim().length > 0,
                });
                router.push(registerHref);
                return;
            }

            const content = buildLandingCheckInText({ mood: selectedMood, note: note.trim() });
            const response = await apiFetch('/entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    mood: selectedMood,
                    title: 'Quick check-in',
                    tags: ['check-in'],
                    entryMode: 'quick',
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Could not save this check-in yet.');
            }

            setIsSaved(true);
            setNote('');
            toast.success('Check-in saved', 'Open your dashboard when you want to use it.');
            trackLanding('homepage_checkin_saved', selectedMood);
        } catch (saveError) {
            const message = saveError instanceof Error ? saveError.message : 'Could not save this check-in yet.';
            setError(message);
            toast.error('Check-in was not saved', message);
        } finally {
            setIsSaving(false);
        }
    }, [apiFetch, isSaving, note, registerHref, router, selectedMood, toast, trackLanding, user]);

    return (
        <motion.section
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="mt-5 grid gap-4 rounded-[1.75rem] border border-[rgba(92,92,92,0.2)] bg-[rgba(255,251,245,0.78)] p-4 shadow-[0_12px_28px_rgba(92,92,92,0.08)] backdrop-blur md:grid-cols-[minmax(0,0.82fr)_minmax(20rem,1fr)] md:p-5"
            aria-labelledby="landing-checkin-title"
        >
            <div className="flex flex-col justify-between gap-5">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(92,92,92,0.16)] bg-[rgba(248,244,237,0.86)] px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[rgb(107,107,107)]">
                        <FiEdit3 size={13} aria-hidden="true" />
                        First action
                    </div>
                    <h2
                        id="landing-checkin-title"
                        className="mt-4 max-w-xl text-2xl font-semibold leading-[1.12] tracking-normal text-[rgb(39,35,31)] md:text-[2.6rem]"
                    >
                        Start by naming what today feels like.
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-7 text-[rgb(76,70,62)] md:text-base">
                        A quick check-in becomes a private note you can build from later.
                    </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                    {[
                        'Name it',
                        'Add one line',
                        'Keep it private',
                    ].map((item) => (
                        <div
                            key={item}
                            className="rounded-[1rem] border border-[rgba(92,92,92,0.14)] bg-[rgba(255,255,255,0.48)] px-3 py-2 text-sm font-medium text-[rgb(76,70,62)]"
                        >
                            {item}
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-[1.35rem] border border-[rgba(92,92,92,0.16)] bg-[rgba(248,244,237,0.94)] p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[rgb(126,117,103)]">
                            Quick check-in
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[rgb(76,70,62)]">
                            Pick one. You can write more after.
                        </p>
                    </div>
                    <FiLock className="mt-1 shrink-0 text-[rgb(138,154,111)]" size={18} aria-label="Private" />
                </div>

                <div
                    ref={moodRowRef}
                    className="chip-scroller -mx-3 mt-4 px-3"
                    role="radiogroup"
                    aria-label="Choose a check-in mood"
                >
                    {CHECKIN_MOODS.map((mood) => {
                        const isSelected = selectedMood === mood;

                        return (
                            <button
                                key={mood}
                                ref={registerMoodChip(mood)}
                                type="button"
                                onClick={() => handleMoodSelect(mood)}
                                className={`flex min-h-[4.35rem] min-w-[4.4rem] flex-col items-center justify-center gap-1 rounded-[1rem] border px-2 py-2 transition ${
                                    isSelected
                                        ? 'border-[rgba(138,154,111,0.5)] bg-[rgba(138,154,111,0.16)] text-[rgb(72,88,55)]'
                                        : 'border-[rgba(92,92,92,0.12)] bg-[rgba(255,255,255,0.52)] text-[rgb(96,88,78)] hover:border-[rgba(92,92,92,0.22)]'
                                }`}
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={mood}
                            >
                                <span className="text-xl" aria-hidden="true">
                                    {MOOD_EMOJIS[mood] ?? '?'}
                                </span>
                                <span className="text-[0.72rem] font-semibold capitalize leading-none">
                                    {mood}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <AnimatePresence initial={false}>
                    {selectedMood && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="overflow-hidden"
                        >
                            <div className="mt-4">
                                <label htmlFor="landing-checkin-note" className="sr-only">
                                    Optional check-in note
                                </label>
                                <textarea
                                    id="landing-checkin-note"
                                    value={note}
                                    onChange={(event) => handleNoteChange(event.target.value)}
                                    rows={3}
                                    maxLength={220}
                                    placeholder="One sentence about what is happening."
                                    className="w-full resize-none rounded-[1rem] border border-[rgba(92,92,92,0.14)] bg-[rgba(255,255,255,0.66)] px-3 py-3 text-sm leading-6 text-[rgb(var(--paper-ink))] placeholder:text-[rgb(132,132,132)] focus:border-[rgba(138,154,111,0.44)] focus:outline-none focus:ring-2 focus:ring-[rgba(138,154,111,0.16)]"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {error && (
                    <p className="mt-3 text-sm leading-6 text-[rgb(155,97,97)]" role="alert">
                        {error}
                    </p>
                )}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={!selectedMood || isSaving || authLoading}
                        className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-[1rem] border border-[rgba(92,92,92,0.84)] bg-[rgb(138,154,111)] px-4 py-3 text-sm font-semibold text-[rgb(255,251,245)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                        {isSaved ? (
                            <>
                                <FiCheckCircle size={16} aria-hidden="true" />
                                Saved
                            </>
                        ) : (
                            <>
                                {user ? 'Save check-in' : 'Keep this check-in'}
                                <FiArrowRight size={16} aria-hidden="true" />
                            </>
                        )}
                    </button>
                    <p className="text-xs leading-5 text-[rgb(107,107,107)]">
                        {user ? 'Saved to your diary.' : 'You can create an account after this step.'}
                    </p>
                </div>
            </div>
        </motion.section>
    );
}
