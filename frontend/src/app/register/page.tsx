'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Input, Button } from '@/components/ui/form-elements';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { motion } from 'framer-motion';
import { GoogleLogin } from '@react-oauth/google';
import { clearOnboardingState } from '@/utils/onboarding';
import { sanitizeReturnTo } from '@/utils/redirect';
import { resolvePostAuthDestination } from '@/utils/auth-routing';
import { isCredentialSsoEnabled } from '@/utils/sso';

type RegisterFieldErrors = {
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    policies?: string;
};

const SIGNUP_VALUE_POINTS = [
    'Pick what you want Notive to help with',
    'Turn raw notes into patterns and stories',
    'Keep life, school, and work notes in one place',
];

const PASSWORD_GUIDANCE = [
    { id: 'length', label: 'At least 8 characters' },
    { id: 'upper', label: 'One uppercase letter' },
    { id: 'lower', label: 'One lowercase letter' },
    { id: 'digit', label: 'One number' },
];

const hasStrongPassword = (value: string): boolean =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);

export default function RegisterPage() {
    const router = useRouter();
    const { register, loginWithSsoCredential, user, isLoading: authLoading } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [acceptedPolicies, setAcceptedPolicies] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const isGoogleEnabled = isCredentialSsoEnabled('google');
    const [safeReturnTo, setSafeReturnTo] = useState<string | null>(null);

    const passwordChecks = useMemo(() => ({
        length: password.length >= 8,
        upper: /[A-Z]/.test(password),
        lower: /[a-z]/.test(password),
        digit: /\d/.test(password),
    }), [password]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        setSafeReturnTo(sanitizeReturnTo(params.get('returnTo')));
    }, []);

    const resolvePostAuthRoute = useCallback((nextUser?: typeof user) => {
        const resolvedReturnTo = safeReturnTo || (
            typeof window !== 'undefined'
                ? sanitizeReturnTo(new URLSearchParams(window.location.search).get('returnTo'))
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
            const registeredUser = await register(trimmedEmail, password, trimmedName || undefined);
            clearOnboardingState(registeredUser.id);
            router.replace(resolvePostAuthRoute(registeredUser));
        } catch (err: any) {
            setError(err.message || 'Could not create your account.');
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
                throw new Error('Google credential is missing');
            }
            if (!acceptedPolicies) {
                setFieldErrors({ policies: 'Please accept the Terms of Service and Privacy Policy.' });
                throw new Error('Please accept the Terms of Service and Privacy Policy to continue.');
            }

            const registeredUser = await loginWithSsoCredential('google', credentialResponse.credential);
            clearOnboardingState(registeredUser.id);
            router.replace(resolvePostAuthRoute(registeredUser));
        } catch (err: any) {
            setError(err.message || 'Google sign-up failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google sign-up failed. Please try again.');
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden bg-background">
            <motion.div
                animate={{
                    scale: [1, 1.22, 1],
                    opacity: [0.2, 0.42, 0.2],
                    rotate: [0, 90, 0],
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: 'linear',
                }}
                className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[150px] pointer-events-none"
            />
            <motion.div
                animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.2, 0.4, 0.2],
                    rotate: [0, -60, 0],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
                className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,255,255,0.08),transparent_38%),radial-gradient(circle_at_84%_85%,rgba(255,255,255,0.05),transparent_45%)] pointer-events-none" />

            <FadeIn className="w-full max-w-6xl relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-[1.02fr_0.98fr] gap-6 items-stretch">
                    <section className="hidden lg:flex flex-col rounded-[2rem] border border-white/10 bg-gradient-to-br from-surface-2/75 via-surface-1/70 to-surface-1/55 p-8 shadow-2xl shadow-black/25 relative overflow-hidden">
                        <div className="absolute top-[-9rem] left-[-5rem] w-72 h-72 bg-primary/20 rounded-full blur-[95px] pointer-events-none" />
                        <div className="absolute bottom-[-8rem] right-[-4rem] w-72 h-72 bg-secondary/20 rounded-full blur-[95px] pointer-events-none" />

                        <div className="relative z-10 space-y-5">
                            <span className="section-kicker">New Account</span>
                            <h1 className="text-4xl xl:text-5xl text-white leading-tight">Start saving moments and building your story.</h1>
                            <p className="text-base text-ink-secondary">
                                Your setup helps Notive ask better questions, show better patterns, and build useful stories.
                            </p>
                        </div>

                        <div className="relative z-10 mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                            {SIGNUP_VALUE_POINTS.map((point) => (
                                <div key={point} className="flex items-start gap-2 text-sm text-ink-secondary">
                                    <span className="mt-0.5 text-primary">•</span>
                                    <span>{point}</span>
                                </div>
                            ))}
                        </div>

                        <div className="relative z-10 mt-auto rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-primary font-semibold">What Happens Next</p>
                            <p className="text-sm text-ink-secondary mt-2">
                                After sign-up, you will tell Notive what you want help with and pick an easy way to start writing.
                            </p>
                        </div>
                    </section>

                    <div className="glass-card p-6 sm:p-8 rounded-[2rem] border border-white/10 shadow-xl shadow-black/20">
                        <div className="text-center mb-7">
                            <Link href="/">
                                <motion.h1
                                    whileHover={{ scale: 1.03 }}
                                    className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent inline-block"
                                >
                                    Notive.
                                </motion.h1>
                            </Link>
                            <p className="text-ink-muted mt-2">Create your account and start writing notes, seeing patterns, and building stories.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    role="alert"
                                    aria-live="assertive"
                                    className="bg-surface-2/55 border border-white/15 text-ink-muted px-4 py-3 rounded-xl text-sm"
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
                                                className={`rounded-lg border px-3 py-2 text-xs ${met
                                                    ? 'border-white/15 bg-surface-2/55 text-foreground'
                                                    : 'border-white/10 bg-white/[0.03] text-ink-muted'
                                                    }`}
                                            >
                                                {rule.label}
                                            </div>
                                        );
                                    })}
                                </div>
                            </SlideUp>

                            <SlideUp delay={0.4}>
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

                            <SlideUp delay={0.5} className="text-sm text-ink-muted">
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
                                        className="w-4 h-4 mt-0.5 rounded bg-surface-2 border-white/10 text-primary focus:ring-primary/50"
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

                            <SlideUp delay={0.6}>
                                <Button type="submit" className="w-full" isLoading={isLoading}>
                                    Create Account
                                </Button>
                            </SlideUp>
                        </form>

                        <SlideUp delay={0.7} className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase tracking-[0.16em]">
                                <span className="px-4 bg-surface-1/70 text-ink-muted">Or sign up with</span>
                            </div>
                        </SlideUp>

                        {isGoogleEnabled && (
                            <SlideUp delay={0.8} className="flex justify-center">
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={handleGoogleError}
                                    theme="filled_black"
                                    width="300"
                                />
                            </SlideUp>
                        )}
                        {!isGoogleEnabled && (
                            <SlideUp delay={0.8}>
                                <p className="text-center text-xs text-ink-muted">
                                    Google sign-up is unavailable in this environment.
                                </p>
                            </SlideUp>
                        )}

                        <SlideUp delay={0.9}>
                            <p className="text-center mt-6 text-ink-muted">
                                Already have an account?{' '}
                                <Link href={loginHref} className="text-primary hover:text-primary/80 font-medium transition-colors">
                                    Sign in
                                </Link>
                            </p>
                            <p className="mt-3 text-center text-xs text-ink-muted">
                                Need the details first? Read our{' '}
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

