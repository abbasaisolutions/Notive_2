'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCamera, FiCpu, FiTrendingUp, FiZap, FiBell, FiMic, FiMapPin, FiCheck, FiX } from 'react-icons/fi';
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
import { unwrapSetupReturnTo } from '@/utils/redirect';
import { Spinner } from '@/components/ui';
import { App } from '@capacitor/app';
import {
    type PermissionKind,
    type AllPermissions,
    checkAllPermissions,
    requestPermission as requestDevicePermission,
    markPermissionsOnboardingDone,
} from '@/services/device-permissions.service';
import { isNativePlatform } from '@/utils/platform';

const GOALS: Array<{ id: OnboardingGoal; icon: IconType; doodle: NotebookDoodleName; label: string; desc: string }> = [
    { id: 'clarity', icon: FiCpu, doodle: 'steady-me', label: 'Clear mind', desc: 'Notice what matters and pick the next step.' },
    { id: 'memory', icon: FiCamera, doodle: 'moon', label: 'Remember life', desc: 'Save moments, feelings, and details worth keeping.' },
    { id: 'growth', icon: FiTrendingUp, doodle: 'see-my-growth', label: 'Grow', desc: 'Notice lessons, habits, and change over time.' },
    { id: 'productivity', icon: FiZap, doodle: 'shape-my-future', label: 'Get things done', desc: 'Save wins, blockers, and stories you can use later.' },
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
    { id: 4, label: 'Permissions' },
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

/* ─── Permission card metadata ──────────────────────── */
const PERMISSION_CARDS: Array<{
    kind: PermissionKind;
    icon: IconType;
    label: string;
    reason: string;
}> = [
    {
        kind: 'notifications',
        icon: FiBell,
        label: 'Notifications',
        reason: 'Gentle nudges to write, daily reflections, and pattern alerts.',
    },
    {
        kind: 'microphone',
        icon: FiMic,
        label: 'Microphone',
        reason: 'Voice capture so you can speak your notes instead of typing.',
    },
    {
        kind: 'location',
        icon: FiMapPin,
        label: 'Location',
        reason: 'Tag entries with where you were — a quiet context layer.',
    },
];

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
    const [permissionStatuses, setPermissionStatuses] = useState<AllPermissions>({
        notifications: 'prompt',
        microphone: 'prompt',
        location: 'prompt',
    });
    const [requestingPermission, setRequestingPermission] = useState<PermissionKind | null>(null);
    const hasHydratedProfileRef = useRef(false);
    const safeReturnTo = useMemo(
        () => unwrapSetupReturnTo(searchParams.get('returnTo')),
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

    const refreshPermissions = useCallback(async () => {
        const result = await checkAllPermissions();
        setPermissionStatuses(result);
    }, []);

    // Check device permissions whenever the permissions step is visible and
    // refresh when the app regains focus in case the user changed OS settings.
    useEffect(() => {
        if (step !== 4) return;

        let cancelled = false;
        const runRefresh = async () => {
            const result = await checkAllPermissions();
            if (!cancelled) {
                setPermissionStatuses(result);
            }
        };

        void runRefresh();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void runRefresh();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        let appListenerPromise: Promise<{ remove: () => Promise<void> } | null> | null = null;
        if (isNativePlatform()) {
            appListenerPromise = App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    void runRefresh();
                }
            }).catch(() => null);
        }

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (appListenerPromise) {
                void appListenerPromise.then((listener) => listener?.remove?.()).catch(() => {});
            }
        };
    }, [step]);

    const handleRequestPermission = async (kind: PermissionKind) => {
        setRequestingPermission(kind);
        try {
            const result = await requestDevicePermission(kind);
            setPermissionStatuses((prev) => ({ ...prev, [kind]: result.status }));
            void refreshPermissions();
        } finally {
            setRequestingPermission(null);
        }
    };

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
        (step === 3 && selectedPrompt !== null) ||
        step === 4; // permissions step is always continuable (skip or grant)
    const maxReachableStep = firstIncompleteStep ?? 4;

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

        // Step 3 → advance to permissions step
        if (step === 3) {
            const saved = await saveStepProgress(step);
            if (!saved) return;
            setStep(4);
            return;
        }

        // Step 4 (permissions) → finish onboarding
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

            // Mark permissions onboarding done only after the profile save
            // succeeds — otherwise a failed save leaves a stale local flag
            // that changes future push-init behavior incorrectly.
            markPermissionsOnboardingDone();

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
                <Spinner size="md" />
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

                <div className="mb-4 text-center">
                    <div className="type-overline text-muted">Setup {step}/4</div>
                    <h1 className="type-display-lg mt-2 text-strong">Choose how Notive should help you first.</h1>
                    <p className="type-body-sm mx-auto mt-3 max-w-2xl text-default">
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
                                    className={`type-label-sm rounded-xl border px-3 py-1.5 transition-colors ${
                                        isActive
                                            ? 'border-primary/40 bg-primary/15 text-strong'
                                            : isAvailable
                                                ? 'workspace-button-outline text-soft'
                                                : 'workspace-pill-muted cursor-not-allowed text-disabled'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {submitError && (
                    <div className="workspace-soft-panel type-body-sm mb-4 rounded-xl px-4 py-3 text-strong">
                        {submitError}
                    </div>
                )}

                {savedNotice && (
                    <div className="type-body-sm mb-4 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-accent">
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
                                        <div className="type-card-title text-strong">More details</div>
                                        <p className="type-micro mt-1 text-default">
                                            Add more now, or let Notive learn as you go and update it later in your profile.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowOptionalProfile((current) => !current)}
                                        className="workspace-button-outline type-label-sm rounded-xl px-3 py-2"
                                    >
                                        {showOptionalProfile ? 'Hide' : 'Add More'}
                                    </button>
                                </div>

                                {showOptionalProfile && (
                                    <div className="mt-5 space-y-5">
                                        <div>
                                            <p className="type-body-sm mb-3 text-default">Where are you right now?</p>
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

                                        <div>
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

                            <div className="workspace-soft-panel type-micro mt-6 rounded-xl p-4 text-default">
                                You can bring in old memories later in Me after your first note is saved.
                            </div>

                            <div className="workspace-soft-panel type-micro mt-3 rounded-xl p-4 text-default space-y-1.5">
                                <p className="font-semibold text-xs">Your journal stays private with us</p>
                                <p className="text-xs opacity-80">
                                    Notes are stored securely and encrypted. We never sell or share what you write.
                                    Only you can see your entries.
                                </p>
                            </div>

                            <div className="workspace-soft-panel type-micro mt-3 rounded-xl p-4 text-default space-y-1.5">
                                <p className="font-semibold text-xs">Notive learns your patterns as you write</p>
                                <p className="text-xs opacity-80">
                                    Vocabulary, emotional range, life balance, and growth language
                                    are tracked privately — just pattern detection from your words.
                                </p>
                                <p className="text-xs opacity-60">
                                    You can connect Spotify and health data later in Me → Privacy &amp; Data.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div
                            key="permissions"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="workspace-panel rounded-3xl p-6 md:p-8"
                        >
                            <p className="type-body-md mb-2 text-default">
                                Give Notive the best start on your device.
                            </p>
                            <p className="type-body-sm mb-6 text-soft">
                                These permissions are optional. Enable what feels useful — you can change them anytime in settings.
                            </p>

                            <div className="space-y-3">
                                {PERMISSION_CARDS.map((card) => {
                                    const status = permissionStatuses[card.kind];
                                    const isGranted = status === 'granted';
                                    const isDenied = status === 'denied';
                                    const isRequesting = requestingPermission === card.kind;
                                    const isUnavailable = status === 'unavailable';
                                    const Icon = card.icon;

                                    return (
                                        <div
                                            key={card.kind}
                                            className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
                                                isGranted
                                                    ? 'border-primary/40 bg-primary/10'
                                                    : isDenied
                                                        ? 'border-[rgba(var(--paper-apricot),0.4)] bg-[rgba(var(--paper-apricot),0.08)]'
                                                        : 'workspace-soft-panel'
                                            }`}
                                        >
                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                                isGranted ? 'bg-primary/20 text-primary' : 'bg-[rgba(var(--paper-border),0.18)] text-soft'
                                            }`}>
                                                <Icon size={20} aria-hidden="true" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="type-card-title text-strong">{card.label}</div>
                                                <div className="type-micro mt-0.5 text-default">{card.reason}</div>
                                            </div>

                                            <div className="shrink-0">
                                                {isGranted && (
                                                    <span className="inline-flex items-center gap-1 type-label-sm text-primary">
                                                        <FiCheck size={16} aria-hidden="true" /> On
                                                    </span>
                                                )}
                                                {isDenied && (
                                                    <span className="inline-flex items-center gap-1 type-label-sm text-soft">
                                                        <FiX size={16} aria-hidden="true" /> Denied
                                                    </span>
                                                )}
                                                {isUnavailable && (
                                                    <span className="type-label-sm text-disabled">N/A</span>
                                                )}
                                                {!isGranted && !isDenied && !isUnavailable && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRequestPermission(card.kind)}
                                                        disabled={isRequesting}
                                                        className="workspace-button-outline type-label-sm rounded-xl px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {isRequesting ? 'Asking\u2026' : 'Enable'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="workspace-soft-panel type-micro mt-6 rounded-xl p-4 text-default space-y-1.5">
                                <p className="font-semibold text-xs">Why these permissions?</p>
                                <p className="text-xs opacity-80">
                                    Notifications remind you to write. Voice lets you speak instead of type.
                                    Location quietly tags where you were when you wrote something meaningful.
                                </p>
                                <p className="text-xs opacity-60">
                                    Nothing is shared. You stay in control in Me → Privacy &amp; Data.
                                </p>
                            </div>
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
                            {step === 4
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
