'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { motion } from 'framer-motion';
import { GoogleSsoPanel } from '@/components/auth/GoogleSsoPanel';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';
import {
    quietNotebookPageStyle,
    quietNotebookPanelStyle,
} from '@/components/marketing/NotiveShowcase';
import { clearOnboardingState } from '@/utils/onboarding';
import { unwrapSetupReturnTo } from '@/utils/redirect';
import { resolvePostAuthDestination } from '@/utils/auth-routing';
import { isNativeCapacitorPlatform } from '@/utils/sso';

const SIGNUP_VALUE_POINTS = [
    'Capture the note while it still feels true',
    'Notice moods, themes, and patterns that keep returning',
    'Save story seeds you can use later for school, work, and growth',
];
const REGISTER_PHRASES = [
    'Opening your notebook\u2026',
    'Taking you to your home dashboard\u2026',
    'Getting everything ready\u2026',
];

const REGISTER_HERO = '/images/auth-register-hero.jpg';
const AUTH_SIDE_STRIP = '/images/auth-side-strip.jpg';

export default function RegisterPage() {
    const router = useRouter();
    const { loginWithSsoCredential, user, isLoading: authLoading } = useAuth();
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [safeReturnTo, setSafeReturnTo] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        setSafeReturnTo(unwrapSetupReturnTo(params.get('returnTo')));
    }, []);

    const resolvePostAuthRoute = useCallback((nextUser?: typeof user) => {
        const resolvedReturnTo = safeReturnTo || (
            typeof window !== 'undefined'
                ? unwrapSetupReturnTo(new URLSearchParams(window.location.search).get('returnTo'))
                : null
        );
        return resolvePostAuthDestination(nextUser ?? user, resolvedReturnTo);
    }, [safeReturnTo, user]);
    const loginHref = safeReturnTo
        ? `/login?returnTo=${encodeURIComponent(safeReturnTo)}`
        : '/login';

    useEffect(() => {
        if (!authLoading && user) {
            router.replace(resolvePostAuthRoute(user));
        }
    }, [authLoading, user, router, resolvePostAuthRoute]);

    const handleGoogleSuccess = useCallback(async (credentialResponse: { credential?: string }) => {
        try {
            setError('');
            setIsLoading(true);
            if (!credentialResponse.credential) {
                throw new Error('Google sign-in did not finish. Please try again.');
            }

            const registeredUser = await loginWithSsoCredential('google', credentialResponse.credential);
            clearOnboardingState(registeredUser.id);
            router.replace(resolvePostAuthRoute(registeredUser));
        } catch (err: any) {
            setError(err.message || 'Google sign-up didn\u2019t go through. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [loginWithSsoCredential, resolvePostAuthRoute, router]);

    const handleGoogleError = useCallback(() => {
        setError('Google sign-up didn\u2019t finish. Please try again.');
    }, []);

    if (isNativeCapacitorPlatform() && (authLoading || !!user)) {
        return (
            <div className="page-paper-canvas min-h-screen" style={quietNotebookPageStyle}>
                <NotiveLoadingScreen phrases={REGISTER_PHRASES} phraseInterval={3200} />
            </div>
        );
    }

    return (
        <div className="page-paper-canvas min-h-screen px-3 py-3 md:px-5 md:py-5" style={quietNotebookPageStyle}>
            <FadeIn className="mx-auto w-full max-w-[88rem]">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                        <div
                            className="paper-card app-paper overflow-hidden rounded-[2rem] lg:hidden"
                            style={quietNotebookPanelStyle}
                        >
                            <div className="relative h-[19rem] sm:h-[21rem]">
                                <Image
                                    src={REGISTER_HERO}
                                    alt="Teen writing a first Notive note on a phone, beginning account creation with one note today and one clearer tomorrow."
                                    fill
                                    priority
                                    sizes="100vw"
                                    className="object-cover object-center"
                                />
                                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(38,34,30,0.08),rgba(38,34,30,0.52))]" />
                                <div className="absolute inset-x-0 top-0 p-4">
                                    <div className="inline-flex rounded-[1rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(255,251,245,0.84)] px-3 py-2">
                                        <NotiveLogo href="/" size="xs" />
                                    </div>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 p-4">
                                    <div className="rounded-[1.4rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(255,251,245,0.82)] p-4 backdrop-blur-sm">
                                        <p className="type-overline text-muted">
                                            Create account
                                        </p>
                                        <h2 className="mt-2 text-2xl font-semibold leading-[1.08] tracking-[-0.04em] text-strong">
                                            One note today. One clearer tomorrow.
                                        </h2>
                                        <p className="mt-2 text-sm leading-6 text-default">
                                            Your first note does not need to be polished. It just needs to be true enough to start.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            className="paper-card app-paper relative hidden overflow-hidden rounded-[2rem] lg:flex lg:min-h-[42rem]"
                            style={quietNotebookPanelStyle}
                        >
                            <Image
                                src={REGISTER_HERO}
                                alt="Teen writing a first Notive note on a phone, beginning account creation with one note today and one clearer tomorrow."
                                fill
                                priority
                                sizes="(min-width: 1280px) 32vw, 44vw"
                                className="object-cover object-center"
                            />
                            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(38,34,30,0.08),rgba(38,34,30,0.5))]" />
                            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
                                <div className="rounded-[1rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(255,251,245,0.84)] px-3 py-2 backdrop-blur-sm">
                                    <NotiveLogo href="/" size="xs" />
                                </div>
                                <NotebookDoodle name="sprout" accent="sage" className="h-8 w-8 opacity-90" />
                            </div>
                            <div className="absolute inset-x-0 bottom-0 p-6">
                                <div className="max-w-md rounded-[1.6rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(255,251,245,0.82)] p-5 backdrop-blur-sm">
                                    <p className="type-overline text-muted">
                                        Private notebook
                                    </p>
                                    <h2 className="mt-3 text-[2rem] font-semibold leading-[1.05] tracking-[-0.04em] text-strong">
                                        One note today. One clearer tomorrow.
                                    </h2>
                                    <p className="mt-3 text-sm leading-7 text-default">
                                        Start by dropping what happened. Notive keeps the thread, offers one clear next step, and saves the part that helps you grow.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

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
                            <p className="type-overline text-muted">
                                Create account
                            </p>
                            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-strong md:text-[3rem]">
                                One note today. One clearer tomorrow.
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-default md:text-base">
                                Open a private home for the moments, patterns, and story pieces you want to keep.
                            </p>
                        </div>

                        <div
                            className="app-paper-soft mt-5 rounded-[1.4rem] px-4 py-4"
                            style={{
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.84), rgba(255,251,245,0.72))',
                                border: '1.5px solid rgba(92,92,92,0.18)',
                            }}
                        >
                            <div className="space-y-3">
                                {SIGNUP_VALUE_POINTS.map((point) => (
                                    <div key={point} className="flex items-start gap-3 text-sm leading-6 text-default">
                                        <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--paper-ink-soft))]" />
                                        <span>{point}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                role="alert"
                                aria-live="assertive"
                                className="mt-5 px-4 py-3 rounded-xl text-sm bg-[rgba(var(--paper-apricot),0.32)] border border-[rgba(var(--paper-border),0.14)] text-strong"
                            >
                                {error}
                            </motion.div>
                        )}

                        <SlideUp delay={0.1} className="mt-6">
                            <GoogleSsoPanel
                                mode="register"
                                isLoading={isLoading}
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                            />
                            <p className="mt-3 text-center text-xs leading-5 text-muted">
                                If Google does not share your birthday, we will ask for it right after sign-up.
                            </p>
                        </SlideUp>

                        <SlideUp delay={0.2}>
                            <div className="flex items-center justify-center gap-6 py-4 text-xs text-ink-muted">
                                <span className="flex items-center gap-1.5"><span>🔒</span> Encrypted &amp; secure</span>
                                <span className="flex items-center gap-1.5"><span>🚫</span> Never sold or shared</span>
                                <span className="flex items-center gap-1.5"><span>👁️</span> Only you see your notes</span>
                            </div>
                        </SlideUp>

                        <SlideUp delay={0.3}>
                            <p className="text-center mt-2 text-sm text-soft">
                                Already have an account?{' '}
                                <Link href={loginHref} className="font-semibold text-strong transition-colors hover:opacity-70">
                                    Sign in
                                </Link>
                            </p>
                            <p className="mt-3 text-center text-xs leading-6 text-muted">
                                By continuing, you agree to our{' '}
                                <Link href="/terms" className="underline text-soft transition-colors hover:opacity-70">Terms</Link>
                                {' '}and{' '}
                                <Link href="/privacy" className="underline text-soft transition-colors hover:opacity-70">Privacy Policy</Link>.
                            </p>
                        </SlideUp>
                    </motion.div>

                    <aside
                        className="paper-card app-paper relative hidden overflow-hidden rounded-[2rem] xl:flex"
                        style={quietNotebookPanelStyle}
                    >
                        <Image
                            src={AUTH_SIDE_STRIP}
                            alt="Vertical notebook reflection strip about a student's journey, reinforcing that Notive registration is part of reflection and growth."
                            fill
                            sizes="320px"
                            className="object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(38,34,30,0.08),rgba(38,34,30,0.42))]" />
                        <div className="absolute inset-x-0 bottom-0 p-5">
                            <div className="rounded-[1.35rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(255,251,245,0.82)] p-4 backdrop-blur-sm">
                                <p className="type-overline text-muted">
                                    Start a trusted notebook
                                </p>
                                <p className="mt-2 text-sm leading-7 text-default">
                                    The notes you write here can quietly become story evidence for school, work, and the person you are becoming.
                                </p>
                            </div>
                        </div>
                    </aside>
                </div>
            </FadeIn>
        </div>
    );
}
