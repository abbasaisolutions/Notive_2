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
        <div className="min-h-screen p-6 md:p-12 relative z-10">
            <div className="max-w-6xl mx-auto space-y-8 mt-4">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] uppercase tracking-[0.2em] font-bold border border-primary/20">
                                Essence & Settings
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Your Digital Sanctuary.</h1>
                        <p className="zen-text text-lg max-w-lg">Manage your identity, settings, and track your progression through the cosmic cycles.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/profile/edit" className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-[1.5rem] font-semibold transition-all shadow-xl shadow-primary/20 flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                            Edit Essence
                        </Link>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column - Main Profile Bento */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Identity Widget */}
                        <div className="bento-box p-10 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-all duration-700" />

                            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                                <div className="w-32 h-32 rounded-[2rem] bg-gradient-to-br from-primary via-accent to-secondary p-1">
                                    <div className="w-full h-full rounded-[1.8rem] bg-slate-950 flex items-center justify-center text-4xl text-white font-serif">
                                        {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                <div className="text-center md:text-left flex-1">
                                    <h2 className="text-4xl font-serif mb-2">{user.name || 'Anonymous Soul'}</h2>
                                    <p className="text-slate-500 font-mono text-sm mb-4 tracking-wider">{user.email}</p>
                                    <p className="zen-text text-slate-300 max-w-md italic">
                                        "{user.profile?.bio || 'No life manifesto written yet. Capture your thoughts to synthesize your purpose.'}"
                                    </p>
                                </div>
                            </div>

                            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 pt-8 border-t border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Location</p>
                                        <p className="text-white text-sm">{user.profile?.location || 'The Cosmos'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect width="20" height="14" x="2" y="6" rx="2" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Occupation</p>
                                        <p className="text-white text-sm">{user.profile?.occupation || 'Life Student'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Badges Bento */}
                        {earnedBadges.length > 0 && (
                            <div className="bento-box p-10">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-2xl font-serif">Arhcived Wisdom</h3>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">
                                        {earnedBadges.length} Badges Earned
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {earnedBadges.map((badge) => badge && (
                                        <div key={badge.id} className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary/20 transition-all flex flex-col items-center text-center gap-3">
                                            <span className="text-4xl group-hover:scale-110 transition-transform duration-500 drop-shadow-lg">{badge.icon}</span>
                                            <div className="space-y-1">
                                                <p className="text-white text-xs font-bold uppercase tracking-widest">{badge.name}</p>
                                                <p className="text-[9px] text-slate-500 line-clamp-1">{badge.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Stats & settings */}
                    <div className="lg:col-span-4 space-y-8">
                        {/* Progression Stats Widget */}
                        {stats && (
                            <div className="bento-box p-10 flex flex-col justify-between">
                                <div className="space-y-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-2xl font-serif">Evolution</h3>
                                        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary text-xl font-bold font-serif">
                                            {stats.level}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cosmic XP</p>
                                            <p className="text-sm font-bold text-white tracking-widest">{stats.xp} / {getXPForLevel(stats.level + 1)}</p>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
                                            <div
                                                className="h-full bg-gradient-to-r from-primary via-accent to-secondary rounded-full relative overflow-hidden"
                                                style={{ width: `${Math.min(xpProgress, 100)}%` }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4">
                                        <div className="p-4 rounded-2xl bg-white/5 text-center">
                                            <p className="text-2xl font-serif text-white">{stats.totalEntries || 0}</p>
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Echoes</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 text-center">
                                            <p className="text-2xl font-serif text-white">{stats.currentStreak || 0}</p>
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Day Flow</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quick Settings & Accounts Bento */}
                        <div className="bento-box p-8 space-y-6">
                            <h3 className="text-xl font-serif px-2">Sanctuary Settings</h3>

                            <div className="space-y-2">
                                <button
                                    onClick={toggleTheme}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                                            {theme === 'dark' ? '🌙' : '☀️'}
                                        </div>
                                        <span className="text-sm font-bold text-slate-300 tracking-wider">Luminance</span>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full relative transition-all duration-300 ${theme === 'dark' ? 'bg-slate-700' : 'bg-primary'}`}>
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${theme === 'dark' ? 'left-1' : 'left-5'}`} />
                                    </div>
                                </button>

                                <button
                                    className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center group-hover:scale-110 transition-transform text-lg">
                                            🔔
                                        </div>
                                        <span className="text-sm font-bold text-slate-300 tracking-wider">Sync Alerts</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 uppercase font-bold px-2 py-1 rounded bg-white/5">Active</div>
                                </button>

                                <button
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-red-500/5 transition-all group mt-4 border border-red-500/10"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                        </div>
                                        <span className="text-sm font-bold text-red-400 tracking-wider">Depart Sanctuary</span>
                                    </div>
                                    {isLoggingOut && <div className="animate-spin h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
