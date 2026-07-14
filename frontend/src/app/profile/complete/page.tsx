'use client';

import React, { useEffect, useMemo, useState } from 'react';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FadeIn } from '@/components/ui/animated-wrappers';
import { Input, Button } from '@/components/ui/form-elements';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import {
    QuietNotebookAuthIllustration,
    quietNotebookPageStyle,
    quietNotebookPanelStyle,
} from '@/components/marketing/NotiveShowcase';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { useAuth } from '@/context/auth-context';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useApi from '@/hooks/use-api';
import { resolvePostAuthDestination } from '@/utils/auth-routing';
import { unwrapSetupReturnTo } from '@/utils/redirect';
import { resolveFriendlyMessage } from '@/utils/friendly-errors';
import {
    GENDER_PERSONALIZATION_OPTIONS,
    getGenderPersonalizationLabel,
    type GenderPersonalizationValue,
} from '@/utils/gender-personalization';
import { Spinner } from '@/components/ui';

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};

const buildIdentitySignals = (
    currentSignals: Record<string, unknown> | null | undefined,
    gender: GenderPersonalizationValue | '',
    selfDescription: string
) => {
    const previousSignals = asRecord(currentSignals);
    const previousIdentity = asRecord(previousSignals.identity);
    const now = new Date().toISOString();
    const trimmedSelfDescription = selfDescription.trim();
    const genderLabel = getGenderPersonalizationLabel(gender, trimmedSelfDescription);

    return {
        ...previousSignals,
        version: typeof previousSignals.version === 'number' ? previousSignals.version : 1,
        updatedAt: now,
        identity: {
            ...previousIdentity,
            gender: gender || null,
            genderLabel,
            genderSelfDescription: gender === 'self_describe' ? trimmedSelfDescription : null,
            useGenderForPersonalization: Boolean(gender && gender !== 'prefer_not_to_say' && genderLabel),
            updatedAt: now,
        },
    };
};

const appendProfileBasicsSource = (destination: string): string => {
    if (destination === '/onboarding') {
        return '/onboarding?source=profile-basics';
    }

    if (destination.startsWith('/onboarding?')) {
        const [path, query = ''] = destination.split('?');
        const params = new URLSearchParams(query);
        params.set('source', 'profile-basics');
        return `${path}?${params.toString()}`;
    }

    return destination;
};

export default function CompleteProfilePage() {
    const router = useRouter();
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { syncUser } = useAuth();
    const { apiFetch } = useApi();
    const [birthDate, setBirthDate] = useState('');
    const [gender, setGender] = useState<GenderPersonalizationValue | ''>('');
    const [genderSelfDescription, setGenderSelfDescription] = useState('');
    const [safeReturnTo, setSafeReturnTo] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState('');
    const [genderFieldError, setGenderFieldError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const maxBirthDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const firstName = useMemo(() => {
        const name = user?.name?.trim();
        if (!name) return null;
        return name.split(/\s+/)[0];
    }, [user?.name]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        setSafeReturnTo(unwrapSetupReturnTo(params.get('returnTo')));
    }, []);

    useEffect(() => {
        const nextBirthDate = user?.profile?.birthDate
            ? new Date(user.profile.birthDate).toISOString().slice(0, 10)
            : '';
        setBirthDate(nextBirthDate);
    }, [user?.profile?.birthDate]);

    useEffect(() => {
        const identity = asRecord(user?.profile?.personalizationSignals?.identity);
        const nextGender = typeof identity.gender === 'string'
            ? GENDER_PERSONALIZATION_OPTIONS.find((option) => option.value === identity.gender)?.value || ''
            : '';
        setGender(nextGender);
        setGenderSelfDescription(typeof identity.genderSelfDescription === 'string' ? identity.genderSelfDescription : '');
    }, [user?.profile?.personalizationSignals]);

    useEffect(() => {
        if (authLoading || !user?.profile?.birthDate) return;
        router.replace(resolvePostAuthDestination(user, safeReturnTo));
    }, [authLoading, router, safeReturnTo, user]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setFieldError('');
        setGenderFieldError('');

        if (!birthDate) {
            setFieldError('Date of birth is required.');
            return;
        }

        if (gender === 'self_describe' && !genderSelfDescription.trim()) {
            setGenderFieldError('Add your words, or choose another option.');
            return;
        }

        setIsSaving(true);

        try {
            const response = await apiFetch('/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    birthDate,
                    personalizationSignals: buildIdentitySignals(
                        user?.profile?.personalizationSignals,
                        gender,
                        genderSelfDescription
                    ),
                }),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok || !data?.user) {
                throw new Error(resolveFriendlyMessage(
                    data?.message,
                    'We couldn’t save your profile basics just yet. Please try again.',
                ));
            }

            syncUser(data.user);
            router.replace(appendProfileBasicsSource(resolvePostAuthDestination(data.user, safeReturnTo)));
        } catch (nextError: any) {
            setError(resolveFriendlyMessage(
                nextError,
                'We couldn’t save your profile basics just yet. Please try again.',
            ));
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Spinner size="md" />
            </div>
        );
    }

    return (
        <div className="page-paper-canvas min-h-screen px-3 py-3 md:px-5 md:py-5" style={quietNotebookPageStyle}>
            <FadeIn className="mx-auto w-full max-w-6xl">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
                    <QuietNotebookAuthIllustration
                        eyebrow="One quick detail"
                        body={NOTIVE_VOICE.auth.profileBody}
                        doodle="quill"
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.42, ease: 'easeOut' }}
                        className="paper-card app-paper relative rounded-card-200 p-5 sm:p-8"
                        style={quietNotebookPanelStyle}
                    >
                        <div className="absolute right-5 top-5">
                            <NotebookDoodle name="sprout" accent="sage" className="h-9 w-9 opacity-90" />
                        </div>

                        <div className="pr-12">
                            <NotiveLogo href="/" size="sm" />
                            <p className="mt-6 type-overline text-muted">
                                Finish profile
                            </p>
                            {firstName && (
                                <p className="mt-3 text-sm font-semibold text-[rgb(65,93,76)]">
                                    Welcome, {firstName}. Your Google account is verified.
                                </p>
                            )}
                            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-strong md:text-[3rem]">
                                {NOTIVE_VOICE.auth.profileTitle}
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-default md:text-base">
                                {NOTIVE_VOICE.auth.profileBody}
                            </p>
                        </div>

                        {/* A bar, not inert pills that read as buttons. */}
                        <div
                            className="mt-5 max-w-sm"
                            role="progressbar"
                            aria-valuenow={2}
                            aria-valuemin={1}
                            aria-valuemax={4}
                            aria-valuetext="Step 2 of 4: Basics"
                        >
                            <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(92,92,92,0.12)]">
                                <div className="h-full w-1/2 rounded-full bg-[rgb(var(--brand))]" />
                            </div>
                            <p className="mt-2 text-xs text-muted">Step 2 of 4 &middot; Basics</p>
                        </div>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                            {error && (
                                <div
                                    role="alert"
                                    className="rounded-xl px-4 py-3 text-sm bg-[rgba(var(--paper-apricot),0.32)] border border-[rgba(var(--paper-border),0.14)] text-strong"
                                >
                                    <p>{error}</p>
                                    <p className="mt-1 text-xs text-muted">
                                        Your birthday and gender choices are still here. Try saving again when you are ready.
                                    </p>
                                </div>
                            )}

                            <section
                                className="app-paper-soft space-y-5 rounded-3xl px-4 py-4"
                                aria-labelledby="profile-basics-heading"
                            >
                                <div className="space-y-1">
                                    <p id="profile-basics-heading" className="text-sm font-semibold text-strong">
                                        Personalization basics
                                    </p>
                                    <p className="text-xs leading-5 text-muted">
                                        Date of birth is required for age-appropriate personalization. Gender is optional and only helps Notive avoid assumptions when you choose to share it.
                                    </p>
                                </div>

                                <Input
                                    id="complete-birthDate"
                                    label="Date of birth"
                                    type="date"
                                    autoComplete="bday"
                                    value={birthDate}
                                    max={maxBirthDate}
                                    onChange={(event) => {
                                        setBirthDate(event.target.value);
                                        if (fieldError) {
                                            setFieldError('');
                                        }
                                    }}
                                    error={fieldError}
                                    required
                                />

                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm font-semibold text-strong">Gender, optional</p>
                                        <p className="mt-1 text-xs leading-5 text-muted">
                                            Choose what feels right, self-describe, or skip for now. This is not used for account verification.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {GENDER_PERSONALIZATION_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setGender(option.value)}
                                                className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                                                    gender === option.value
                                                        ? 'border-[rgba(65,93,76,0.46)] bg-[rgba(202,221,208,0.42)] text-strong'
                                                        : 'border-[rgba(92,92,92,0.16)] bg-[rgba(255,251,245,0.72)] text-default hover:bg-[rgba(255,251,245,0.94)]'
                                                }`}
                                                aria-pressed={gender === option.value}
                                            >
                                                <span className="block text-sm font-semibold">{option.label}</span>
                                                <span className="mt-1 block text-xs leading-5 text-muted">{option.description}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {gender === 'self_describe' && (
                                        <Input
                                            id="complete-gender-self-description"
                                            label="How would you like Notive to describe it?"
                                            type="text"
                                            autoComplete="off"
                                            value={genderSelfDescription}
                                            maxLength={80}
                                        onChange={(event) => setGenderSelfDescription(event.target.value)}
                                        onFocus={() => {
                                            if (genderFieldError) {
                                                setGenderFieldError('');
                                            }
                                        }}
                                        placeholder="Your words"
                                        error={genderFieldError}
                                    />
                                )}
                                </div>
                            </section>

                            <div
                                className="app-paper-soft rounded-card-140 px-4 py-4 text-sm leading-7 text-default"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(255,251,245,0.72))',
                                    border: '1.5px solid rgba(92,92,92,0.18)',
                                }}
                            >
                                <p>What this unlocks right away:</p>
                                <ul className="mt-2 space-y-2 text-soft">
                                    <li>Examples and prompts that better match your stage of life.</li>
                                    <li>Optional identity context that helps Notive avoid the wrong assumptions.</li>
                                    <li>More relevant memory, lesson, and story suggestions over time.</li>
                                    <li>Cleaner personalization for future summaries and outputs.</li>
                                </ul>
                            </div>

                            <Button type="submit" className="w-full" isLoading={isSaving}>
                                {isSaving ? 'Saving basics...' : 'Save basics and continue'}
                            </Button>
                        </form>
                    </motion.div>
                </div>
            </FadeIn>
        </div>
    );
}
