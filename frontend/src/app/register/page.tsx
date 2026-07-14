'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { clearOnboardingState } from '@/utils/onboarding';
import { unwrapSetupReturnTo } from '@/utils/redirect';
import { resolvePostAuthDestination } from '@/utils/auth-routing';
import { isNativeCapacitorPlatform } from '@/utils/sso';
import useHasMounted from '@/hooks/use-has-mounted';

const SETUP_STEPS = [
    {
        title: 'Continue with Google',
        detail: 'No new password to invent. Notive never posts anything to your Google account.',
    },
    {
        title: 'Tell us your stage of life',
        detail: 'One quick detail so prompts and examples match your context. Your birthday stays private.',
    },
    {
        title: 'Save your first moment',
        detail: 'Write it, speak it, or import it. From there Notive helps you find what it holds.',
    },
];

const REGISTER_PHRASES = [
    'Opening your notebook…',
    'Taking you to your home dashboard…',
    'Getting everything ready…',
];

export default function RegisterPage() {
    const router = useRouter();
    const { loginWithSsoCredential, user, isLoading: authLoading } = useAuth();
    const hasMounted = useHasMounted();
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
            setError(err.message || 'Google sign-up didn’t go through. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [loginWithSsoCredential, resolvePostAuthRoute, router]);

    const handleGoogleError = useCallback(() => {
        setError('Google sign-up didn’t finish. Please try again.');
    }, []);

    if (hasMounted && isNativeCapacitorPlatform() && (authLoading || !!user)) {
        return (
            <div className="page-paper-canvas min-h-screen" style={quietNotebookPageStyle}>
                <NotiveLoadingScreen phrases={REGISTER_PHRASES} phraseInterval={3200} />
            </div>
        );
    }

    return (
        <div
            className="page-paper-canvas flex min-h-screen items-center px-3 py-6 md:px-5 md:py-10"
            style={quietNotebookPageStyle}
        >
            <FadeIn className="mx-auto w-full max-w-2xl">
                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.42, ease: 'easeOut' }}
                    className="paper-card app-paper relative overflow-hidden rounded-[2rem] p-5 sm:p-8"
                    style={quietNotebookPanelStyle}
                >
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
                        style={{ background: 'rgb(138, 154, 111)' }}
                    />

                    <div className="flex items-start justify-between gap-4">
                        <NotiveLogo href="/" size="sm" />
                        <NotebookDoodle name="quill" accent="sage" className="h-10 w-10 shrink-0 opacity-90" />
                    </div>

                    <p className="type-overline mt-4 text-muted">
                        Create account &middot; Step 1 of 3
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-strong md:text-[2.6rem]">
                        {NOTIVE_VOICE.auth.registerHeading}
                    </h1>
                    <p className="mt-4 text-sm leading-7 text-default md:text-base">
                        {NOTIVE_VOICE.auth.registerBody}
                    </p>

                    <ol className="mt-6 space-y-3">
                        {SETUP_STEPS.map((step, index) => (
                            <li
                                key={step.title}
                                className="flex items-start gap-3 rounded-[1.2rem] border border-[rgba(92,92,92,0.14)] bg-[rgba(255,255,255,0.55)] px-4 py-3"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                                    style={{
                                        background: index === 0 ? 'rgb(138, 154, 111)' : 'rgba(138, 154, 111, 0.16)',
                                        color: index === 0 ? 'rgb(255,251,245)' : 'rgb(96,110,74)',
                                    }}
                                >
                                    {index + 1}
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold text-strong">
                                        {step.title}
                                    </span>
                                    <span className="mt-1 block text-sm leading-6 text-default">
                                        {step.detail}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ol>

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
                    </SlideUp>

                    <SlideUp delay={0.3}>
                        <p className="mt-6 text-center text-sm text-soft">
                            Already have a diary?{' '}
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
            </FadeIn>
        </div>
    );
}
