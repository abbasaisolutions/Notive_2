'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Input, Button } from '@/components/ui/form-elements';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { motion } from 'framer-motion';
import { GoogleSsoPanel } from '@/components/auth/GoogleSsoPanel';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import {
    quietNotebookPageStyle,
    quietNotebookPanelStyle,
} from '@/components/marketing/NotiveShowcase';
import { clearOnboardingState } from '@/utils/onboarding';
import { unwrapSetupReturnTo } from '@/utils/redirect';
import { resolvePostAuthDestination } from '@/utils/auth-routing';

type RegisterFieldErrors = {
    name?: string;
    email?: string;
    birthDate?: string;
    password?: string;
    confirmPassword?: string;
    policies?: string;
};

const SIGNUP_VALUE_POINTS = [
    'Capture the note while it still feels true',
    'Notice moods, themes, and patterns that keep returning',
    'Save story seeds you can use later for school, work, and growth',
];

const PASSWORD_GUIDANCE = [
    { id: 'length', label: 'At least 8 characters' },
    { id: 'upper', label: 'One uppercase letter' },
    { id: 'lower', label: 'One lowercase letter' },
    { id: 'digit', label: 'One number' },
];

const hasStrongPassword = (value: string): boolean =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);

const REGISTER_HERO = '/images/auth-register-hero.jpg';
const AUTH_SIDE_STRIP = '/images/auth-side-strip.jpg';

export default function RegisterPage() {
    const router = useRouter();
    const { register, loginWithSsoCredential, user, isLoading: authLoading } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [acceptedPolicies, setAcceptedPolicies] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const [safeReturnTo, setSafeReturnTo] = useState<string | null>(null);

    const passwordChecks = useMemo(() => ({
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        digit: /\d/.test(password),
    }), [password]);
    const maxBirthDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});

        const nextFieldErrors: RegisterFieldErrors = {};
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();

        if (trimmedName.length > 120) {
            nextFieldErrors.name = 'Name must be 120 characters or fewer.';
        }
        if (!trimmedEmail) {
            nextFieldErrors.email = 'Email is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            nextFieldErrors.email = 'Enter a valid email address.';
        }
        if (!birthDate) {
            nextFieldErrors.birthDate = 'Date of birth is required.';
        } else if (Number.isNaN(new Date(`${birthDate}T00:00:00.000Z`).getTime())) {
            nextFieldErrors.birthDate = 'Enter a valid birth date.';
        } else {
            const dob = new Date(`${birthDate}T00:00:00.000Z`);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const monthDiff = today.getMonth() - dob.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                age--;
            }
            if (age < 13) {
                nextFieldErrors.birthDate = 'You must be at least 13 years old to create an account.';
            }
        }
        if (!password) {
            nextFieldErrors.password = 'Password is required.';
        } else if (!hasStrongPassword(password)) {
            nextFieldErrors.password = 'Use at least 8 characters with uppercase, lowercase, and a number.';
        }
        if (!confirmPassword) {
            nextFieldErrors.confirmPassword = 'Please confirm your password.';
        } else if (password !== confirmPassword) {
            nextFieldErrors.confirmPassword = 'Passwords do not match.';
        }
        if (!acceptedPolicies) {
            nextFieldErrors.policies = 'Please accept the Terms of Service and Privacy Policy.';
        }

        if (Object.keys(nextFieldErrors).length > 0) {
            setFieldErrors(nextFieldErrors);
            setError('Please fix the highlighted fields and try again.');
            return;
        }

        setIsLoading(true);

        try {
            const registeredUser = await register(trimmedEmail, password, trimmedName || undefined, birthDate);
            clearOnboardingState(registeredUser.id);
            router.replace(resolvePostAuthRoute(registeredUser));
        } catch (err: any) {
            setError(err.message || 'We couldn’t create your account just yet. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
        try {
            setError('');
            setFieldErrors({});
            setIsLoading(true);
            if (!credentialResponse.credential) {
                throw new Error('Google sign-in did not finish. Please try again.');
            }
            if (!acceptedPolicies) {
                setFieldErrors({ policies: 'Please accept the Terms of Service and Privacy Policy.' });
                throw new Error('Please accept the Terms of Service and Privacy Policy to continue.');
            }

            const registeredUser = await loginWithSsoCredential('google', credentialResponse.credential);
            clearOnboardingState(registeredUser.id);
            router.replace(resolvePostAuthRoute(registeredUser));
        } catch (err: any) {
            setError(err.message || 'Google sign-up didn’t go through. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google sign-up didn’t finish. Please try again.');
    };

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
                                        Quiet notebook
                                    </p>
                                    <h2 className="mt-3 text-[2rem] font-semibold leading-[1.05] tracking-[-0.04em] text-strong">
                                        One note today. One clearer tomorrow.
                                    </h2>
                                    <p className="mt-3 text-sm leading-7 text-default">
                                        Start by dropping what happened. Notive keeps the thread, offers one calm next step, and saves the part that helps you grow.
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

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    role="alert"
                                    aria-live="assertive"
                                    className="px-4 py-3 rounded-xl text-sm bg-[rgba(var(--paper-apricot),0.32)] border border-[rgba(var(--paper-border),0.14)] text-strong"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <SlideUp delay={0.1}>
                                <Input
                                    id="name"
                                    label="Name"
                                    type="text"
                                    autoComplete="name"
                                    placeholder="John Doe"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        if (fieldErrors.name) {
                                            setFieldErrors((prev) => ({ ...prev, name: undefined }));
                                        }
                                    }}
                                    error={fieldErrors.name}
                                />
                            </SlideUp>

                            <SlideUp delay={0.2}>
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

                            <SlideUp delay={0.3}>
                                <Input
                                    id="birthDate"
                                    label="Date of birth"
                                    type="date"
                                    autoComplete="bday"
                                    value={birthDate}
                                    max={maxBirthDate}
                                    onChange={(e) => {
                                        setBirthDate(e.target.value);
                                        if (fieldErrors.birthDate) {
                                            setFieldErrors((prev) => ({ ...prev, birthDate: undefined }));
                                        }
                                    }}
                                    error={fieldErrors.birthDate}
                                    required
                                />
                                <p className="mt-2 text-xs leading-5 text-muted">
                                    Shared with us privately. We'll use it for age-aware and seasonal personalization.
                                </p>
                            </SlideUp>

                            <SlideUp delay={0.4}>
                                <Input
                                    id="password"
                                    label="Password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (fieldErrors.password || fieldErrors.confirmPassword) {
                                            setFieldErrors((prev) => ({ ...prev, password: undefined, confirmPassword: undefined }));
                                        }
                                    }}
                                    error={fieldErrors.password}
                                    required
                                />
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {PASSWORD_GUIDANCE.map((rule) => {
                                        const met = passwordChecks[rule.id as keyof typeof passwordChecks];
                                        return (
                                            <div
                                                key={rule.id}
                                                className={`rounded-lg border px-3 py-2 text-xs workspace-pill ${met
                                                    ? 'border-success/40 bg-success/10 text-success'
                                                    : ''
                                                    }`}
                                            >
                                                {rule.label}
                                            </div>
                                        );
                                    })}
                                </div>
                            </SlideUp>

                            <SlideUp delay={0.5}>
                                <Input
                                    id="confirmPassword"
                                    label="Confirm Password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        if (fieldErrors.confirmPassword) {
                                            setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                                        }
                                    }}
                                    error={fieldErrors.confirmPassword}
                                    required
                                />
                            </SlideUp>

                            <SlideUp delay={0.6} className="text-sm text-ink-muted">
                                <label className="flex items-start gap-2 cursor-pointer hover:text-ink-secondary transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={acceptedPolicies}
                                        onChange={(e) => {
                                            setAcceptedPolicies(e.target.checked);
                                            if (fieldErrors.policies) {
                                                setFieldErrors((prev) => ({ ...prev, policies: undefined }));
                                            }
                                        }}
                                        aria-invalid={fieldErrors.policies ? true : undefined}
                                        aria-describedby={fieldErrors.policies ? 'register-policies-error' : undefined}
                                        className="w-4 h-4 mt-0.5 rounded border text-primary focus:ring-primary/50 accent-[rgb(var(--brand))]"
                                        style={{ borderColor: 'rgba(var(--paper-border), 0.7)' }}
                                    />
                                    <span>
                                        I agree to the{' '}
                                        <Link href="/terms" className="text-primary hover:underline">
                                            Terms of Service
                                        </Link>{' '}
                                        and{' '}
                                        <Link href="/privacy" className="text-primary hover:underline">
                                            Privacy Policy
                                        </Link>
                                    </span>
                                </label>
                                {fieldErrors.policies && (
                                    <p id="register-policies-error" role="alert" className="mt-2 text-sm text-ink-muted">
                                        {fieldErrors.policies}
                                    </p>
                                )}
                            </SlideUp>

                            <SlideUp delay={0.65}>
                                <div className="flex items-center justify-center gap-6 py-2 text-xs text-ink-muted">
                                    <span className="flex items-center gap-1.5"><span>🔒</span> Encrypted &amp; secure</span>
                                    <span className="flex items-center gap-1.5"><span>🚫</span> Never sold or shared</span>
                                    <span className="flex items-center gap-1.5"><span>👁️</span> Only you see your notes</span>
                                </div>
                            </SlideUp>

                            <SlideUp delay={0.7}>
                                <Button type="submit" className="w-full" isLoading={isLoading}>
                                    Create Account
                                </Button>
                            </SlideUp>
                        </form>

                        <SlideUp delay={0.8} className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t" style={{ borderColor: 'rgba(var(--paper-border), 0.4)' }}></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase tracking-[0.16em]">
                                <span
                                    className="px-4 text-xs font-semibold bg-[rgba(var(--bg-elevated),0.92)] text-muted"
                                >
                                    Or sign up with
                                </span>
                            </div>
                        </SlideUp>

                        <SlideUp delay={0.9}>
                            <GoogleSsoPanel
                                mode="register"
                                isLoading={isLoading}
                                isBlocked={!acceptedPolicies}
                                blockedMessage="Accept the Terms of Service and Privacy Policy first to enable Google sign-up."
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                            />
                            <p className="mt-3 text-center text-xs leading-5 text-muted">
                                If Google does not share your birthday, we will ask for it right after sign-up.
                            </p>
                        </SlideUp>

                        <SlideUp delay={1}>
                            <p className="text-center mt-6 text-sm text-soft">
                                Already have an account?{' '}
                                <Link href={loginHref} className="font-semibold text-strong transition-colors hover:opacity-70">
                                    Sign in
                                </Link>
                            </p>
                            <p className="mt-3 text-center text-xs leading-6 text-muted">
                                Need the details first? Read our{' '}
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
