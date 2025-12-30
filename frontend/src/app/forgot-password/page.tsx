'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Input, Button } from '@/components/ui/form-elements';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { motion } from 'framer-motion';

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
            // Mock API call since endpoint verification was mentioned in plan
            // Replace with actual API call if available: 
            // await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/forgot-password`, { ... })

            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
            setIsSubmitted(true);
        } catch (err: any) {
            setError('Failed to send reset email. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
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
                    <p className="text-slate-400 mt-2">Recover your account.</p>
                </div>

                <div className="glass p-8 rounded-3xl border border-white/5 shadow-xl shadow-black/20">
                    {!isSubmitted ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="text-center">
                                <span className="text-4xl mb-4 block">🔐</span>
                                <h2 className="text-xl font-bold text-white mb-2">Forgot Password?</h2>
                                <p className="text-sm text-slate-400">
                                    Enter your email address and we'll send you instructions to reset your password.
                                </p>
                            </div>

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm"
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
                                    className="text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
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
                            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-4xl">
                                ✉️
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
                                <p className="text-slate-400">
                                    We've sent password reset instructions to <span className="text-white font-medium">{email}</span>
                                </p>
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
                </div>
            </FadeIn>
        </div>
    );
}
