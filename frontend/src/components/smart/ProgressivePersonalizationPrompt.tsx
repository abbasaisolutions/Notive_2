'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import useApi from '@/hooks/use-api';
import {
    PersonalizationQuestion,
    PromptFrequency,
    progressivePersonalizationService,
} from '@/services/progressive-personalization.service';

const INITIAL_DELAY_MS = 3500;
const SUCCESS_TOAST_MS = 3000;

export default function ProgressivePersonalizationPrompt() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, refreshUser } = useAuth();
    const { apiFetch } = useApi();
    const [question, setQuestion] = useState<PersonalizationQuestion | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const userId = user?.id;
    const normalizedPath = pathname || '/dashboard';
    const promptFrequency = useMemo<PromptFrequency>(() => {
        const signals = user?.profile?.personalizationSignals;
        if (!signals || typeof signals !== 'object' || Array.isArray(signals)) return 'normal';

        const settings = (signals as Record<string, unknown>).settings;
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return 'normal';

        const value = (settings as Record<string, unknown>).promptFrequency;
        return value === 'off' || value === 'low' || value === 'normal' || value === 'high'
            ? value
            : 'normal';
    }, [user?.profile?.personalizationSignals]);
    const checkIntervalMs = useMemo(
        () => progressivePersonalizationService.getPollingIntervalMs(user?.profile),
        [user?.profile]
    );

    const canShow = useMemo(
        () => Boolean(userId) && promptFrequency !== 'off' && !isVisible && !isSubmitting,
        [userId, promptFrequency, isVisible, isSubmitting]
    );

    const maybeShowPrompt = useCallback(() => {
        if (!userId || !canShow) return;

        const nextQuestion = progressivePersonalizationService.getNextQuestion({
            userId,
            profile: user?.profile,
            pathname: normalizedPath,
        });
        if (!nextQuestion) return;

        progressivePersonalizationService.markPromptShown({
            userId,
            questionId: nextQuestion.id,
        });

        setQuestion(nextQuestion);
        setError(null);
        setIsVisible(true);
    }, [canShow, normalizedPath, user?.profile, userId]);

    useEffect(() => {
        if (!userId) {
            setQuestion(null);
            setIsVisible(false);
            return;
        }

        if (promptFrequency === 'off') {
            setQuestion(null);
            setIsVisible(false);
            return;
        }

        const timeout = window.setTimeout(maybeShowPrompt, INITIAL_DELAY_MS);
        const interval = window.setInterval(maybeShowPrompt, checkIntervalMs);

        return () => {
            window.clearTimeout(timeout);
            window.clearInterval(interval);
        };
    }, [checkIntervalMs, maybeShowPrompt, normalizedPath, promptFrequency, userId]);

    const clearNoticeLater = useCallback(() => {
        window.setTimeout(() => setNotice(null), SUCCESS_TOAST_MS);
    }, []);

    const handleAnswer = useCallback(async (value: string) => {
        if (!userId || !question || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);
        try {
            const state = progressivePersonalizationService.recordAnswer({
                userId,
                question,
                value,
                pathname: normalizedPath,
            });

            setIsVisible(false);
            setQuestion(null);

            const patch = progressivePersonalizationService.buildSyncPayload({
                profile: user?.profile,
                state,
            });

            if (!progressivePersonalizationService.shouldSyncPatch({ patch, state })) {
                setNotice('Saved. We will use this to personalize your journey.');
                clearNoticeLater();
                return;
            }

            const response = await apiFetch('/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(patch),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.message || 'Failed to sync personalization');
            }

            progressivePersonalizationService.markPatchSynced({
                userId,
                patch,
            });

            await refreshUser();
            setNotice('Personalization updated.');
            clearNoticeLater();
        } catch (err: any) {
            setError(err?.message || 'Failed to save this answer right now.');
            setNotice('Saved locally. We will sync when possible.');
            clearNoticeLater();
        } finally {
            setIsSubmitting(false);
        }
    }, [
        apiFetch,
        clearNoticeLater,
        isSubmitting,
        normalizedPath,
        question,
        refreshUser,
        user?.profile,
        userId,
    ]);

    const handleLater = useCallback(() => {
        if (!userId) return;
        progressivePersonalizationService.snooze({ userId, minutes: 120 });
        setIsVisible(false);
        setQuestion(null);
        setError(null);
    }, [userId]);

    const handleOpenSetup = useCallback(() => {
        setIsVisible(false);
        setQuestion(null);
        router.push('/onboarding?source=progressive');
    }, [router]);

    if (!userId) return null;

    return (
        <>
            {notice && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[65]">
                    <div className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2 text-xs text-white shadow-xl">
                        {notice}
                    </div>
                </div>
            )}

            {isVisible && question && (
                <div className="fixed left-4 right-4 bottom-24 md:right-6 md:left-auto md:bottom-8 md:max-w-sm z-[60] animate-slide-up">
                    <div className="glass-card rounded-2xl p-4 border border-white/10 shadow-2xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Personalize as you go</p>
                                <h3 className="text-sm font-semibold text-white mt-1">{question.prompt}</h3>
                                {question.helper && <p className="text-xs text-ink-secondary mt-1">{question.helper}</p>}
                            </div>
                            <button
                                type="button"
                                onClick={handleLater}
                                className="text-ink-secondary hover:text-white text-sm transition-colors"
                                aria-label="Dismiss prompt for now"
                            >
                                x
                            </button>
                        </div>

                        {error && (
                            <div className="mt-3 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-ink-secondary">
                                {error}
                            </div>
                        )}

                        <div className="mt-3 grid grid-cols-1 gap-2">
                            {question.options.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleAnswer(option.value)}
                                    disabled={isSubmitting}
                                    className="w-full text-left rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={handleLater}
                                className="text-xs text-ink-secondary hover:text-white transition-colors"
                            >
                                Ask later
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenSetup}
                                className="text-xs text-primary hover:text-white transition-colors"
                            >
                                Open full setup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
