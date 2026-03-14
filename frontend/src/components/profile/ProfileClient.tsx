'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/context/theme-context';
import { useGamification, BADGES } from '@/context/gamification-context';
import SocialImportPanel from '@/components/import/SocialImportPanel';
import GoogleFitConnection from '@/components/profile/GoogleFitConnection';
import { FadeIn, SlideUp, StaggerContainer } from '@/components/ui/animated-wrappers';
import { motion } from 'framer-motion';
import { Bell, Moon, Sun, Download, Trash2, LogOut, Globe, Briefcase } from 'lucide-react';

function getXPForLevel(level: number) {
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000, 999999];
    return thresholds[Math.min(level - 1, 10)];
}

export default function ProfileClient() {
    const router = useRouter();
    const { user, logout, accessToken, isLoading: authLoading } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { stats, refreshStats } = useGamification();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const [API_URL] = useState(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1');

    useEffect(() => {
        refreshStats();
    }, [refreshStats]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await logout();
        router.push('/login');
    };

    const handleExportData = async () => {
        try {
            const response = await fetch(`${API_URL}/user/export`, {
                headers: { Authorization: `Bearer ${accessToken || localStorage.getItem('accessToken')}` },
            });

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `notive-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export data. Please try again.');
        }
    };

    const handleDeleteAccount = async () => {
        if (!confirm('Are you absolutely sure? This action cannot be undone and will permanently delete all your entries and data.')) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/user/account`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken || localStorage.getItem('accessToken')}` },
            });

            if (!response.ok) throw new Error('Delete failed');

            alert('Your account has been deleted.');
            await logout();
            router.push('/register');
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete account. Please try again.');
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!user) {
        if (typeof window !== 'undefined') router.push('/login');
        return null;
    }

    const earnedBadges = stats?.badges.map((id) => BADGES[id as keyof typeof BADGES]).filter(Boolean) || [];
    const xpProgress = stats ? ((stats.xp - getXPForLevel(stats.level)) / (getXPForLevel(stats.level + 1) - getXPForLevel(stats.level))) * 100 : 0;

    return (
        <div className="min-h-screen p-6 md:p-12 relative z-10">
            <FadeIn className="max-w-7xl mx-auto space-y-8 mt-4">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                    <div className="space-y-4">
                        <SlideUp delay={0.1} className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] uppercase tracking-[0.2em] font-bold border border-primary/20">
                                Profile & Settings
                            </span>
                        </SlideUp>
                        <SlideUp delay={0.2}>
                            <h1 className="text-4xl md:text-5xl font-serif text-white tracking-tight">Your Growth Portfolio.</h1>
                        </SlideUp>
                        <SlideUp delay={0.3}>
                            <p className="zen-text text-lg max-w-lg">Collect your moments, track your growth, and curate your meaningful life story.</p>
                        </SlideUp>
                    </div>
                    <SlideUp delay={0.4} className="flex items-center gap-4">
                        <Link href="/profile/edit">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-[1.5rem] font-semibold transition-all shadow-xl shadow-primary/20 flex items-center gap-3"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                </svg>
                                Edit Profile
                            </motion.button>
                        </Link>
                    </SlideUp>
                </header>

                {/* Profile Card & Stats Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Identity Widget - 2/3 width */}
                    <SlideUp className="lg:col-span-2">
                        <motion.div
                            whileHover={{ scale: 1.005 }}
                            className="bento-box p-8 md:p-10 group relative overflow-hidden transition-all duration-300 h-full"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-all duration-700" />

                            <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                                <motion.div
                                    whileHover={{ rotate: 5 }}
                                    className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-primary via-accent to-secondary p-1 shrink-0"
                                >
                                    <div className="w-full h-full rounded-[1.8rem] bg-slate-950 flex items-center justify-center text-4xl text-white font-serif">
                                        {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                                    </div>
                                </motion.div>
                                <div className="text-center md:text-left flex-1">
                                    <h2 className="text-3xl md:text-4xl font-serif mb-2">{user.name || 'Anonymous User'}</h2>
                                    <p className="text-slate-500 font-mono text-sm mb-3 tracking-wider">{user.email}</p>
                                    <p className="zen-text text-slate-300 max-w-md italic text-sm">
                                        "{user.profile?.bio || 'No bio written yet. Share a bit about yourself.'}"
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-2 gap-4 relative z-10 pt-6 border-t border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                                        <Globe className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Location</p>
                                        <p className="text-white text-sm">{user.profile?.location || 'Unknown'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-500">
                                        <Briefcase className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Occupation</p>
                                        <p className="text-white text-sm">{user.profile?.occupation || 'Unspecified'}</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </SlideUp>

                    {/* Progression Stats Widget - 1/3 width */}
                    {stats && (
                        <SlideUp>
                            <motion.div
                                whileHover={{ scale: 1.005 }}
                                className="bento-box p-8 flex flex-col justify-between transition-all duration-300 h-full"
                            >
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xl font-serif">Growth</h3>
                                        <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/10 text-primary text-lg font-bold font-serif">
                                            {stats.level}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Experience (XP)</p>
                                            <p className="text-xs font-bold text-white tracking-widest">{stats.xp} / {getXPForLevel(stats.level + 1)}</p>
                                        </div>
                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(xpProgress, 100)}%` }}
                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                                className="h-full bg-gradient-to-r from-primary via-accent to-secondary rounded-full relative overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                            </motion.div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <div className="p-4 rounded-2xl bg-white/5 text-center">
                                            <p className="text-2xl font-serif text-white">{stats.totalEntries || 0}</p>
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Entries</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 text-center">
                                            <p className="text-2xl font-serif text-white">{stats.currentStreak || 0}</p>
                                            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Day Streak</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </SlideUp>
                    )}
                </div>

                {/* Badges Section */}
                {earnedBadges.length > 0 && (
                    <SlideUp>
                        <motion.div
                            whileHover={{ scale: 1.005 }}
                            className="bento-box p-8 transition-all duration-300"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-serif">Achievements</h3>
                                <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">
                                    {earnedBadges.length} Badges
                                </span>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                {earnedBadges.map((badge) => badge && (
                                    <motion.div
                                        key={badge.id}
                                        whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.1)' }}
                                        className="group p-4 rounded-2xl bg-white/5 border border-white/5 transition-all flex flex-col items-center text-center gap-2"
                                    >
                                        <span className="text-3xl group-hover:scale-110 transition-transform duration-500 drop-shadow-lg">
                                            {(() => {
                                                const BadgeIcon = badge.icon;
                                                return <BadgeIcon className="w-7 h-7 text-white" />;
                                            })()}
                                        </span>
                                        <p className="text-white text-[10px] font-bold uppercase tracking-widest">{badge.name}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </SlideUp>
                )}

                {/* Horizontal Layout: Social Import, Google Fit, Account Settings */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Social Import Panel */}
                    <SlideUp className="lg:col-span-1">
                        <SocialImportPanel />
                    </SlideUp>

                    {/* Google Fit Connection */}
                    <SlideUp className="lg:col-span-1">
                        <GoogleFitConnection />
                    </SlideUp>

                    {/* Account Settings */}
                    <SlideUp className="lg:col-span-1">
                        <motion.div
                            whileHover={{ scale: 1.005 }}
                            className="bento-box p-6 space-y-4 transition-all duration-300 h-full"
                        >
                            <h3 className="text-lg font-serif px-2">Account Settings</h3>

                            <div className="space-y-1">
                                {/* Theme Toggle */}
                                <motion.button
                                    whileHover={{ x: 3 }}
                                    onClick={toggleTheme}
                                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-slate-700/50 text-slate-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                        </div>
                                        <span className="text-sm font-medium text-slate-300">Theme</span>
                                    </div>
                                    <div className={`w-9 h-5 rounded-full relative transition-all duration-300 ${theme === 'dark' ? 'bg-slate-700' : 'bg-primary'}`}>
                                        <motion.div
                                            layout
                                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300 ${theme === 'dark' ? 'left-0.5' : 'left-4'}`}
                                        />
                                    </div>
                                </motion.button>

                                {/* Notifications */}
                                <motion.button
                                    whileHover={{ x: 3 }}
                                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-slate-700/50 text-slate-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Bell className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-300">Notifications</span>
                                    </div>
                                    <div className="text-[9px] text-slate-500 uppercase font-bold px-2 py-1 rounded bg-white/5">On</div>
                                </motion.button>

                                {/* Export */}
                                <motion.button
                                    whileHover={{ x: 3 }}
                                    onClick={handleExportData}
                                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-slate-700/50 text-slate-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Download className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-300">Export Data</span>
                                    </div>
                                </motion.button>

                                {/* Delete Account */}
                                <motion.button
                                    whileHover={{ x: 3, backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                                    onClick={handleDeleteAccount}
                                    className="w-full flex items-center justify-between p-3 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Trash2 className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium text-red-400">Delete Account</span>
                                    </div>
                                </motion.button>

                                {/* Logout */}
                                <motion.button
                                    whileHover={{ x: 3, backgroundColor: 'rgba(239, 68, 68, 0.05)' }}
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="w-full flex items-center justify-between p-3 rounded-xl transition-all group mt-2 border border-red-500/10"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <LogOut className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-medium text-red-400">Log Out</span>
                                    </div>
                                    {isLoggingOut && <div className="animate-spin h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full" />}
                                </motion.button>
                            </div>
                        </motion.div>
                    </SlideUp>
                </div>
            </FadeIn>
        </div>
    );
}
