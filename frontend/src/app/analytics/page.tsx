'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Stats {
    totalEntries: number;
    totalChapters: number;
    entriesThisWeek: number;
    currentStreak: number;
    longestStreak: number;
    totalWords: number;
}

interface MoodData {
    mood: string;
    count: number;
    percentage: number;
}

const MOOD_COLORS: Record<string, string> = {
    happy: '#22c55e',
    calm: '#06b6d4',
    sad: '#6366f1',
    anxious: '#f59e0b',
    frustrated: '#ef4444',
    thoughtful: '#8b5cf6',
    motivated: '#ec4899',
    tired: '#64748b',
};

const MOOD_EMOJIS: Record<string, string> = {
    happy: '😊',
    calm: '😌',
    sad: '😔',
    anxious: '😰',
    frustrated: '😤',
    thoughtful: '🤔',
    motivated: '💪',
    tired: '😴',
};

export default function AnalyticsPage() {
    const router = useRouter();
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [moods, setMoods] = useState<MoodData[]>([]);
    const [activity, setActivity] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!accessToken) return;

            try {
                const [statsRes, moodsRes, activityRes] = await Promise.all([
                    fetch(`${API_URL}/analytics/stats`, { headers: { Authorization: `Bearer ${accessToken}` } }),
                    fetch(`${API_URL}/analytics/moods`, { headers: { Authorization: `Bearer ${accessToken}` } }),
                    fetch(`${API_URL}/analytics/activity`, { headers: { Authorization: `Bearer ${accessToken}` } }),
                ]);

                if (statsRes.ok) setStats(await statsRes.json());
                if (moodsRes.ok) {
                    const data = await moodsRes.json();
                    setMoods(data.moods);
                }
                if (activityRes.ok) {
                    const data = await activityRes.json();
                    setActivity(data.activity);
                }
            } catch (error) {
                console.error('Failed to fetch analytics:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, [accessToken]);

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

    // Generate last 12 weeks for activity grid
    const weeks = [];
    for (let w = 11; w >= 0; w--) {
        const week = [];
        for (let d = 6; d >= 0; d--) {
            const date = new Date();
            date.setDate(date.getDate() - (w * 7 + d));
            const dateStr = date.toISOString().split('T')[0];
            week.push({ date: dateStr, count: activity[dateStr] || 0 });
        }
        weeks.push(week);
    }

    return (
        <div className="min-h-screen p-4 md:p-8 pb-24 md:pb-8">
            {/* Background Glow */}
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
            <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[150px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                        </svg>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Your Growth</h1>
                        <p className="text-slate-400">Track your journaling journey</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="glass-card p-5 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                                    </div>
                                </div>
                                <p className="text-3xl font-bold text-white">{stats?.totalEntries || 0}</p>
                                <p className="text-sm text-slate-400">Total Entries</p>
                            </div>

                            <div className="glass-card p-5 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4" /><path d="m6.8 14-3.5 2" /><path d="m20.7 16-3.5-2" /><path d="M6.8 10 3.3 8" /><path d="m20.7 8-3.5 2" /><circle cx="12" cy="12" r="4" /></svg>
                                    </div>
                                </div>
                                <p className="text-3xl font-bold text-white">{stats?.currentStreak || 0}</p>
                                <p className="text-sm text-slate-400">Day Streak 🔥</p>
                            </div>

                            <div className="glass-card p-5 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
                                    </div>
                                </div>
                                <p className="text-3xl font-bold text-white">{stats?.longestStreak || 0}</p>
                                <p className="text-sm text-slate-400">Longest Streak</p>
                            </div>

                            <div className="glass-card p-5 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3" /></svg>
                                    </div>
                                </div>
                                <p className="text-3xl font-bold text-white">{(stats?.totalWords || 0).toLocaleString()}</p>
                                <p className="text-sm text-slate-400">Words Written</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Mood Distribution */}
                            <div className="glass-card p-6 rounded-2xl">
                                <h2 className="text-lg font-bold text-white mb-4">Mood Distribution</h2>
                                {moods.length === 0 ? (
                                    <p className="text-slate-400 text-center py-8">Add moods to your entries to see trends</p>
                                ) : (
                                    <div className="space-y-3">
                                        {moods.map((m) => (
                                            <div key={m.mood} className="flex items-center gap-3">
                                                <span className="text-xl">{MOOD_EMOJIS[m.mood] || '😐'}</span>
                                                <div className="flex-1">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-white capitalize">{m.mood}</span>
                                                        <span className="text-slate-400">{m.count} ({m.percentage}%)</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${m.percentage}%`,
                                                                backgroundColor: MOOD_COLORS[m.mood] || '#6366f1',
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Activity Heatmap */}
                            <div className="glass-card p-6 rounded-2xl">
                                <h2 className="text-lg font-bold text-white mb-4">Writing Activity</h2>
                                <p className="text-sm text-slate-400 mb-4">Last 12 weeks</p>
                                <div className="flex gap-1 overflow-x-auto pb-2">
                                    {weeks.map((week, wi) => (
                                        <div key={wi} className="flex flex-col gap-1">
                                            {week.map((day) => (
                                                <div
                                                    key={day.date}
                                                    title={`${day.date}: ${day.count} entries`}
                                                    className="w-3 h-3 rounded-sm transition-colors"
                                                    style={{
                                                        backgroundColor: day.count === 0
                                                            ? 'rgba(255,255,255,0.05)'
                                                            : day.count === 1
                                                                ? 'rgba(99,102,241,0.4)'
                                                                : day.count === 2
                                                                    ? 'rgba(99,102,241,0.6)'
                                                                    : 'rgba(99,102,241,1)',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-end gap-2 mt-3 text-xs text-slate-500">
                                    <span>Less</span>
                                    <div className="w-3 h-3 rounded-sm bg-white/5" />
                                    <div className="w-3 h-3 rounded-sm bg-primary/40" />
                                    <div className="w-3 h-3 rounded-sm bg-primary/60" />
                                    <div className="w-3 h-3 rounded-sm bg-primary" />
                                    <span>More</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="mt-6 glass-card p-6 rounded-2xl">
                            <h2 className="text-lg font-bold text-white mb-4">This Week</h2>
                            <div className="flex items-center gap-4">
                                <div className="text-5xl font-bold text-primary">{stats?.entriesThisWeek || 0}</div>
                                <div>
                                    <p className="text-white">entries written</p>
                                    <p className="text-slate-400 text-sm">Keep up the momentum! 🚀</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
