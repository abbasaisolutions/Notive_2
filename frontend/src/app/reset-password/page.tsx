'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Button } from '@/components/ui/form-elements';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { AppPanel } from '@/components/ui/surface';
import { motion } from 'framer-motion';
import { API_URL } from '@/constants/config';
import { getErrorMessage } from '@/utils/http';
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

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

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
                    <p className="text-ink-secondary mt-2">Reset your password.</p>
                </div>

                <AppPanel className="p-8 rounded-3xl border-white/10 shadow-xl shadow-black/20">
                    {!isSuccess ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="text-center">
                                <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.03]">
                                    <FiKey size={24} className="text-ink-secondary" aria-hidden="true" />
                                </span>
                                <h2 className="text-xl font-bold text-white mb-2">Choose a new password</h2>
                                <p className="text-sm text-ink-secondary">
                                    Make a new password for your account.
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
                                    id="password"
                                    label="New Password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
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
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </SlideUp>

                            <SlideUp delay={0.3}>
                                <Button type="submit" className="w-full" isLoading={isLoading} disabled={!token}>
                                    Save new password
                                </Button>
                            </SlideUp>
                        </form>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center space-y-6"
                        >
                            <div className="w-20 h-20 bg-surface-2/55 rounded-full flex items-center justify-center mx-auto">
                                <FiCheckCircle size={34} className="text-foreground" aria-hidden="true" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Password changed</h2>
                                <p className="text-ink-secondary">
                                    Your password was updated. Sending you to sign in...
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AppPanel>
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


