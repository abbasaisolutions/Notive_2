'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { engagementService } from '@/services/engagement.service';
import useApi from '@/hooks/use-api';
import useTelemetry from '@/hooks/use-telemetry';
import {
    PersonalizationQuestion,
    PromptFrequency,
    progressivePersonalizationService,
} from '@/services/progressive-personalization.service';

const INITIAL_DELAY_MS = 3500;
const SUCCESS_TOAST_MS = 3000;

const createPromptInstanceId = (): string => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    return `progressive-prompt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export default function ProgressivePersonalizationPrompt() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, refreshUser } = useAuth();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const [question, setQuestion] = useState<PersonalizationQuestion | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [promptInstanceId, setPromptInstanceId] = useState<string | null>(null);
    const promptPresentation = question
        ? engagementService.getProgressivePromptPresentation(question, user?.id)
        : null;

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
        if (engagementService.shouldSuppressForPath(normalizedPath)) return;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

        const nextQuestion = progressivePersonalizationService.getNextQuestion({
            userId,
            profile: user?.profile,
            pathname: normalizedPath,
        });
        if (!nextQuestion) return;
        if (!engagementService.canShowProgressivePrompt(userId, nextQuestion.id)) return;
        const nextPromptInstanceId = createPromptInstanceId();
        const nextPresentation = engagementService.getProgressivePromptPresentation(nextQuestion, userId);

        progressivePersonalizationService.markPromptShown({
            userId,
            questionId: nextQuestion.id,
        });
        engagementService.recordProgressivePromptShown(userId, nextQuestion.id);

        void trackEvent({
            eventType: 'PROGRESSIVE_PROMPT_SHOWN',
            field: nextQuestion.field,
            value: nextQuestion.id,
            metadata: {
                questionId: nextQuestion.id,
                promptInstanceId: nextPromptInstanceId,
                promptExperimentId: nextPresentation.experimentId,
                promptFramingVariant: nextPresentation.framingVariant,
                promptCategory: 'progressive_personalization',
            },
        });

        setQuestion(nextQuestion);
        setPromptInstanceId(nextPromptInstanceId);
        setError(null);
        setIsVisible(true);
    }, [canShow, normalizedPath, trackEvent, user?.profile, userId]);

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
            engagementService.recordProgressivePromptOutcome(userId, 'accepted');
            void trackEvent({
                eventType: 'PROGRESSIVE_PROMPT_ACCEPTED',
                field: question.field,
                value: question.id,
                metadata: {
                    questionId: question.id,
                    answerValue: value,
                    promptInstanceId,
                    promptExperimentId: promptPresentation?.experimentId || null,
                    promptFramingVariant: promptPresentation?.framingVariant || null,
                    promptCategory: 'progressive_personalization',
                },
            });

            setIsVisible(false);
            setQuestion(null);
            setPromptInstanceId(null);

            const patch = progressivePersonalizationService.buildSyncPayload({
                profile: user?.profile,
                state,
            });

            if (!progressivePersonalizationService.shouldSyncPatch({ patch, state })) {
                setNotice('Saved. Notive will use this right away.');
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
            setNotice('Updated. Prompts and insights will adjust from here.');
            clearNoticeLater();
        } catch (err: any) {
            setError(err?.message || 'Failed to save this answer right now.');
            setNotice('Saved here for now. Notive will sync it when it can.');
            clearNoticeLater();
        } finally {
            setIsSubmitting(false);
        }
    }, [
        apiFetch,
        clearNoticeLater,
        isSubmitting,
        normalizedPath,
        promptInstanceId,
        promptPresentation?.experimentId,
        promptPresentation?.framingVariant,
        question,
        refreshUser,
        trackEvent,
        user?.profile,
        userId,
    ]);

    const handleLater = useCallback(() => {
        if (!userId || !question) return;
        engagementService.recordProgressivePromptOutcome(userId, 'dismissed');
        void trackEvent({
            eventType: 'PROGRESSIVE_PROMPT_DISMISSED',
            field: question.field,
            value: question.id,
            metadata: {
                questionId: question.id,
                promptInstanceId,
                promptExperimentId: promptPresentation?.experimentId || null,
                promptFramingVariant: promptPresentation?.framingVariant || null,
                promptCategory: 'progressive_personalization',
            },
        });
        progressivePersonalizationService.snooze({ userId, minutes: 120 });
        setIsVisible(false);
        setQuestion(null);
        setPromptInstanceId(null);
        setError(null);
    }, [promptInstanceId, promptPresentation?.experimentId, promptPresentation?.framingVariant, question, trackEvent, userId]);

    const handleOpenSetup = useCallback(() => {
        if (userId && question) {
            engagementService.recordProgressivePromptOutcome(userId, 'accepted');
            void trackEvent({
                eventType: 'PROGRESSIVE_PROMPT_ACCEPTED',
                field: question.field,
                value: question.id,
                metadata: {
                    questionId: question.id,
                    answerValue: '__open_setup__',
                    promptInstanceId,
                    promptExperimentId: promptPresentation?.experimentId || null,
                    promptFramingVariant: promptPresentation?.framingVariant || null,
                    promptCategory: 'progressive_personalization',
                },
            });
        }
        setIsVisible(false);
        setQuestion(null);
        setPromptInstanceId(null);
        router.push('/onboarding?source=progressive');
    }, [promptInstanceId, promptPresentation?.experimentId, promptPresentation?.framingVariant, question, router, trackEvent, userId]);

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
                                <p className="text-xs uppercase tracking-[0.18em] text-primary/80">{promptPresentation?.eyebrow || 'Help Notive know you'}</p>
                                <h3 className="text-sm font-semibold text-white mt-1">{promptPresentation?.title || question.prompt}</h3>
                                <p className="text-xs text-ink-secondary mt-1">{promptPresentation?.helper || question.prompt}</p>
                                <p className="text-[11px] leading-5 text-ink-muted mt-2">{promptPresentation?.benefit || question.helper}</p>
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
                                {promptPresentation?.laterLabel || 'Later'}
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenSetup}
                                className="text-xs text-primary hover:text-white transition-colors"
                            >
                                {promptPresentation?.setupLabel || 'Open all settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
