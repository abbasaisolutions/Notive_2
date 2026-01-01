'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Input, Button } from '@/components/ui/form-elements';
import { GoogleLogin } from '@react-oauth/google';

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
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Glow Effects */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
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
                    <p className="text-cream/60 mt-2">Welcome back! Sign in to continue.</p>
                </div>

                {/* Login Form Card */}
                <div className="glass p-8 rounded-3xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                                {error}
                            </div>
                        )}

                        <Input
                            id="email"
                            label="Email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        <Input
                            id="password"
                            label="Password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-cream/60 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded bg-teal-dark border-cream/10 text-secondary focus:ring-secondary/50"
                                />
                                Remember me
                            </label>
                            <Link href="/forgot-password" className="text-secondary hover:text-secondary/80 transition-colors">
                                Forgot password?
                            </Link>
                        </div>

                        <Button type="submit" className="w-full" isLoading={isLoading}>
                            Sign In
                        </Button>
                    </form>

                    {/* Divider */}
                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-cream/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-teal-dark/70 text-cream/50">Or continue with</span>
                        </div>
                    </div>

                    {/* OAuth Buttons */}
                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            theme="filled_black"
                            width="250"
                        />
                    </div>
                </div>

                {/* Register Link */}
                <p className="text-center mt-6 text-cream/60">
                    Don't have an account?{' '}
                    <Link href="/register" className="text-secondary hover:text-secondary/80 font-medium transition-colors">
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
}
