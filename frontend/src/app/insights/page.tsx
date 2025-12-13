'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

interface InsightData {
    moodTrend: { date: string; mood: string; score: number }[];
    topPeople: { name: string; count: number; sentiment: number }[];
    topActivities: { activity: string; count: number; category: string }[];
    topThemes: { theme: string; count: number }[];
    emotionBreakdown: { emotion: string; percentage: number; color: string }[];
    weeklyStats: {
        totalEntries: number;
        avgWordCount: number;
        streak: number;
        topMood: string;
    };
    gratitudeItems: string[];
    recentInsights: { type: string; content: string; date: string }[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Mood emoji and color mapping
const moodConfig: Record<string, { emoji: string; color: string }> = {
    happy: { emoji: '😊', color: '#22c55e' },
    sad: { emoji: '😔', color: '#3b82f6' },
    anxious: { emoji: '😰', color: '#f59e0b' },
    calm: { emoji: '😌', color: '#06b6d4' },
    angry: { emoji: '😤', color: '#ef4444' },
    motivated: { emoji: '💪', color: '#8b5cf6' },
    grateful: { emoji: '🙏', color: '#ec4899' },
    tired: { emoji: '😴', color: '#6b7280' },
    hopeful: { emoji: '🌟', color: '#fbbf24' },
    thoughtful: { emoji: '🤔', color: '#8b5cf6' },
};

export default function InsightsPage() {
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const [insights, setInsights] = useState<InsightData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('week');

    useEffect(() => {
        const fetchInsights = async () => {
            if (!accessToken) return;

            try {
                // Fetch entries to generate insights locally
                const response = await fetch(`${API_URL}/entries`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (response.ok) {
                    const data = await response.json();
                    const generatedInsights = generateInsights(data.entries || []);
                    setInsights(generatedInsights);
                }
            } catch (error) {
                console.error('Failed to fetch insights:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInsights();
    }, [accessToken, selectedPeriod]);

    // Generate insights from entries
    const generateInsights = (entries: any[]): InsightData => {
        const now = new Date();
        const periodDays = selectedPeriod === 'week' ? 7 : selectedPeriod === 'month' ? 30 : 365;
        const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

        const filteredEntries = entries.filter(e => new Date(e.createdAt) >= cutoff);

        // Mood trend
        const moodTrend = filteredEntries.map(e => ({
            date: new Date(e.createdAt).toLocaleDateString(),
            mood: e.mood || 'neutral',
            score: getMoodScore(e.mood),
        })).slice(-14);

        // Count moods
        const moodCounts: Record<string, number> = {};
        filteredEntries.forEach(e => {
            if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
        });

        const totalMoods = Object.values(moodCounts).reduce((a, b) => a + b, 0) || 1;
        const emotionBreakdown = Object.entries(moodCounts)
            .map(([emotion, count]) => ({
                emotion,
                percentage: Math.round((count / totalMoods) * 100),
                color: moodConfig[emotion]?.color || '#6b7280',
            }))
            .sort((a, b) => b.percentage - a.percentage);

        // Extract themes from tags
        const tagCounts: Record<string, number> = {};
        filteredEntries.forEach(e => {
            (e.tags || []).forEach((tag: string) => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });

        const topThemes = Object.entries(tagCounts)
            .map(([theme, count]) => ({ theme, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Calculate streak
        let streak = 0;
        const sortedDates = filteredEntries
            .map(e => new Date(e.createdAt).toDateString())
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        const today = new Date().toDateString();
        if (sortedDates[0] === today || sortedDates[0] === new Date(Date.now() - 86400000).toDateString()) {
            streak = 1;
            for (let i = 1; i < sortedDates.length; i++) {
                const prev = new Date(sortedDates[i - 1]);
                const curr = new Date(sortedDates[i]);
                if (prev.getTime() - curr.getTime() === 86400000) {
                    streak++;
                } else {
                    break;
                }
            }
        }

        // Extract gratitude from content
        const gratitudeItems: string[] = [];
        filteredEntries.forEach(e => {
            const matches = e.content?.match(/(?:grateful for|thankful for|blessed to have) ([^.!?]+)/gi);
            if (matches) gratitudeItems.push(...matches.map((m: string) => m.replace(/grateful for|thankful for|blessed to have/i, '').trim()));
        });

        return {
            moodTrend,
            topPeople: [], // Would need NLP for real extraction
            topActivities: [], // Would need NLP for real extraction
            topThemes,
            emotionBreakdown,
            weeklyStats: {
                totalEntries: filteredEntries.length,
                avgWordCount: Math.round(filteredEntries.reduce((sum, e) => sum + (e.content?.split(/\s+/).length || 0), 0) / (filteredEntries.length || 1)),
                streak,
                topMood: emotionBreakdown[0]?.emotion || 'neutral',
            },
            gratitudeItems: gratitudeItems.slice(0, 5),
            recentInsights: filteredEntries.slice(0, 3).map(e => ({
                type: e.mood || 'reflection',
                content: e.content?.substring(0, 100) + '...' || '',
                date: new Date(e.createdAt).toLocaleDateString(),
            })),
        };
    };

    const getMoodScore = (mood: string): number => {
        const scores: Record<string, number> = {
            happy: 9, grateful: 9, motivated: 8, hopeful: 8,
            calm: 7, thoughtful: 6, neutral: 5,
            tired: 4, anxious: 3, sad: 2, angry: 2,
        };
        return scores[mood] || 5;
    };

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">Please log in to view insights</h2>
                    <Link href="/login" className="text-primary hover:underline">Go to Login</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 pb-24">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Your Insights</h1>
                            <p className="text-slate-400">Discover patterns in your journey</p>
                        </div>
                    </div>

                    {/* Period Selector */}
                    <div className="flex gap-2">
                        {(['week', 'month', 'year'] as const).map((period) => (
                            <button
                                key={period}
                                onClick={() => setSelectedPeriod(period)}
                                className={`px-4 py-2 rounded-xl font-medium transition-all ${selectedPeriod === period
                                        ? 'bg-primary text-white'
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                    }`}
                            >
                                {period.charAt(0).toUpperCase() + period.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {insights && (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="glass-card p-6 rounded-2xl">
                                <div className="text-4xl mb-2">📝</div>
                                <div className="text-3xl font-bold text-white">{insights.weeklyStats.totalEntries}</div>
                                <div className="text-slate-400 text-sm">Entries</div>
                            </div>
                            <div className="glass-card p-6 rounded-2xl">
                                <div className="text-4xl mb-2">🔥</div>
                                <div className="text-3xl font-bold text-white">{insights.weeklyStats.streak}</div>
                                <div className="text-slate-400 text-sm">Day Streak</div>
                            </div>
                            <div className="glass-card p-6 rounded-2xl">
                                <div className="text-4xl mb-2">📖</div>
                                <div className="text-3xl font-bold text-white">{insights.weeklyStats.avgWordCount}</div>
                                <div className="text-slate-400 text-sm">Avg Words</div>
                            </div>
                            <div className="glass-card p-6 rounded-2xl">
                                <div className="text-4xl mb-2">{moodConfig[insights.weeklyStats.topMood]?.emoji || '😊'}</div>
                                <div className="text-xl font-bold text-white capitalize">{insights.weeklyStats.topMood}</div>
                                <div className="text-slate-400 text-sm">Top Mood</div>
                            </div>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Mood Trend */}
                            <div className="glass-card p-6 rounded-2xl">
                                <h2 className="text-xl font-bold text-white mb-4">Mood Journey</h2>
                                <div className="flex items-end gap-1 h-32">
                                    {insights.moodTrend.map((day, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                            <div
                                                className="w-full rounded-t-lg transition-all"
                                                style={{
                                                    height: `${day.score * 10}%`,
                                                    backgroundColor: moodConfig[day.mood]?.color || '#6b7280',
                                                }}
                                                title={`${day.date}: ${day.mood}`}
                                            />
                                            <span className="text-[10px] text-slate-500">{day.date.split('/')[1]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Emotion Breakdown */}
                            <div className="glass-card p-6 rounded-2xl">
                                <h2 className="text-xl font-bold text-white mb-4">Emotion Breakdown</h2>
                                <div className="space-y-3">
                                    {insights.emotionBreakdown.slice(0, 5).map((emotion, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="text-2xl">{moodConfig[emotion.emotion]?.emoji || '😐'}</span>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-white capitalize">{emotion.emotion}</span>
                                                    <span className="text-slate-400">{emotion.percentage}%</span>
                                                </div>
                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${emotion.percentage}%`,
                                                            backgroundColor: emotion.color,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Top Themes */}
                            <div className="glass-card p-6 rounded-2xl">
                                <h2 className="text-xl font-bold text-white mb-4">Life Themes</h2>
                                <div className="flex flex-wrap gap-2">
                                    {insights.topThemes.map((theme, i) => (
                                        <span
                                            key={i}
                                            className="px-4 py-2 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full text-white font-medium"
                                            style={{ fontSize: `${Math.max(14, 20 - i * 2)}px` }}
                                        >
                                            #{theme.theme} ({theme.count})
                                        </span>
                                    ))}
                                    {insights.topThemes.length === 0 && (
                                        <p className="text-slate-400">Start journaling to see your themes!</p>
                                    )}
                                </div>
                            </div>

                            {/* Gratitude Wall */}
                            <div className="glass-card p-6 rounded-2xl">
                                <h2 className="text-xl font-bold text-white mb-4">🙏 Gratitude Wall</h2>
                                <div className="space-y-2">
                                    {insights.gratitudeItems.map((item, i) => (
                                        <div key={i} className="p-3 bg-white/5 rounded-xl text-slate-300">
                                            "{item}"
                                        </div>
                                    ))}
                                    {insights.gratitudeItems.length === 0 && (
                                        <p className="text-slate-400">Express gratitude in your entries to fill this wall!</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* AI Reflection */}
                        <div className="mt-8 glass-card p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-3xl">🤖</span>
                                <h2 className="text-xl font-bold text-white">Weekly Reflection</h2>
                            </div>
                            <div className="text-slate-300 leading-relaxed">
                                {insights.weeklyStats.totalEntries > 0 ? (
                                    <>
                                        <p className="mb-3">
                                            This {selectedPeriod}, you've written <strong className="text-white">{insights.weeklyStats.totalEntries} entries</strong>,
                                            with an average of <strong className="text-white">{insights.weeklyStats.avgWordCount} words</strong> each.
                                        </p>
                                        <p className="mb-3">
                                            Your dominant mood has been <strong className="text-white capitalize">{insights.weeklyStats.topMood}</strong> {moodConfig[insights.weeklyStats.topMood]?.emoji},
                                            appearing in {insights.emotionBreakdown[0]?.percentage || 0}% of your entries.
                                        </p>
                                        {insights.weeklyStats.streak > 0 && (
                                            <p className="mb-3">
                                                🔥 You're on a <strong className="text-white">{insights.weeklyStats.streak}-day streak</strong>! Keep the momentum going.
                                            </p>
                                        )}
                                        {insights.topThemes.length > 0 && (
                                            <p>
                                                Your mind has been focused on: <strong className="text-white">{insights.topThemes.map(t => t.theme).join(', ')}</strong>.
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p>Start journaling to unlock personalized insights and reflections!</p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
