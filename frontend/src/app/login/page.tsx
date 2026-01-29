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
                    credentials: 'include',
                    body: JSON.stringify({ credential: credentialResponse.credential }),
                });

                if (!res.ok) {
                    throw new Error('Google sign-in failed');
                }

                const data = await res.json();
                localStorage.setItem('accessToken', data.accessToken);
                if (data.refreshToken) {
                    localStorage.setItem('refresh_token', data.refreshToken);
                }
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
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-neutral-950">
            {/* Background Glow Effects */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0.3, 0.2],
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute top-0 left-1/4 w-96 h-96 bg-neutral-500/20 rounded-full blur-[120px] pointer-events-none"
            />
            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.2, 0.3, 0.2],
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 2
                }}
                className="absolute bottom-0 right-1/4 w-96 h-96 bg-neutral-600/20 rounded-full blur-[120px] pointer-events-none"
            />

            <FadeIn className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block">
                        <Image
                            src="/logos/logo(main-transparent).png"
                            alt="Notive Logo"
                            width={200}
                            height={80}
                            className="mx-auto mt-10 hover:scale-105 transition-transform"
                            priority
                        />
                    </Link>
                    <p className="text-neutral-400 mt-2">Welcome back! Sign in to continue.</p>
                </div>

                {/* Login Form Card */}
                <div className="bg-neutral-900/60 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-xl shadow-black/20">
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

                        <SlideUp delay={0.3} className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-neutral-400 cursor-pointer hover:text-neutral-300 transition-colors">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-neutral-400 focus:ring-neutral-500/50"
                                />
                                Remember me
                            </label>
                            <Link href="/forgot-password" className="text-neutral-400 hover:text-white transition-colors">
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
                            <div className="w-full border-t border-neutral-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-neutral-900 text-neutral-500">Or continue with</span>
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
                <SlideUp delay={0.7}>
                    <p className="text-center mt-6 text-neutral-400">
                        Don't have an account?{' '}
                        <Link href="/register" className="text-white hover:text-neutral-300 font-medium transition-colors">
                            Create one
                        </Link>
                    </p>
                </SlideUp>
            </FadeIn>
        </div>
    );
}
