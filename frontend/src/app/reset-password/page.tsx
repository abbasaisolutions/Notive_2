'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import NotiveLogo from '@/components/ui/NotiveLogo';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Button } from '@/components/ui/form-elements';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { motion } from 'framer-motion';
import { API_URL } from '@/constants/config';
import { getErrorMessage } from '@/utils/http';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';
import {
    QuietNotebookAuthIllustration,
    quietNotebookPageStyle,
    quietNotebookPanelStyle,
} from '@/components/marketing/NotiveShowcase';
import { FiCheckCircle, FiKey } from 'react-icons/fi';

function ResetPasswordPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!token) {
            setError('This reset link is missing or invalid.');
        }
    }, [token]);

    useEffect(() => {
        return () => {
            if (redirectTimeoutRef.current) {
                clearTimeout(redirectTimeoutRef.current);
            }
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const nextFieldErrors: { password?: string; confirmPassword?: string } = {};

        if (password.length < 8) {
            nextFieldErrors.password = 'Password must be at least 8 characters.';
        }
        if (password !== confirmPassword) {
            nextFieldErrors.confirmPassword = 'Passwords do not match.';
        }
        setFieldErrors(nextFieldErrors);
        if (Object.keys(nextFieldErrors).length > 0) return;

        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            if (!res.ok) {
                throw new Error(await getErrorMessage(res, 'Failed to reset password'));
            }

            setIsSuccess(true);
            redirectTimeoutRef.current = setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Could not reset password. This link may have expired.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="page-paper-canvas min-h-screen px-3 py-3 md:px-5 md:py-5" style={quietNotebookPageStyle}>
            <FadeIn className="mx-auto w-full max-w-6xl">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
                    <QuietNotebookAuthIllustration
                        src="/images/hero-2.jpg"
                        alt="Teen reviewing a Notive strength, evidence, and readiness table that turns journal notes into clearer college essay material."
                        eyebrow="Reset quietly"
                        body="Set a new password, reopen your notebook, and keep the flow feeling calm, competent, and private."
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
                                Set new password
                            </p>
                            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-[rgb(39,35,31)] md:text-[3rem]">
                                One note today. One clearer tomorrow.
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-[rgb(76,70,62)] md:text-base">
                                Make a new password and step back into your notes with the same quiet notebook feeling.
                            </p>
                        </div>

                        {!isSuccess ? (
                            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                                <div className="app-paper-soft rounded-[1.4rem] p-4 text-center">
                                    <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(92,92,92,0.18)] bg-white/72 text-[rgb(58,58,58)]">
                                        <FiKey size={24} aria-hidden="true" />
                                    </span>
                                    <h2 className="text-xl font-semibold text-[rgb(58,58,58)]">Choose a new password</h2>
                                    <p className="mt-2 text-sm leading-7 text-[rgb(107,107,107)]">
                                        Make a new password for your account.
                                    </p>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="rounded-xl px-4 py-3 text-sm"
                                        style={{ background: 'rgba(229, 213, 194, 0.52)', border: '1px solid rgba(160, 139, 118, 0.24)', color: 'rgb(63 57 51)' }}
                                    >
                                        {error}
                                    </motion.div>
                                )}

                                <SlideUp delay={0.1}>
                                    <Input
                                        id="password"
                                        label="New Password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                                        error={fieldErrors.password}
                                        required
                                    />
                                </SlideUp>

                                <SlideUp delay={0.2}>
                                    <Input
                                        id="confirmPassword"
                                        label="Confirm Password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                                        error={fieldErrors.confirmPassword}
                                        required
                                    />
                                </SlideUp>

                                <SlideUp delay={0.3}>
                                    <Button type="submit" className="w-full" isLoading={isLoading} disabled={!token}>
                                        Save new password
                                    </Button>
                                </SlideUp>

                                <SlideUp delay={0.4} className="text-center">
                                    <Link
                                        href="/login"
                                        className="text-sm text-[rgb(93,85,75)] transition-colors hover:text-[rgb(63,57,51)]"
                                    >
                                        Return to sign in
                                    </Link>
                                </SlideUp>
                            </form>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mt-8 text-center"
                            >
                                <div className="app-paper-soft rounded-[1.5rem] p-6">
                                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(92,92,92,0.18)] bg-white/72 text-[rgb(58,58,58)]">
                                        <FiCheckCircle size={34} aria-hidden="true" />
                                    </div>
                                    <h2 className="mt-4 text-2xl font-semibold text-[rgb(58,58,58)]">Password changed</h2>
                                    <p className="mt-2 text-sm leading-7 text-[rgb(107,107,107)]">
                                        Your password was updated. Sending you to sign in...
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </FadeIn>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" />}>
            <ResetPasswordPageContent />
        </Suspense>
    );
}


