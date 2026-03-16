'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Input, Button } from '@/components/ui/form-elements';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { sanitizeReturnTo } from '@/utils/redirect';
import { resolvePostAuthDestination } from '@/utils/auth-routing';
import { isCredentialSsoEnabled } from '@/utils/sso';

type LoginFieldErrors = {
    email?: string;
    password?: string;
};

const TRUST_POINTS = [
    'Safe sign-in and secure sessions',
    'Your notes, patterns, and stories stay together',
    'One place for life, school, and work stories',
];

const FLOW_STEPS = [
    { title: 'Write', description: 'Save the moment while it is fresh.' },
    { title: 'See', description: 'Notice feelings, habits, and topics.' },
    { title: 'Use', description: 'Turn notes into stories you can use.' },
];

export default function LoginPage() {
    const router = useRouter();
    const { login, loginWithSsoCredential, user, isLoading: authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const isGoogleEnabled = isCredentialSsoEnabled('google');
    const [safeReturnTo, setSafeReturnTo] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        setSafeReturnTo(sanitizeReturnTo(params.get('returnTo')));
        if (params.get('reason') === 'session-expired') {
            setNotice('Your session expired. Please sign in again.');
        } else {
            setNotice(null);
        }
    }, []);

    const resolvePostAuthRoute = useCallback((nextUser?: typeof user) => {
        const resolvedReturnTo = safeReturnTo || (
            typeof window !== 'undefined'
                ? sanitizeReturnTo(new URLSearchParams(window.location.search).get('returnTo'))
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
            router.replace(resolvePostAuthRoute(authenticatedUser));
        } catch (err: any) {
            setError(err.message || 'Could not sign in.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
        try {
            setIsLoading(true);
            if (credentialResponse.credential) {
                const authenticatedUser = await loginWithSsoCredential('google', credentialResponse.credential);
                router.replace(resolvePostAuthRoute(authenticatedUser));
            }
        } catch (err: any) {
            setError(err.message || 'Google sign-in failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google sign-in failed. Please try again.');
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
            <motion.div
                animate={{
                    scale: [1, 1.18, 1],
                    opacity: [0.2, 0.45, 0.2],
                }}
                transition={{
                    duration: 11,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
                className="absolute top-[-8rem] left-[-4rem] w-[30rem] h-[30rem] bg-primary/25 rounded-full blur-[140px] pointer-events-none"
            />
            <motion.div
                animate={{
                    scale: [1, 1.14, 1],
                    opacity: [0.18, 0.35, 0.18],
                }}
                transition={{
                    duration: 14,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 1.3,
                }}
                className="absolute bottom-[-10rem] right-[-4rem] w-[28rem] h-[28rem] bg-secondary/25 rounded-full blur-[140px] pointer-events-none"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.08),transparent_38%),radial-gradient(circle_at_80%_76%,rgba(255,255,255,0.06),transparent_42%)] pointer-events-none" />

            <FadeIn className="w-full max-w-6xl relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch">
                    <section className="hidden lg:flex flex-col rounded-[2rem] border border-white/10 bg-gradient-to-br from-surface-2/75 via-surface-1/70 to-surface-1/55 p-8 shadow-2xl shadow-black/25 relative overflow-hidden">
                        <div className="absolute top-[-10rem] right-[-4rem] w-72 h-72 bg-primary/20 rounded-full blur-[90px] pointer-events-none" />
                        <div className="absolute bottom-[-8rem] left-[-4rem] w-72 h-72 bg-secondary/20 rounded-full blur-[90px] pointer-events-none" />
                        <div className="relative z-10 space-y-6">
                            <span className="section-kicker">Welcome Back</span>
                            <h1 className="text-4xl xl:text-5xl text-white leading-tight">Sign in and come back to your notes, patterns, and stories.</h1>
                            <p className="text-base text-ink-secondary max-w-lg">
                                Notive keeps your notes, patterns, and story building in one place.
                            </p>
                        </div>

                        <div className="relative z-10 mt-6 grid gap-3">
                            {FLOW_STEPS.map((step, index) => (
                                <div
                                    key={step.title}
                                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center justify-between"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-white">{step.title}</p>
                                        <p className="text-xs text-ink-secondary">{step.description}</p>
                                    </div>
                                    <span className="text-xs font-bold tracking-[0.2em] text-primary uppercase">
                                        0{index + 1}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="relative z-10 mt-auto rounded-2xl border border-white/10 bg-surface-1/45 px-4 py-4 space-y-2">
                            {TRUST_POINTS.map((point) => (
                                <div key={point} className="flex items-start gap-2 text-sm text-ink-secondary">
                                    <span className="mt-0.5 text-primary">•</span>
                                    <span>{point}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="glass-card p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-black/20">
                        <div className="text-center mb-7">
                            <Link href="/">
                                <motion.h1
                                    whileHover={{ scale: 1.03 }}
                                    className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent inline-block cursor-pointer"
                                >
                                    Notive.
                                </motion.h1>
                            </Link>
                            <p className="text-ink-secondary mt-2">Sign in to keep writing, seeing patterns, and using your stories.</p>
                        </div>

                        <div className="lg:hidden mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-ink-muted">How Notive Works</p>
                            <p className="text-sm text-white mt-2">Write moments. See patterns. Use your stories.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {notice && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    role="status"
                                    aria-live="polite"
                                    className="bg-surface-2/55 border border-white/15 text-foreground px-4 py-3 rounded-xl text-sm"
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
                                    className="bg-surface-2/55 border border-white/15 text-ink-muted px-4 py-3 rounded-xl text-sm"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <SlideUp delay={0.1}>
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

                            <SlideUp delay={0.2}>
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

                            <SlideUp delay={0.3} className="flex items-center justify-end text-sm">
                                <Link href="/forgot-password" className="text-primary hover:text-primary/80 transition-colors">
                                    Forgot password?
                                </Link>
                            </SlideUp>

                            <SlideUp delay={0.4}>
                                <Button type="submit" className="w-full" isLoading={isLoading}>
                                    Sign In
                                </Button>
                            </SlideUp>
                        </form>

                        <SlideUp delay={0.5} className="relative my-7">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase tracking-[0.16em]">
                                <span className="px-4 bg-surface-1/80 text-ink-muted">Or continue with</span>
                            </div>
                        </SlideUp>

                        {isGoogleEnabled && (
                            <SlideUp delay={0.6} className="flex justify-center">
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={handleGoogleError}
                                    theme="filled_black"
                                    width="300"
                                />
                            </SlideUp>
                        )}
                        {!isGoogleEnabled && (
                            <SlideUp delay={0.6}>
                                <p className="text-center text-xs text-ink-muted">
                                    Google sign-in is unavailable in this environment.
                                </p>
                            </SlideUp>
                        )}

                        <SlideUp delay={0.7}>
                            <p className="text-center mt-6 text-ink-secondary">
                                Don&apos;t have an account?{' '}
                                <Link href={registerHref} className="text-primary hover:text-primary/80 font-medium transition-colors">
                                    Create one
                                </Link>
                            </p>
                            <p className="mt-3 text-center text-xs text-ink-muted">
                                By continuing, you agree to our{' '}
                                <Link href="/terms" className="text-primary hover:text-primary/80 transition-colors">Terms</Link>
                                {' '}and{' '}
                                <Link href="/privacy" className="text-primary hover:text-primary/80 transition-colors">Privacy Policy</Link>.
                            </p>
                        </SlideUp>
                    </div>
                </div>
            </FadeIn>
        </div>
    );
}



