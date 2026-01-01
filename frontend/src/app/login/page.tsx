'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Input, Button } from '@/components/ui/form-elements';
import { FadeIn, SlideUp } from '@/components/ui/animated-wrappers';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email, password);
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Failed to login');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        try {
            setIsLoading(true);
            if (credentialResponse.credential) {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
                const res = await fetch(`${API_URL}/user/google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ credential: credentialResponse.credential }),
                });

                if (!res.ok) {
                    throw new Error('Google sign-in failed');
                }

                const data = await res.json();
                localStorage.setItem('accessToken', data.accessToken);
                window.location.href = '/dashboard';
            }
        } catch (err: any) {
            setError(err.message || 'Google login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Google login failed. Please check your client ID configuration.');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
            {/* Background Glow Effects */}
<<<<<<< HEAD
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
=======
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
>>>>>>> 9a9c056f33be4adfa1b5521a7d2268f2927d9d5e

            <FadeIn className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
<<<<<<< HEAD
                    <Link href="/" className="inline-block">
                        <Image
                            src="/logos/logo(main-transparent).png"
                            alt="Notive Logo"
                            width={200}
                            height={80}
                            className="mx-auto mt-10 hover:scale-105 transition-transform"
                            priority
                        />
                       
=======
                    <Link href="/">
                        <motion.h1
                            whileHover={{ scale: 1.05 }}
                            className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent inline-block cursor-pointer"
                        >
                            Notive.
                        </motion.h1>
>>>>>>> 9a9c056f33be4adfa1b5521a7d2268f2927d9d5e
                    </Link>
                    <p className="text-cream/60 mt-2">Welcome back! Sign in to continue.</p>
                </div>

                {/* Login Form Card */}
                <div className="glass p-8 rounded-3xl border border-white/5 shadow-xl shadow-black/20">
                    <form onSubmit={handleSubmit} className="space-y-6">
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
                                label="Email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </SlideUp>

                        <SlideUp delay={0.2}>
                            <Input
                                id="password"
                                label="Password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </SlideUp>

<<<<<<< HEAD
                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-cream/60 cursor-pointer">
=======
                        <SlideUp delay={0.3} className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-slate-400 cursor-pointer hover:text-slate-300 transition-colors">
>>>>>>> 9a9c056f33be4adfa1b5521a7d2268f2927d9d5e
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded bg-teal-dark border-cream/10 text-secondary focus:ring-secondary/50"
                                />
                                Remember me
                            </label>
                            <Link href="/forgot-password" className="text-secondary hover:text-secondary/80 transition-colors">
                                Forgot password?
                            </Link>
                        </SlideUp>

                        <SlideUp delay={0.4}>
                            <Button type="submit" className="w-full" isLoading={isLoading}>
                                Sign In
                            </Button>
                        </SlideUp>
                    </form>

                    {/* Divider */}
                    <SlideUp delay={0.5} className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-cream/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-teal-dark/70 text-cream/50">Or continue with</span>
                        </div>
                    </SlideUp>

                    {/* OAuth Buttons */}
                    <SlideUp delay={0.6} className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            theme="filled_black"
                            width="250"
                        />
                    </SlideUp>
                </div>

                {/* Register Link */}
<<<<<<< HEAD
                <p className="text-center mt-6 text-cream/60">
                    Don't have an account?{' '}
                    <Link href="/register" className="text-secondary hover:text-secondary/80 font-medium transition-colors">
                        Create one
                    </Link>
                </p>
            </div>
=======
                <SlideUp delay={0.7}>
                    <p className="text-center mt-6 text-slate-400">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-primary hover:text-primary/80 font-medium transition-colors">
                            Create one
                        </Link>
                    </p>
                </SlideUp>
            </FadeIn>
>>>>>>> 9a9c056f33be4adfa1b5521a7d2268f2927d9d5e
        </div>
    );
}
