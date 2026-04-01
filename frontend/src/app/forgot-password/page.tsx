'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import NotiveLogo from '@/components/ui/NotiveLogo';
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
import { FiArrowLeft, FiLock, FiMail } from 'react-icons/fi';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!res.ok) {
                throw new Error(await getErrorMessage(res, 'Failed to send reset email'));
            }

            setIsSubmitted(true);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to send reset email. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="page-paper-canvas min-h-screen px-3 py-3 md:px-5 md:py-5" style={quietNotebookPageStyle}>
            <FadeIn className="mx-auto w-full max-w-6xl">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
                    <QuietNotebookAuthIllustration
                        src="/images/hero-5.jpg"
                        alt="Teen checking Notive on a phone and keeping one calm next step after a full day."
                        eyebrow="Password help"
                        body="Reset access quietly, return to your notes, and pick up the thread without losing the calm tone of the space."
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
                            <p className="type-overline text-muted">
                                Password reset
                            </p>
                            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-strong md:text-[3rem]">
                                One note today. One clearer tomorrow.
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-default md:text-base">
                                Reset your password, then come back to the notes, patterns, and story pieces you are still building.
                            </p>
                        </div>

                        {!isSubmitted ? (
                            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                                <div className="app-paper-soft rounded-[1.4rem] p-4 text-center">
                                    <span className="mb-3 inline-flex rounded-full border border-[rgba(var(--paper-border),0.18)] bg-white/70 p-3 text-strong">
                                        <FiLock size={24} aria-hidden="true" />
                                    </span>
                                    <h2 className="text-xl font-semibold text-strong">Forgot your password?</h2>
                                    <p className="mt-2 text-sm leading-7 text-soft">
                                        Enter your email and we will send you a reset link.
                                    </p>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="rounded-xl px-4 py-3 text-sm bg-[rgba(var(--paper-apricot),0.32)] border border-[rgba(var(--paper-border),0.14)] text-strong"
                                    >
                                        {error}
                                    </motion.div>
                                )}

                                <SlideUp delay={0.1}>
                                    <Input
                                        id="email"
                                        label="Email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </SlideUp>

                                <SlideUp delay={0.2}>
                                    <Button type="submit" className="w-full" isLoading={isLoading}>
                                        Email reset link
                                    </Button>
                                </SlideUp>

                                <SlideUp delay={0.3} className="text-center">
                                    <Link
                                        href="/login"
                                        className="inline-flex items-center justify-center gap-2 text-sm text-soft transition-colors hover:text-strong"
                                    >
                                        <FiArrowLeft size={16} aria-hidden="true" />
                                        Back to sign in
                                    </Link>
                                </SlideUp>
                            </form>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mt-8 space-y-6 text-center"
                            >
                                <div className="app-paper-soft rounded-[1.5rem] p-6">
                                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(var(--paper-border),0.18)] bg-white/72 text-strong">
                                        <FiMail size={32} aria-hidden="true" />
                                    </div>
                                    <h2 className="mt-4 text-2xl font-semibold text-strong">Check your email</h2>
                                    <p className="mt-2 text-sm leading-7 text-soft">
                                        If this email is in Notive, we sent a reset link to <span className="font-semibold text-strong">{email}</span>.
                                    </p>
                                </div>

                                <div className="app-paper-soft rounded-[1.2rem] p-4 text-left text-xs leading-6 text-soft">
                                    <p><strong className="text-strong">Local setup:</strong> if email is mocked, check backend logs for the reset link.</p>
                                </div>

                                <Button
                                    onClick={() => setIsSubmitted(false)}
                                    variant="secondary"
                                    className="w-full"
                                >
                                    Use another email
                                </Button>

                                <Link
                                    href="/login"
                                    className="block text-sm text-soft transition-colors hover:text-strong"
                                >
                                    Return to sign in
                                </Link>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </FadeIn>
        </div>
    );
}


