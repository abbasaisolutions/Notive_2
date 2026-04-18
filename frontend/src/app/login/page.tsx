'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Input, Button } from '@/components/ui/form-elements';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { GoogleSsoPanel } from '@/components/auth/GoogleSsoPanel';
import { motion } from 'framer-motion';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import NotiveLoadingScreen from '@/components/ui/NotiveLoadingScreen';
import {
    quietNotebookPageStyle,
    quietNotebookPanelStyle,
} from '@/components/marketing/NotiveShowcase';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { unwrapSetupReturnTo } from '@/utils/redirect';
import { resolvePostAuthDestination } from '@/utils/auth-routing';
import { isNativeCapacitorPlatform } from '@/utils/sso';

type LoginFieldErrors = {
    email?: string;
    password?: string;
};

const TRUST_POINTS = NOTIVE_VOICE.auth.trustPoints;

const LOGIN_PHRASES = [
    'Welcome back\u2026',
    'Opening your notebook\u2026',
    'Picking up where you left off\u2026',
    'Reconnecting your story\u2026',
    'Almost there\u2026',
];

const SIGNIN_DESKTOP_HERO = '/images/auth-signin-desktop.jpg';
const SIGNIN_MOBILE_HERO = '/images/auth-signin-mobile.jpg';
const AUTH_SIDE_STRIP = '/images/auth-side-strip.jpg';

export default function LoginPage() {
    const router = useRouter();
    const { login, loginWithSsoCredential, user, isLoading: authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const [loginSuccess, setLoginSuccess] = useState(false);
    const [postAuthRoute, setPostAuthRoute] = useState<string | null>(null);
    const [safeReturnTo, setSafeReturnTo] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        setSafeReturnTo(unwrapSetupReturnTo(params.get('returnTo')));
        if (params.get('reason') === 'session-expired') {
            setNotice('Your session expired. Please sign in again.');
        } else {
            setNotice(null);
        }
    }, []);

    const resolvePostAuthRoute = useCallback((nextUser?: typeof user) => {
        const resolvedReturnTo = safeReturnTo || (
            typeof window !== 'undefined'
                ? unwrapSetupReturnTo(new URLSearchParams(window.location.search).get('returnTo'))
                : null
        );
        return resolvePostAuthDestination(nextUser ?? user, resolvedReturnTo);
    }, [safeReturnTo, user]);
    const registerHref = safeReturnTo
        ? `/register?returnTo=${encodeURIComponent(safeReturnTo)}`
        : '/register';

    useEffect(() => {
        if (!authLoading && user) {
            router.replace(resolvePostAuthRoute(user));
        }
    }, [authLoading, user, router, resolvePostAuthRoute]);

    useEffect(() => {
        if (!loginSuccess || !postAuthRoute) return;
        const timer = setTimeout(() => {
            router.replace(postAuthRoute);
        }, 3200);
        return () => clearTimeout(timer);
    }, [loginSuccess, postAuthRoute, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});

        const nextFieldErrors: LoginFieldErrors = {};
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            nextFieldErrors.email = 'Email is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            nextFieldErrors.email = 'Enter a valid email address.';
        }
        if (!password) {
            nextFieldErrors.password = 'Password is required.';
        }
        if (Object.keys(nextFieldErrors).length > 0) {
            setFieldErrors(nextFieldErrors);
            setError('Please fix the highlighted fields and try again.');
            return;
        }

        setIsLoading(true);

        try {
            const authenticatedUser = await login(trimmedEmail, password);
            const dest = resolvePostAuthRoute(authenticatedUser);
            setPostAuthRoute(dest);
            setLoginSuccess(true);
        } catch (err: any) {
            setError(err.message || 'We couldn\u2019t sign you in. Check your email and password, then try again.');
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = useCallback(async (credentialResponse: { credential?: string }) => {
        try {
            setIsLoading(true);
            if (credentialResponse.credential) {
                const authenticatedUser = await loginWithSsoCredential('google', credentialResponse.credential);
                const dest = resolvePostAuthRoute(authenticatedUser);
                setPostAuthRoute(dest);
                setLoginSuccess(true);
            } else {
                setError('Google sign-in didn’t finish. Please try again.');
                setIsLoading(false);
            }
        } catch (err: any) {
            setError(err.message || 'Google sign-in didn\u2019t go through. Please try again.');
            setIsLoading(false);
        }
    }, [loginWithSsoCredential, resolvePostAuthRoute]);

    const handleGoogleError = useCallback(() => {
        setError('Google sign-in didn’t finish. Please try again.');
    }, []);

    if (isNativeCapacitorPlatform() && (authLoading || !!user)) {
        return (
            <div className="page-paper-canvas min-h-screen" style={quietNotebookPageStyle}>
                <NotiveLoadingScreen phrases={LOGIN_PHRASES} phraseInterval={3400} />
            </div>
        );
    }

    if (loginSuccess) {
        return (
            <div className="page-paper-canvas min-h-screen" style={quietNotebookPageStyle}>
                <NotiveLoadingScreen phrases={LOGIN_PHRASES} phraseInterval={3400} />
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
                            <div className="relative h-[18rem] sm:h-[20rem]">
                                <Image
                                    src={SIGNIN_MOBILE_HERO}
                                    alt="Phone mockup of the Notive sign-in screen with welcome-back form fields, showing the notebook-inspired interface people return to on mobile."
                                    fill
                                    priority
                                    sizes="100vw"
                                    className="object-cover object-center"
                                />
                                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(38,34,30,0.08),rgba(38,34,30,0.5))]" />
                                <div className="absolute inset-x-0 top-0 p-4">
                                    <div className="inline-flex rounded-[1rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(255,251,245,0.84)] px-3 py-2">
                                        <NotiveLogo href="/" size="xs" />
                                    </div>
                                </div>
                                <div className="absolute inset-x-0 bottom-0 p-4">
                                    <div className="rounded-[1.4rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(255,251,245,0.82)] p-4 backdrop-blur-sm">
                                        <p className="type-overline text-muted">
                                            Sign in
                                        </p>
                                        <h2 className="mt-2 text-2xl font-semibold leading-[1.08] tracking-[-0.04em] text-strong">
                                            {NOTIVE_VOICE.auth.signInHeroTitle}
                                        </h2>
                                        <p className="mt-2 text-sm leading-6 text-default">
                                            {NOTIVE_VOICE.auth.signInHeroBody}
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
                                src={SIGNIN_DESKTOP_HERO}
                                alt="Phone mockup showing a young person opening Notive sign-in with an Action Brief notebook scene, signaling a return to their notebook before signing in."
                                fill
                                priority
                                sizes="(min-width: 1280px) 32vw, 44vw"
                                className="object-cover object-center"
                            />
                            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(38,34,30,0.08),rgba(38,34,30,0.56))]" />
                            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
                                <div className="rounded-[1rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(255,251,245,0.84)] px-3 py-2 backdrop-blur-sm">
                                    <NotiveLogo href="/" size="xs" />
                                </div>
                                <NotebookDoodle name="sprout" accent="sage" className="h-8 w-8 opacity-90" />
                            </div>
                            <div className="absolute inset-x-0 bottom-0 p-6">
                                <div className="max-w-md rounded-[1.6rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(255,251,245,0.82)] p-5 backdrop-blur-sm">
                                    <p className="type-overline text-muted">
                                        Welcome back
                                    </p>
                                    <h2 className="mt-3 text-[2rem] font-semibold leading-[1.05] tracking-[-0.04em] text-strong">
                                        {NOTIVE_VOICE.auth.signInHeroTitle}
                                    </h2>
                                    <p className="mt-3 text-sm leading-7 text-default">
                                        {NOTIVE_VOICE.auth.signInHeroBody}
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
                                Sign in
                            </p>
                            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-strong md:text-[3rem]">
                                {NOTIVE_VOICE.auth.signInHeading}
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-default md:text-base">
                                {NOTIVE_VOICE.auth.signInBody}
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
                                {TRUST_POINTS.map((point) => (
                                    <div key={point} className="flex items-start gap-3 text-sm leading-6 text-default">
                                        <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--paper-ink-soft))]" />
                                        <span>{point}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {notice && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                role="status"
                                aria-live="polite"
                                className="mt-5 px-4 py-3 rounded-xl text-sm bg-[rgba(var(--paper-sky),0.32)] border border-[rgba(var(--paper-border),0.14)] text-strong"
                            >
                                {notice}
                            </motion.div>
                        )}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                role="alert"
                                aria-live="assertive"
                                className="mt-5 px-4 py-3 rounded-xl text-sm bg-[rgba(var(--paper-apricot),0.32)] border border-[rgba(var(--paper-border),0.14)] text-strong"
                            >
                                {error}
                            </motion.div>
                        )}

                        <SlideUp delay={0.1} className="mt-6">
                            <GoogleSsoPanel
                                mode="login"
                                isLoading={isLoading}
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                            />
                        </SlideUp>

                        <SlideUp delay={0.2} className="relative my-7">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t" style={{ borderColor: 'rgba(var(--paper-border), 0.4)' }}></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase tracking-[0.16em]">
                                <span
                                    className="px-4 text-xs font-semibold bg-[rgba(var(--bg-elevated),0.92)] text-muted"
                                >
                                    Or sign in with email
                                </span>
                            </div>
                        </SlideUp>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <SlideUp delay={0.3}>
                                <Input
                                    id="email"
                                    label="Email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        if (fieldErrors.email) {
                                            setFieldErrors((prev) => ({ ...prev, email: undefined }));
                                        }
                                    }}
                                    error={fieldErrors.email}
                                    required
                                />
                            </SlideUp>

                            <SlideUp delay={0.4}>
                                <Input
                                    id="password"
                                    label="Password"
                                    type="password"
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (fieldErrors.password) {
                                            setFieldErrors((prev) => ({ ...prev, password: undefined }));
                                        }
                                    }}
                                    error={fieldErrors.password}
                                    required
                                />
                            </SlideUp>

                            <SlideUp delay={0.5} className="flex items-center justify-end text-sm">
                                <Link href="/forgot-password" className="text-primary hover:text-primary/80 transition-colors">
                                    Forgot password?
                                </Link>
                            </SlideUp>

                            <SlideUp delay={0.6}>
                                <Button type="submit" className="w-full" isLoading={isLoading}>
                                    Sign In
                                </Button>
                            </SlideUp>
                        </form>

                        <SlideUp delay={0.7}>
                            <p className="text-center mt-6 text-sm text-soft">
                                Don&apos;t have an account?{' '}
                                <Link
                                    href={registerHref}
                                    className="font-semibold text-strong transition-colors hover:opacity-70"
                                >
                                    Sign up with Google
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
                            alt="Vertical notebook reflection strip about a student's journey, reinforcing that Notive sign-in is part of reflection and growth."
                            fill
                            sizes="320px"
                            className="object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(38,34,30,0.08),rgba(38,34,30,0.42))]" />
                        <div className="absolute inset-x-0 bottom-0 p-5">
                            <div className="rounded-[1.35rem] border border-[rgba(92,92,92,0.18)] bg-[rgba(255,251,245,0.82)] p-4 backdrop-blur-sm">
                                <p className="type-overline text-muted">
                                    {NOTIVE_VOICE.auth.sideTitle}
                                </p>
                                <p className="mt-2 text-sm leading-7 text-default">
                                    {NOTIVE_VOICE.auth.sideBody}
                                </p>
                            </div>
                        </div>
                    </aside>
                </div>
            </FadeIn>
        </div>
    );
}



