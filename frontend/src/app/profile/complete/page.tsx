'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
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
import { useAuth } from '@/context/auth-context';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import useApi from '@/hooks/use-api';
import { resolvePostAuthDestination } from '@/utils/auth-routing';
import { unwrapSetupReturnTo } from '@/utils/redirect';
import { Spinner } from '@/components/ui';

export default function CompleteProfilePage() {
    const router = useRouter();
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { syncUser } = useAuth();
    const { apiFetch } = useApi();
    const [birthDate, setBirthDate] = useState('');
    const [safeReturnTo, setSafeReturnTo] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [fieldError, setFieldError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const maxBirthDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
        if (authLoading || !user?.profile?.birthDate) return;
        router.replace(resolvePostAuthDestination(user, safeReturnTo));
    }, [authLoading, router, safeReturnTo, user]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setFieldError('');

        if (!birthDate) {
            setFieldError('Date of birth is required.');
            return;
        }

        setIsSaving(true);

        try {
            const response = await apiFetch('/user/profile/basic', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    birthDate,
                }),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok || !data?.user) {
                throw new Error(data?.message || 'Could not save your date of birth.');
            }

            syncUser(data.user);
            router.replace(resolvePostAuthDestination(data.user, safeReturnTo));
        } catch (nextError: any) {
            setError(nextError?.message || 'Could not save your date of birth.');
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
                        src="/images/hero-2.jpg"
                        alt="Teen reviewing a Notive strength, evidence, and readiness table that turns journal notes into clearer college essay material."
                        eyebrow="One quick detail"
                        body="Before we reopen your notebook, add your birthday so Notive can keep age-aware and seasonal reflection cues grounded in the right context."
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.42, ease: 'easeOut' }}
                        className="paper-card app-paper relative rounded-[2rem] p-5 sm:p-8"
                        style={quietNotebookPanelStyle}
                    >
                        <div className="absolute right-5 top-5">
                            <NotebookDoodle name="sprout" accent="sage" className="h-9 w-9 opacity-90" />
                        </div>

                        <div className="pr-12">
                            <NotiveLogo href="/" size="sm" />
                            <p className="mt-6 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[rgb(126,117,103)]">
                                Finish profile
                            </p>
                            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-[rgb(39,35,31)] md:text-[3rem]">
                                Share your date of birth so we can personalize your experience.
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-[rgb(76,70,62)] md:text-base">
                                Your date of birth stays between us. We'll tailor guidance with your school stage, seasonal timing, and reflection cues in mind.
                            </p>
                        </div>

                        <div className="app-paper-soft mt-6 overflow-hidden rounded-[1.5rem] lg:hidden">
                            <Image
                                src="/images/hero-2.jpg"
                                alt="Teen reviewing a Notive strength, evidence, and readiness table that turns journal notes into clearer college essay material."
                                width={1144}
                                height={768}
                                className="h-52 w-full object-cover object-center"
                                sizes="100vw"
                                priority
                            />
                        </div>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                            {error && (
                                <div
                                    className="rounded-xl px-4 py-3 text-sm"
                                    style={{
                                        background: 'rgba(229, 213, 194, 0.52)',
                                        border: '1px solid rgba(160, 139, 118, 0.24)',
                                        color: 'rgb(63 57 51)',
                                    }}
                                >
                                    {error}
                                </div>
                            )}

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

                            <div
                                className="app-paper-soft rounded-[1.4rem] px-4 py-4 text-sm leading-7 text-[rgb(76,70,62)]"
                                style={{
                                    background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(255,251,245,0.72))',
                                    border: '1.5px solid rgba(92,92,92,0.18)',
                                }}
                            >
                                <p>What this unlocks right away:</p>
                                <ul className="mt-2 space-y-2 text-[rgb(93,85,75)]">
                                    <li>Age-aware reflection language that fits better.</li>
                                    <li>Seasonal cues for school-year and life-stage context.</li>
                                    <li>A more grounded base for future personality and horoscope-style summaries.</li>
                                </ul>
                            </div>

                            <Button type="submit" className="w-full" isLoading={isSaving}>
                                Save and continue
                            </Button>
                        </form>
                    </motion.div>
                </div>
            </FadeIn>
        </div>
    );
}
