'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { useGamification, BADGES } from '@/context/gamification-context';

function getXPForLevel(level: number) {
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000, 999999];
    return thresholds[Math.min(level - 1, 10)];
}

export default function ProfilePage() {
    const router = useRouter();
    const { user, logout, isLoading: authLoading } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { stats, refreshStats } = useGamification();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        refreshStats();
    }, [refreshStats]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await logout();
        router.push('/login');
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    const earnedBadges = stats?.badges.map((id) => BADGES[id as keyof typeof BADGES]).filter(Boolean) || [];
    const xpProgress = stats ? ((stats.xp - getXPForLevel(stats.level)) / (getXPForLevel(stats.level + 1) - getXPForLevel(stats.level))) * 100 : 0;

    return (
        <div className="min-h-screen p-4 md:p-8 pb-24 md:pb-8">
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-2xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                            </svg>
                        </Link>
                        <h1 className="text-3xl font-bold text-white">Profile</h1>
                    </div>
                    <Link href="/profile/edit" className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        Edit Profile
                    </Link>
                </div>

                {/* Level & XP Card */}
                {stats && (
                    <div className="glass-card p-6 rounded-2xl mb-6 animate-pulse-glow">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-slate-400 text-sm">Level</p>
                                <p className="text-4xl font-bold text-primary">{stats.level}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-slate-400 text-sm">Total XP</p>
                                <p className="text-2xl font-bold text-white">{stats.xp}</p>
                            </div>
                        </div>
                        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all" style={{ width: `${Math.min(xpProgress, 100)}%` }} />
                        </div>
                        <p className="text-slate-500 text-xs mt-2 text-right">Next level: {getXPForLevel(stats.level + 1)} XP</p>
                    </div>
                )}

                {/* Badges */}
                {earnedBadges.length > 0 && (
                    <div className="glass-card p-6 rounded-2xl mb-6">
                        <h3 className="text-lg font-bold text-white mb-4">🏆 Badges ({earnedBadges.length})</h3>
                        <div className="flex flex-wrap gap-3">
                            {earnedBadges.map((badge) => badge && (
                                <div key={badge.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10" title={badge.description}>
                                    <span className="text-2xl">{badge.icon}</span>
                                    <span className="text-white text-sm">{badge.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Profile Card */}
                <div className="glass-card p-8 rounded-2xl mb-6">
                    <div className="flex items-center gap-6 mb-8">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-3xl text-white font-bold">
                            {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">{user.name || 'Anonymous'}</h2>
                            <p className="text-slate-400">{user.email}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {user.profile?.bio && (
                            <div>
                                <h3 className="text-slate-400 text-sm mb-2">About Me</h3>
                                <p className="text-slate-200 leading-relaxed">{user.profile.bio}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-slate-400">Name</span>
                                <span className="text-white">{user.name || 'Not set'}</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-white/10">
                                <span className="text-slate-400">Email</span>
                                <span className="text-white">{user.email}</span>
                            </div>
                            {user.profile?.occupation && (
                                <div className="flex justify-between items-center py-3 border-b border-white/10">
                                    <span className="text-slate-400">Occupation</span>
                                    <span className="text-white">{user.profile.occupation}</span>
                                </div>
                            )}
                            {user.profile?.location && (
                                <div className="flex justify-between items-center py-3 border-b border-white/10">
                                    <span className="text-slate-400">Location</span>
                                    <span className="text-white">{user.profile.location}</span>
                                </div>
                            )}
                        </div>

                        {user.profile?.lifeGoals && user.profile.lifeGoals.length > 0 && (
                            <div>
                                <h3 className="text-slate-400 text-sm mb-3">Life Goals</h3>
                                <div className="flex flex-wrap gap-2">
                                    {user.profile.lifeGoals.map((goal: string, index: number) => (
                                        <span key={index} className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">
                                            {goal}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center py-3">
                            <span className="text-slate-400">Member since</span>
                            <span className="text-white">{new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* Settings */}
                <div className="glass-card p-6 rounded-2xl mb-6">
                    <h3 className="text-lg font-bold text-white mb-4">Settings</h3>
                    <div className="space-y-2">
                        {/* Theme Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
                                <span className="text-slate-300">Theme</span>
                            </div>
                            <button
                                onClick={toggleTheme}
                                className={`w-14 h-8 rounded-full transition-all relative ${theme === 'dark' ? 'bg-slate-700' : 'bg-primary'}`}
                            >
                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-1' : 'left-7'}`} />
                            </button>
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-4">Account</h3>
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="w-full px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        {isLoggingOut ? (
                            <div className="animate-spin h-5 w-5 border-2 border-red-400 border-t-transparent rounded-full" />
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                Sign Out
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
