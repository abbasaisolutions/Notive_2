'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCamera, FiCpu, FiTrendingUp, FiZap } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { Button } from '@/components/ui/form-elements';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useApi from '@/hooks/use-api';
import { useAuth } from '@/context/auth-context';
import {
    OnboardingExperienceLevel,
    OnboardingGoal,
    OnboardingOutputGoal,
    OnboardingTrack,
    OnboardingWritingPreference,
    hasCompletedOnboardingFromProfile,
    saveOnboardingState,
} from '@/utils/onboarding';
import { sanitizeReturnTo } from '@/utils/redirect';

const GOALS: Array<{ id: OnboardingGoal; icon: IconType; label: string; desc: string }> = [
    { id: 'clarity', icon: FiCpu, label: 'Clear mind', desc: 'Notice what matters and pick the next step.' },
    { id: 'memory', icon: FiCamera, label: 'Remember life', desc: 'Save moments, feelings, and details worth keeping.' },
    { id: 'growth', icon: FiTrendingUp, label: 'Grow', desc: 'Notice lessons, habits, and change over time.' },
    { id: 'productivity', icon: FiZap, label: 'Get things done', desc: 'Save wins, blockers, and stories you can use later.' },
];

const TRACKS: Array<{ id: OnboardingTrack; label: string; desc: string }> = [
    { id: 'life', label: 'Life', desc: 'Relationships, health, home, and everyday moments.' },
    { id: 'career', label: 'School and work', desc: 'Projects, learning, tasks, and future opportunities.' },
    { id: 'both', label: 'Both', desc: 'A mix of life, school, and work.' },
];

const EXPERIENCE_LEVELS: Array<{ id: OnboardingExperienceLevel; label: string }> = [
    { id: 'student', label: 'Student' },
    { id: 'early-career', label: 'Early Career' },
    { id: 'professional', label: 'Professional' },
    { id: 'lifelong-learner', label: 'Lifelong Learner' },
];

const WRITING_PREFERENCES: Array<{ id: OnboardingWritingPreference; label: string; desc: string }> = [
    { id: 'guided', label: 'With questions', desc: 'Short questions to help you start.' },
    { id: 'structured', label: 'Step by step', desc: 'Clear sections to help you stay organized.' },
    { id: 'freeform', label: 'Free writing', desc: 'Open writing with fewer interruptions.' },
];

const OUTPUT_GOALS: Array<{ id: OnboardingOutputGoal; label: string }> = [
    { id: 'self-growth', label: 'Know myself better' },
    { id: 'college-statement', label: 'School statement' },
    { id: 'resume-stories', label: 'Resume stories' },
    { id: 'interview-examples', label: 'Interview stories' },
    { id: 'portfolio', label: 'Stories for school or work' },
];

const STARTER_PROMPTS: Record<OnboardingGoal, Record<OnboardingTrack, string[]>> = {
    clarity: {
        life: [
            'What is on my mind today?',
            'What moment today felt most important?',
        ],
        career: [
            'What is my most important next step for school or work?',
            'What task am I avoiding, and how will I start?',
        ],
        both: [
            'What one choice today could help both life and work?',
            'Where am I overthinking, and what small step can I take?',
        ],
    },
    memory: {
        life: [
            'What moment from today do I want to remember?',
            'Who shaped my day, and what did I learn?',
        ],
        career: [
            'What project or task today is worth saving for later?',
            'What did I make or improve today?',
        ],
        both: [
            'What happened today that shaped both my life and future?',
            'What talk or experience today do I want to keep?',
        ],
    },
    growth: {
        life: [
            'What did I learn about myself today?',
            'Where did I handle something better today?',
        ],
        career: [
            'What skill did I practice today, and what improved?',
            'What hard thing did I get through today?',
        ],
        both: [
            'What lesson today can help me grow in life and work?',
            'How did I show resilience today in real action?',
        ],
    },
    productivity: {
        life: [
            'What did I finish today, and what got in the way?',
            'What is one small routine that would improve tomorrow?',
        ],
        career: [
            'What did I get done today, and what is next?',
            'What priority got done today, and what blocked progress?',
        ],
        both: [
            'What went well today, and what can I do better tomorrow?',
            'Which action today had the highest impact across life and career?',
        ],
    },
};

const ONBOARDING_STEPS = [
    { id: 1, label: 'Goal' },
    { id: 2, label: 'Context' },
    { id: 3, label: 'Starter' },
];

type ProfileSnapshot = {
    primaryGoal?: string | null;
    focusArea?: string | null;
    experienceLevel?: string | null;
    writingPreference?: string | null;
    outputGoals?: string[] | null;
    starterPrompt?: string | null;
    onboardingCompletedAt?: string | null;
} | null | undefined;

const parseInitialStep = (value: string | null): number => {
    const parsed = Number(value || '1');
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 3) return 1;
    return parsed;
};

const deriveResumeStepFromProfile = (profile: ProfileSnapshot): number => {
    if (!profile || typeof profile !== 'object') return 1;
    if (hasCompletedOnboardingFromProfile(profile)) return 3;

    const hasGoal = typeof profile.primaryGoal === 'string' && GOALS.some((item) => item.id === profile.primaryGoal);
    const hasTrack = typeof profile.focusArea === 'string' && TRACKS.some((item) => item.id === profile.focusArea);

    if (!hasGoal) return 1;
    if (!hasTrack) return 2;
    return 3;
};

function OnboardingPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading, isAuthenticated } = useAuthRedirect();
    const { logout, refreshUser } = useAuth();
    const { apiFetch } = useApi();
    const hasExplicitStepParam = searchParams.has('step');
    const [step, setStep] = useState<number>(() => parseInitialStep(searchParams.get('step')));
    const [goal, setGoal] = useState<OnboardingGoal | null>(null);
    const [track, setTrack] = useState<OnboardingTrack | null>(null);
    const [experienceLevel, setExperienceLevel] = useState<OnboardingExperienceLevel | null>(null);
    const [writingPreference, setWritingPreference] = useState<OnboardingWritingPreference | null>(null);
    const [selectedOutputGoals, setSelectedOutputGoals] = useState<OnboardingOutputGoal[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
    const [showOptionalProfile, setShowOptionalProfile] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [savedNotice, setSavedNotice] = useState('');
    const [isProgressSaving, setIsProgressSaving] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const hasHydratedProfileRef = useRef(false);
    const safeReturnTo = useMemo(
        () => sanitizeReturnTo(searchParams.get('returnTo')),
        [searchParams]
    );

    const promptOptions = useMemo(() => {
        if (!goal || !track) return [];
        return STARTER_PROMPTS[goal][track];
    }, [goal, track]);

    useEffect(() => {
        const profile = user?.profile;
        if (!profile || hasHydratedProfileRef.current) return;

        hasHydratedProfileRef.current = true;

        if (!hasExplicitStepParam) {
            setStep(deriveResumeStepFromProfile(profile));
        }

        if (profile.primaryGoal && GOALS.some((item) => item.id === profile.primaryGoal)) {
            setGoal(profile.primaryGoal as OnboardingGoal);
        }
        if (profile.focusArea && TRACKS.some((item) => item.id === profile.focusArea)) {
            setTrack(profile.focusArea as OnboardingTrack);
        }
        if (profile.experienceLevel && EXPERIENCE_LEVELS.some((item) => item.id === profile.experienceLevel)) {
            setExperienceLevel(profile.experienceLevel as OnboardingExperienceLevel);
        }
        if (profile.writingPreference && WRITING_PREFERENCES.some((item) => item.id === profile.writingPreference)) {
            setWritingPreference(profile.writingPreference as OnboardingWritingPreference);
        }

        const nextGoals = Array.isArray(profile.outputGoals)
            ? profile.outputGoals.filter((item) => OUTPUT_GOALS.some((option) => option.id === item)) as OnboardingOutputGoal[]
            : [];
        if (nextGoals.length > 0) {
            setSelectedOutputGoals(nextGoals);
        }

        if (typeof profile.starterPrompt === 'string') {
            setSelectedPrompt(profile.starterPrompt);
        } else if (profile.onboardingCompletedAt) {
            setSelectedPrompt('');
        }

        if (nextGoals.length > 0 || profile.experienceLevel || profile.writingPreference) {
            setShowOptionalProfile(true);
        }
    }, [hasExplicitStepParam, user]);

    useEffect(() => {
        if (step !== 3 || selectedPrompt !== null || promptOptions.length === 0) return;
        setSelectedPrompt(promptOptions[0]);
    }, [promptOptions, selectedPrompt, step]);

    const isCompletedProfile = hasCompletedOnboardingFromProfile(user?.profile);
    const firstIncompleteStep = useMemo(() => {
        if (isCompletedProfile) return null;
        if (!goal) return 1;
        if (!track) return 2;
        if (selectedPrompt === null) return 3;
        return null;
    }, [goal, isCompletedProfile, selectedPrompt, track]);

    const canContinue =
        (step === 1 && !!goal) ||
        (step === 2 && !!track) ||
        (step === 3 && selectedPrompt !== null);
    const maxReachableStep = firstIncompleteStep ?? 3;

    const buildStepPayload = (currentStep: number): Record<string, unknown> => {
        const payload: Record<string, unknown> = {};
        if (goal) payload.primaryGoal = goal;

        if (currentStep >= 2) {
            if (track) payload.focusArea = track;
            if (experienceLevel) payload.experienceLevel = experienceLevel;
            if (writingPreference) payload.writingPreference = writingPreference;
            if (selectedOutputGoals.length > 0) payload.outputGoals = selectedOutputGoals;
        }

        if (currentStep >= 3 && selectedPrompt !== null) {
            payload.starterPrompt = selectedPrompt || null;
        }

        return payload;
    };

    const saveStepProgress = async (currentStep: number): Promise<boolean> => {
        const payload = buildStepPayload(currentStep);
        if (Object.keys(payload).length === 0) return true;

        setIsProgressSaving(true);
        try {
            const response = await apiFetch('/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Failed to save onboarding progress');
            }

            return true;
        } catch (error: any) {
            setSubmitError(error?.message || 'Failed to save onboarding progress');
            return false;
        } finally {
            setIsProgressSaving(false);
        }
    };

    const toggleOutputGoal = (nextGoal: OnboardingOutputGoal) => {
        setSelectedOutputGoals((prev) => (
            prev.includes(nextGoal)
                ? prev.filter((goalItem) => goalItem !== nextGoal)
                : [...prev, nextGoal]
        ));
    };

    const goNext = async () => {
        if (isSubmitting || isProgressSaving) return;
        setSubmitError('');
        setSavedNotice('');

        if (!canContinue) return;

        if (step < 3) {
            const saved = await saveStepProgress(step);
            if (!saved) return;
            setStep((current) => current + 1);
            return;
        }

        if (!goal || !track || selectedPrompt === null) return;

        const completedAt = new Date().toISOString();
        setIsSubmitting(true);

        try {
            const response = await apiFetch('/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...buildStepPayload(3),
                    onboardingCompletedAt: completedAt,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.message || 'Failed to finish setup');
            }

            saveOnboardingState({
                completed: true,
                goal,
                track,
                starterPrompt: selectedPrompt || '',
                experienceLevel: experienceLevel || undefined,
                writingPreference: writingPreference || undefined,
                outputGoals: selectedOutputGoals.length > 0 ? selectedOutputGoals : undefined,
                completedAt,
            }, user?.id);

            await refreshUser();

            const query = selectedPrompt
                ? `?prompt=${encodeURIComponent(selectedPrompt)}&source=onboarding`
                : '?source=onboarding';

            if (safeReturnTo) {
                router.replace(safeReturnTo);
            } else {
                router.replace(`/entry/new${query}`);
            }
        } catch (error: any) {
            setSubmitError(error?.message || 'Failed to finish setup');
        } finally {
            setIsSubmitting(false);
        }
    };

    const goBack = () => {
        if (isSubmitting || isProgressSaving) return;
        if (step > 1) {
            setSubmitError('');
            setSavedNotice('');
            setStep((current) => current - 1);
        }
    };

    const jumpToStep = (nextStep: number) => {
        if (isSubmitting || isProgressSaving) return;
        if (nextStep === step) return;
        if (nextStep < step || nextStep <= maxReachableStep) {
            setSubmitError('');
            setSavedNotice('');
            setStep(nextStep);
        }
    };

    const handleSaveForLater = async () => {
        if (isSubmitting || isProgressSaving) return;
        setSubmitError('');
        setSavedNotice('');

        const saved = await saveStepProgress(Math.min(step, 3));
        if (!saved) return;
        setSavedNotice('Progress saved. You can come back later.');
    };

    const handleSignOut = async () => {
        if (isSigningOut) return;
        setIsSigningOut(true);
        try {
            await logout();
            router.replace('/login');
        } finally {
            setIsSigningOut(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-4xl relative z-10">
                <div className="mb-3 flex items-center justify-between">
                    <Link href="/onboarding" className="text-xl font-semibold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                        Notive.
                    </Link>
                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="px-3 py-2 rounded-xl border border-white/15 bg-surface-2/55 text-xs uppercase tracking-widest text-foreground hover:bg-surface-2/80 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                </div>

                <div className="mb-4 text-center">
                    <div className="text-xs uppercase tracking-[0.2em] text-ink-muted">Setup {step}/3</div>
                    <h1 className="text-3xl md:text-4xl font-serif text-white mt-2">Choose how Notive should help you first.</h1>
                    <p className="mt-3 text-sm text-ink-secondary max-w-2xl mx-auto">
                        Pick your goal, choose the part of life to focus on, and start with one easy first question for your first note.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                        {ONBOARDING_STEPS.map((item) => {
                            const isActive = item.id === step;
                            const isAvailable = item.id <= maxReachableStep || item.id <= step;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => jumpToStep(item.id)}
                                    disabled={!isAvailable || isSubmitting || isProgressSaving}
                                    className={`rounded-xl border px-3 py-1.5 text-xs uppercase tracking-[0.1em] transition-colors ${
                                        isActive
                                            ? 'border-primary/40 bg-primary/15 text-white'
                                            : isAvailable
                                                ? 'border-white/15 bg-white/[0.03] text-ink-secondary hover:text-white'
                                                : 'border-white/10 bg-white/[0.02] text-ink-muted/70 cursor-not-allowed'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {submitError && (
                    <div className="mb-4 rounded-xl border border-white/15 bg-surface-2/55 px-4 py-3 text-sm text-foreground">
                        {submitError}
                    </div>
                )}

                {savedNotice && (
                    <div className="mb-4 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary">
                        {savedNotice}
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="goal"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="glass-card p-6 md:p-8 rounded-3xl border border-white/10"
                        >
                            <p className="text-ink-secondary mb-6">What do you want Notive to help with first?</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {GOALS.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setSubmitError('');
                                            setSavedNotice('');
                                            setGoal(item.id);
                                        }}
                                        className={`text-left rounded-2xl border p-4 transition-colors ${
                                            goal === item.id
                                                ? 'border-primary/40 bg-primary/15'
                                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                                        }`}
                                    >
                                        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04]">
                                            <item.icon size={18} className="text-foreground" aria-hidden="true" />
                                        </div>
                                        <div className="text-white font-semibold">{item.label}</div>
                                        <div className="text-xs text-ink-secondary mt-1">{item.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                    {step === 2 && (
                        <motion.div
                            key="context"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="glass-card p-6 md:p-8 rounded-3xl border border-white/10 space-y-6"
                        >
                            <div>
                                <p className="text-ink-secondary mb-3">What part of life should Notive focus on first?</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {TRACKS.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setSubmitError('');
                                                setSavedNotice('');
                                                setTrack(item.id);
                                            }}
                                            className={`text-left rounded-2xl border p-4 transition-colors ${
                                                track === item.id
                                                    ? 'border-primary/40 bg-primary/15'
                                                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className="text-white font-semibold">{item.label}</div>
                                            <div className="text-xs text-ink-secondary mt-1">{item.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-white">More details</div>
                                        <p className="text-xs text-ink-secondary mt-1">
                                            Add more now, or let Notive learn as you go and change it later in Me.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowOptionalProfile((current) => !current)}
                                        className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.1em] text-ink-secondary hover:text-white"
                                    >
                                        {showOptionalProfile ? 'Hide' : 'Add More'}
                                    </button>
                                </div>

                                {showOptionalProfile && (
                                    <div className="mt-5 space-y-5">
                                        <div>
                                            <p className="text-ink-secondary mb-3">Where are you right now?</p>
                                            <div className="flex flex-wrap gap-2">
                                                {EXPERIENCE_LEVELS.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => setExperienceLevel(item.id)}
                                                        className={`px-4 py-2 rounded-xl border text-sm ${
                                                            experienceLevel === item.id
                                                                ? 'border-primary/40 bg-primary/15 text-white'
                                                                : 'border-white/15 bg-white/5 text-ink-secondary hover:text-white'
                                                        }`}
                                                    >
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-ink-secondary mb-3">How do you want writing to feel?</p>
                                            <div className="space-y-2">
                                                {WRITING_PREFERENCES.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => setWritingPreference(item.id)}
                                                        className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                                                            writingPreference === item.id
                                                                ? 'border-primary/40 bg-primary/15'
                                                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        <div className="text-white font-semibold">{item.label}</div>
                                                        <div className="text-xs text-ink-secondary mt-1">{item.desc}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-ink-secondary mb-3">What do you want to use these notes for later?</p>
                                            <div className="flex flex-wrap gap-2">
                                                {OUTPUT_GOALS.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => toggleOutputGoal(item.id)}
                                                        className={`px-3 py-2 rounded-xl border text-sm ${
                                                            selectedOutputGoals.includes(item.id)
                                                                ? 'border-primary/40 bg-primary/15 text-white'
                                                                : 'border-white/15 bg-white/5 text-ink-secondary hover:text-white'
                                                        }`}
                                                    >
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="starter"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="glass-card p-6 md:p-8 rounded-3xl border border-white/10"
                        >
                            <p className="text-ink-secondary mb-6">Choose an easy first question for your first note.</p>
                            <div className="space-y-3 mb-4">
                                {promptOptions.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        onClick={() => setSelectedPrompt(prompt)}
                                        className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                                            selectedPrompt === prompt
                                                ? 'border-primary/40 bg-primary/15 text-white'
                                                : 'border-white/10 bg-white/5 text-ink-secondary hover:bg-white/10'
                                        }`}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedPrompt('')}
                                className={`text-xs px-3 py-1.5 rounded-lg border ${
                                    selectedPrompt === ''
                                        ? 'border-primary/40 bg-primary/15 text-primary'
                                        : 'border-white/15 text-ink-muted hover:text-white'
                                }`}
                            >
                                Start with a blank note
                            </button>

                            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-ink-secondary">
                                You can bring in old memories later in Me after your first note is saved.
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-5">
                    <button
                        type="button"
                        onClick={goBack}
                        disabled={step === 1 || isSubmitting || isProgressSaving}
                        className="px-4 py-2 rounded-xl text-sm border border-white/15 bg-white/5 text-ink-secondary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Back
                    </button>

                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSaveForLater}
                            disabled={isSubmitting || isProgressSaving}
                            className="px-4 py-2 rounded-xl text-sm border border-white/15 bg-white/[0.03] text-ink-secondary hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isProgressSaving ? 'Saving...' : 'Save for Later'}
                        </button>
                        <Button onClick={goNext} disabled={!canContinue || isSubmitting || isProgressSaving}>
                            {step === 3
                                ? (isSubmitting ? 'Finishing...' : 'Finish Setup')
                                : (isProgressSaving ? 'Saving...' : 'Continue')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" />}>
            <OnboardingPageContent />
        </Suspense>
    );
}
