'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCamera, FiCpu, FiLock, FiTrendingUp, FiZap } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { NotebookDoodle, type NotebookDoodleName } from '@/components/dashboard/NotebookDoodles';
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
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { unwrapSetupReturnTo } from '@/utils/redirect';
import { Spinner } from '@/components/ui';

const GOALS: Array<{ id: OnboardingGoal; icon: IconType; doodle: NotebookDoodleName; label: string; desc: string }> = [
    { id: 'clarity', icon: FiCpu, doodle: 'steady-me', label: NOTIVE_VOICE.onboarding.goalLabels.clarity, desc: NOTIVE_VOICE.onboarding.goalDescriptions.clarity },
    { id: 'memory', icon: FiCamera, doodle: 'moon', label: NOTIVE_VOICE.onboarding.goalLabels.memory, desc: NOTIVE_VOICE.onboarding.goalDescriptions.memory },
    { id: 'growth', icon: FiTrendingUp, doodle: 'see-my-growth', label: NOTIVE_VOICE.onboarding.goalLabels.growth, desc: NOTIVE_VOICE.onboarding.goalDescriptions.growth },
    { id: 'productivity', icon: FiZap, doodle: 'shape-my-future', label: NOTIVE_VOICE.onboarding.goalLabels.productivity, desc: NOTIVE_VOICE.onboarding.goalDescriptions.productivity },
];

const TRACKS: Array<{ id: OnboardingTrack; label: string; desc: string }> = [
    { id: 'life', label: 'Life', desc: 'Relationships, health, home, and everyday moments.' },
    { id: 'career', label: 'Study and work', desc: 'Projects, learning, tasks, and future opportunities.' },
    { id: 'both', label: 'Both', desc: 'A mix of life, study, and work.' },
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
    { id: 'college-statement', label: 'Personal statement' },
    { id: 'resume-stories', label: 'Resume stories' },
    { id: 'interview-examples', label: 'Interview stories' },
    { id: 'portfolio', label: 'Stories for study or work' },
];

const STARTER_PROMPTS: Record<OnboardingGoal, Record<OnboardingTrack, string[]>> = {
    clarity: {
        life: [
            'What happened today that feels important to understand?',
            'Which moment today keeps standing out to me?',
        ],
        career: [
            'What happened today at school or work that is worth understanding better?',
            'Which task or conversation from today still feels unfinished in my head?',
        ],
        both: [
            'What moment today touched both my life and my future?',
            'What am I still trying to make sense of from today?',
        ],
    },
    memory: {
        life: [
            'What moment from today do I want to remember?',
            'Who was there, and what did they say or do?',
        ],
        career: [
            'What did I make, learn, or improve today?',
            'What was hard about it, and how did I get through?',
        ],
        both: [
            'What happened today that shaped both my life and future?',
            'How did today actually feel while I was in it?',
        ],
    },
    growth: {
        life: [
            'What did this moment teach me about myself today?',
            'What strength or skill showed up in how I handled today?',
        ],
        career: [
            'What skill did I practice today, and what does it show?',
            'What challenge today gave me useful evidence about how I work?',
        ],
        both: [
            'What lesson from today could matter later in life or work?',
            'What does today show about the way I handle real situations?',
        ],
    },
    productivity: {
        life: [
            'What from today might become useful later?',
            'What would I tell someone facing the same day tomorrow?',
        ],
        career: [
            'What did I do today that I could point to as evidence?',
            'What would I do differently if I ran today again?',
        ],
        both: [
            'What from today could be useful again in another context?',
            'If today became one sentence in my story, what would it say?',
        ],
    },
};

const TOTAL_STEPS = 3;

const STEP_NAMES: Record<number, string> = {
    1: 'Your goal',
    2: 'Your focus',
    3: 'Your first question',
};

type ProfileSnapshot = {
    birthDate?: string | null;
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
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 4) return 1;
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

const getAgeFromBirthDate = (birthDate: string | null | undefined): number | null => {
    if (!birthDate) return null;
    const parsed = new Date(birthDate);
    if (Number.isNaN(parsed.getTime())) return null;

    const now = new Date();
    let age = now.getFullYear() - parsed.getUTCFullYear();
    const monthDelta = now.getMonth() - parsed.getUTCMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < parsed.getUTCDate())) {
        age -= 1;
    }

    return age >= 0 ? age : null;
};

const shouldSuggestStudent = (birthDate: string | null | undefined): boolean => {
    const age = getAgeFromBirthDate(birthDate);
    return age !== null && age <= 22;
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
        () => unwrapSetupReturnTo(searchParams.get('returnTo')),
        [searchParams]
    );
    const arrivedFromProfileBasics = searchParams.get('source') === 'profile-basics';

    const promptOptions = useMemo(() => {
        if (!goal || !track) return [];
        return STARTER_PROMPTS[goal][track];
    }, [goal, track]);
    const ageSuggestsStudent = shouldSuggestStudent(user?.profile?.birthDate || null);

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
        } else if (shouldSuggestStudent(profile.birthDate || null)) {
            setExperienceLevel('student');
            setShowOptionalProfile(true);
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

    useEffect(() => {
        if (!arrivedFromProfileBasics) return;
        setSavedNotice(ageSuggestsStudent
            ? 'Basics saved. We suggested Student from your birthday; change it anytime if that is not right.'
            : 'Basics saved. Now choose how Notive should help you first.');
    }, [ageSuggestsStudent, arrivedFromProfileBasics]);

    const canContinue =
        (step === 1 && !!goal) ||
        (step === 2 && !!track) ||
        (step === 3 && selectedPrompt !== null);

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
                throw new Error(data?.message || 'Couldn\u2019t save your progress. Please try again.');
            }

            return true;
        } catch (error: any) {
            setSubmitError(error?.message || 'Couldn\u2019t save your progress. Please try again.');
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

        // Steps 1–3: save progress and advance
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
                throw new Error(data?.message || 'Couldn\u2019t finish setup. Please try again.');
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
            setSubmitError(error?.message || 'Couldn\u2019t finish setup. Please try again.');
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
                <Spinner size="md" />
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return (
        <div
            className="page-paper-canvas relative flex min-h-screen items-center justify-center overflow-hidden px-4"
            style={{
                // Keep content clear of the status bar and the Android gesture/nav
                // bar — the step used to run right under both.
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
            }}
        >
            {/* Ruled-line paper texture — matches auth page aesthetic */}
            <div className="pointer-events-none absolute inset-0" style={{
                backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(141,123,105,0.07) 27px, rgba(141,123,105,0.07) 28px)',
                backgroundSize: '100% 28px',
            }} />

            <div className="w-full max-w-4xl relative z-10">
                <div className="mb-3 flex items-center justify-between">
                    <NotiveLogo href="/onboarding" size="xs" />
                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="workspace-button-outline type-label-sm rounded-xl px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                </div>

                <div className="mb-5 text-center">
                    <h1 className="type-display-lg text-strong">Choose how Notive should help you first.</h1>
                    <p className="type-body-sm mx-auto mt-3 max-w-2xl text-default">
                        Pick your goal, choose the part of life to focus on, and start with one easy first question for your first note.
                    </p>

                    {/*
                        A bar, not chips. The previous step indicators were styled with
                        borders and fills that read as buttons while being inert (or
                        disabled), so the screen looked full of dead controls.
                    */}
                    <div
                        className="mx-auto mt-5 max-w-sm"
                        role="progressbar"
                        aria-valuenow={step}
                        aria-valuemin={1}
                        aria-valuemax={TOTAL_STEPS}
                        aria-valuetext={`Step ${step} of ${TOTAL_STEPS}: ${STEP_NAMES[step]}`}
                    >
                        <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(92,92,92,0.12)]">
                            <motion.div
                                className="h-full rounded-full bg-primary"
                                initial={false}
                                animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                                transition={{ duration: 0.35, ease: 'easeOut' }}
                            />
                        </div>
                        <p className="type-micro mt-2 text-muted">
                            Step {step} of {TOTAL_STEPS} &middot; {STEP_NAMES[step]}
                        </p>
                    </div>
                </div>

                {submitError && (
                    <div role="alert" className="workspace-soft-panel type-body-sm mb-4 rounded-xl px-4 py-3 text-strong">
                        <p>{submitError}</p>
                        <p className="mt-1 text-xs text-muted">Your selections are still here. Try again when the connection settles.</p>
                    </div>
                )}

                {savedNotice && (
                    <div role="status" className="type-body-sm mb-4 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-accent">
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
                            className="workspace-panel rounded-3xl p-6 md:p-8"
                        >
                            <p className="type-body-md mb-6 text-default">What do you want Notive to help with first?</p>
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
                                        className={`relative text-left rounded-2xl border p-4 overflow-hidden transition-colors ${
                                            goal === item.id
                                                ? 'border-primary/40 bg-primary/15'
                                                : 'workspace-soft-panel'
                                        }`}
                                    >
                                        <div className="pointer-events-none absolute right-3 top-3 opacity-25 sprout-accent">
                                            <NotebookDoodle name={item.doodle} accent="sage" size={52} />
                                        </div>
                                        <div className="relative">
                                            <div className="type-card-title text-strong">{item.label}</div>
                                            <div className="type-body-sm mt-1 text-default">{item.desc}</div>
                                        </div>
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
                            className="workspace-panel rounded-3xl p-6 md:p-8 space-y-6"
                        >
                            <div>
                                <p className="type-body-md mb-3 text-default">What part of life should Notive focus on first?</p>
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
                                                    : 'workspace-soft-panel'
                                            }`}
                                        >
                                            <div className="type-card-title text-strong">{item.label}</div>
                                            <div className="type-body-sm mt-1 text-default">{item.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="workspace-soft-panel rounded-2xl p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="type-card-title text-strong">Optional profile details</div>
                                            <p className="type-micro mt-1 text-default">
                                            Add a little more now, or let Notive learn as you write and update this later in settings.
                                            </p>
                                        </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowOptionalProfile((current) => !current)}
                                        className="workspace-button-outline type-label-sm rounded-xl px-3 py-2"
                                    >
                                        {showOptionalProfile ? 'Hide optional details' : 'Add optional details'}
                                    </button>
                                </div>

                                {showOptionalProfile && (
                                    <div className="mt-5 space-y-5">
                                        <div>
                                            <p className="type-body-sm mb-3 text-default">Where are you right now?</p>
                                            {ageSuggestsStudent && !user?.profile?.experienceLevel && (
                                                <p className="mb-3 text-xs leading-5 text-muted">
                                                    We suggested Student from your birthday to save a tap. Pick another option if it fits better.
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                {EXPERIENCE_LEVELS.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => setExperienceLevel(item.id)}
                                                        className={`type-label-md rounded-xl border px-4 py-2 ${
                                                            experienceLevel === item.id
                                                                ? 'border-primary/40 bg-primary/15 text-strong'
                                                                : 'workspace-button-outline text-soft'
                                                        }`}
                                                    >
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="type-body-sm mb-3 text-default">How do you want writing to feel?</p>
                                            <div className="space-y-2">
                                                {WRITING_PREFERENCES.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => setWritingPreference(item.id)}
                                                        className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                                                            writingPreference === item.id
                                                                ? 'border-primary/40 bg-primary/15'
                                                                : 'workspace-soft-panel'
                                                        }`}
                                                    >
                                                        <div className="type-card-title text-strong">{item.label}</div>
                                                        <div className="type-body-sm mt-1 text-default">{item.desc}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                    </div>
                                )}

                                {/* Output goals — always visible */}
                                <div className="mt-5">
                                    <p className="type-body-sm mb-3 text-default">What do you want to use these notes for later?</p>
                                    <div className="flex flex-wrap gap-2">
                                        {OUTPUT_GOALS.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => toggleOutputGoal(item.id)}
                                                className={`type-label-md rounded-xl border px-3 py-2 ${
                                                    selectedOutputGoals.includes(item.id)
                                                        ? 'border-primary/40 bg-primary/15 text-strong'
                                                        : 'workspace-button-outline text-soft'
                                                }`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Portfolio preview — shown when career goals selected */}
                                    {selectedOutputGoals.some(g =>
                                        ['resume-stories', 'interview-examples', 'college-statement', 'portfolio'].includes(g)
                                    ) && (
                                        <div className="mt-4 rounded-2xl border border-[rgba(var(--paper-border),0.5)] bg-[rgba(var(--paper-border),0.08)] p-4">
                                            <p className="type-overline text-muted mb-3">What your notes become</p>
                                            <div className="rounded-xl bg-white/60 p-3 mb-2">
                                                <p className="text-xs text-muted mb-1">Resume bullet &middot; extracted from a note about your internship</p>
                                                <p className="text-sm text-strong font-medium" style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                                                    &ldquo;Coordinated cross-team communication during product launch, reducing missed handoffs by identifying recurring blockers across 3 weekly standups.&rdquo;
                                                </p>
                                            </div>
                                            <div className="rounded-xl bg-white/60 p-3">
                                                <p className="text-xs text-muted mb-1">Interview story &middot; Situation + Action extracted</p>
                                                <p className="text-sm text-strong font-medium" style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}>
                                                    &ldquo;When our timeline shifted, I took the lead on re-scoping the deliverables...&rdquo;
                                                </p>
                                            </div>
                                            <p className="mt-3 text-xs text-muted">
                                                Notive extracts this from what you write &mdash; no extra steps.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div
                            key="starter"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="workspace-panel rounded-3xl p-6 md:p-8"
                        >
                            <p className="type-body-md mb-6 text-default">Choose an easy first question for your first note.</p>
                            <div className="space-y-3 mb-4">
                                {promptOptions.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        onClick={() => setSelectedPrompt(prompt)}
                                        className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                                            selectedPrompt === prompt
                                                ? 'border-primary/40 bg-primary/15 text-strong'
                                                : 'workspace-soft-panel text-default'
                                        }`}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedPrompt('')}
                                className={`type-label-sm rounded-lg border px-3 py-1.5 ${
                                    selectedPrompt === ''
                                        ? 'border-primary/40 bg-primary/15 text-primary'
                                        : 'workspace-button-outline text-muted'
                                }`}
                            >
                                Start with a blank note
                            </button>

                            {/*
                                One line, not three panels. Privacy is already stated on the
                                landing and register screens; repeating it in full on every
                                surface crowded the step and read as an ad.
                            */}
                            <p className="type-micro mt-6 flex items-start gap-2 text-muted">
                                <FiLock className="mt-0.5 shrink-0" size={13} aria-hidden="true" />
                                <span>
                                    Notes are encrypted and private to you.{' '}
                                    <Link href="/privacy" className="underline transition-opacity hover:opacity-70">
                                        How your writing is used
                                    </Link>
                                </span>
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-5">
                    <button
                        type="button"
                        onClick={goBack}
                        disabled={step === 1 || isSubmitting || isProgressSaving}
                        className="workspace-button-outline type-label-md rounded-xl px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Back
                    </button>

                    <div className="ml-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSaveForLater}
                            disabled={isSubmitting || isProgressSaving}
                            className="workspace-button-outline type-label-md rounded-xl px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {isProgressSaving ? 'Saving...' : 'Save for Later'}
                        </button>
                        <Button onClick={goNext} disabled={!canContinue || isSubmitting || isProgressSaving}>
                            {step === 3
                                ? (isSubmitting ? 'Starting...' : 'Start Writing')
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
