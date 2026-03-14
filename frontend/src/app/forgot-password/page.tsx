'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Input, Button } from '@/components/ui/form-elements';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { AppPanel } from '@/components/ui/surface';
import { motion } from 'framer-motion';
import { API_URL } from '@/constants/config';
import { getErrorMessage } from '@/utils/http';
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
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Glow Effects */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none"
            />
            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 2
                }}
                className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px] pointer-events-none"
            />

            <FadeIn className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <Link href="/">
                        <motion.h1
                            whileHover={{ scale: 1.05 }}
                            className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent inline-block cursor-pointer"
                        >
                            Notive.
                        </motion.h1>
                    </Link>
                    <p className="text-ink-secondary mt-2">Recover your account.</p>
                </div>

                <AppPanel className="p-8 rounded-3xl border-white/10 shadow-xl shadow-black/20">
                    {!isSubmitted ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="text-center">
                                <span className="mb-4 inline-flex rounded-full bg-white/5 p-3 text-ink-secondary">
                                    <FiLock size={24} aria-hidden="true" />
                                </span>
                                <h2 className="text-xl font-bold text-white mb-2">Forgot Password?</h2>
                                <p className="text-sm text-ink-secondary">
                                    Enter your email address and we'll send you instructions to reset your password.
                                </p>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-surface-2/55 border border-white/15 text-foreground px-4 py-3 rounded-xl text-sm"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <SlideUp delay={0.1}>
                                <Input
                                    id="email"
                                    label="Email Address"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </SlideUp>

                            <SlideUp delay={0.2}>
                                <Button type="submit" className="w-full" isLoading={isLoading}>
                                    Send Reset Instructions
                                </Button>
                            </SlideUp>

                            <SlideUp delay={0.3} className="text-center">
                                <Link
                                    href="/login"
                                    className="text-sm text-ink-secondary hover:text-white transition-colors flex items-center justify-center gap-2"
                                >
                                    <FiArrowLeft size={16} aria-hidden="true" />
                                    Back to Login
                                </Link>
                            </SlideUp>
                        </form>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-6"
                        >
                            <div className="w-20 h-20 bg-surface-2/55 rounded-full flex items-center justify-center mx-auto text-foreground">
                                <FiMail size={32} aria-hidden="true" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
                                <p className="text-ink-secondary">
                                    We've sent password reset instructions to <span className="text-white font-medium">{email}</span>
                                </p>
                            </div>

                            <div className="p-4 bg-white/[0.03] border border-white/10 rounded-xl text-ink-secondary text-xs text-left">
                                <p><strong>Local environment:</strong> if email delivery is mocked, check backend logs for the reset link.</p>
                            </div>

                            <Button
                                onClick={() => setIsSubmitted(false)}
                                variant="secondary"
                                className="w-full"
                            >
                                Try another email
                            </Button>

                            <Link
                                href="/login"
                                className="block text-sm text-primary hover:text-primary/80 transition-colors"
                            >
                                Return to Login
                            </Link>
                        </motion.div>
                    )}
                </AppPanel>
            </FadeIn>
        </div>
    );
}


