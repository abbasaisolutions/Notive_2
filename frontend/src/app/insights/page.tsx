'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAnalytics } from '@/hooks/useAnalytics';
import { getMoodIcon, getMoodColor } from '@/constants/moods';
import { SkeletonCard, SkeletonStat } from '@/components/ui/SkeletonLoader';
import HealthInsightsPanel from '@/components/insights/HealthInsightsPanel';
import { BarChart3, Bot, BookOpen, Flame, Frown, Heart, PenLine, Smile, Sparkles, Target, TrendingUp } from 'lucide-react';

export default function InsightsPage() {
    const router = useRouter();
    const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('week');

    // Use optimized analytics hook - single source of truth
    const { analytics, isLoading, error } = useAnalytics(selectedPeriod);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-neutral-950 pb-24">
                <div className="max-w-6xl mx-auto px-4 py-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-neutral-800 rounded-xl animate-pulse" />
                            <div>
                                <div className="h-8 w-48 bg-neutral-800 rounded animate-pulse mb-2" />
                                <div className="h-4 w-64 bg-neutral-800 rounded animate-pulse" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[1, 2, 3, 4].map(i => <SkeletonStat key={i} />)}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <Frown className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Oops! Something went wrong</h2>
                    <p className="text-neutral-400 mb-6">{error}</p>
                    <button
                        onClick={() => router.refresh()}
                        className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Empty state - encourage users to journal
    if (analytics.totalEntries === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="max-w-2xl w-full">
                    <div className="bento-box p-12 text-center">
                        {/* Animated icon */}
                        <div className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center animate-float">
                            <BarChart3 className="w-16 h-16 text-white" />
                        </div>

                        <h2 className="text-3xl font-serif text-white mb-4">
                            Your Insights Await! <Sparkles className="inline-block w-6 h-6 text-white" />
                        </h2>

                        <p className="zen-text text-lg max-w-md mx-auto mb-8">
                            Start journaling to unlock powerful insights about your mood patterns,
                            personal growth, and life themes. The more you write, the more you'll discover!
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Link
                                href="/entry/new"
                                className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-[1.5rem] font-semibold transition-all shadow-xl shadow-primary/20 flex items-center gap-3"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" x2="12" y1="5" y2="19" />
                                    <line x1="5" x2="19" y1="12" y2="12" />
                                </svg>
                                Write Your First Entry
                            </Link>

                            <Link
                                href="/dashboard"
                                className="text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
                            >
                                Back to Dashboard
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m9 18 6-6-6-6" />
                                </svg>
                            </Link>
                        </div>

                        {/* Quick tips */}
                        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                            <div className="p-4 rounded-xl bg-white/5">
                                <Smile className="w-6 h-6 mb-2 text-white" />
                                <h4 className="text-sm font-bold text-white mb-1">Track Your Mood</h4>
                                <p className="text-xs text-neutral-400">See patterns in your emotional journey</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5">
                                <Target className="w-6 h-6 mb-2 text-white" />
                                <h4 className="text-sm font-bold text-white mb-1">Identify Themes</h4>
                                <p className="text-xs text-neutral-400">Discover what matters most to you</p>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5">
                                <TrendingUp className="w-6 h-6 mb-2 text-white" />
                                <h4 className="text-sm font-bold text-white mb-1">Measure Growth</h4>
                                <p className="text-xs text-neutral-400">Watch your progress over time</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-neutral-950 pb-24">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 rounded-xl hover:bg-white/10 transition-colors touch-target">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
                                <path d="m15 18-6-6 6-6" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Your Insights</h1>
                            <p className="text-neutral-400">Discover patterns in your journey</p>
                        </div>
                    </div>

                    {/* Period Selector */}
                    <div className="flex gap-2">
                        {(['week', 'month', 'year'] as const).map((period) => (
                            <button
                                key={period}
                                onClick={() => setSelectedPeriod(period)}
                                className={`px-4 py-2 rounded-xl font-medium transition-all touch-target ${selectedPeriod === period
                                    ? 'bg-primary text-white'
                                    : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                                    }`}
                            >
                                {period.charAt(0).toUpperCase() + period.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="glass-card p-6 rounded-2xl">
                        <PenLine className="w-8 h-8 mb-2 text-white" />
                        <div className="text-3xl font-bold text-white">{analytics.totalEntries}</div>
                        <div className="text-neutral-400 text-sm">Entries</div>
                    </div>
                    <div className="glass-card p-6 rounded-2xl">
                        <Flame className="w-8 h-8 mb-2 text-white" />
                        <div className="text-3xl font-bold text-white">{analytics.currentStreak}</div>
                        <div className="text-neutral-400 text-sm">Day Streak</div>
                        {analytics.currentStreak >= 7 && (
                            <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Goal achieved!
                            </div>
                        )}
                    </div>
                    <div className="glass-card p-6 rounded-2xl">
                        <BookOpen className="w-8 h-8 mb-2 text-white" />
                        <div className="text-3xl font-bold text-white">{analytics.avgWordCount}</div>
                        <div className="text-neutral-400 text-sm">Avg Words</div>
                    </div>
                    <div className="glass-card p-6 rounded-2xl">
                        {(() => {
                            const TopMoodIcon = getMoodIcon(analytics.topMood);
                            return <TopMoodIcon className="w-8 h-8 mb-2 text-white" />;
                        })()}
                        <div className="text-xl font-bold text-white capitalize">{analytics.topMood}</div>
                        <div className="text-neutral-400 text-sm">Top Mood</div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Mood Journey */}
                    <div className="glass-card p-6 rounded-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Mood Journey</h2>
                        {analytics.moodTrend.length > 0 ? (
                            <div className="flex items-end gap-1 h-32">
                                {analytics.moodTrend.map((day, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                        <div
                                            className="w-full rounded-t-lg transition-all hover:opacity-80 cursor-pointer"
                                            style={{
                                                height: `${day.score * 10}%`,
                                                backgroundColor: getMoodColor(day.mood),
                                            }}
                                            title={`${day.date}: ${day.mood}`}
                                        />
                                        <span className="text-[10px] text-neutral-500 group-hover:text-white transition-colors">
                                            {day.date.split('/')[1]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-neutral-400 text-center py-8">No mood data yet</p>
                        )}
                    </div>

                    {/* Emotion Breakdown */}
                    <div className="glass-card p-6 rounded-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Emotion Breakdown</h2>
                        <div className="space-y-3">
                            {analytics.emotionBreakdown.slice(0, 5).map((emotion, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    {(() => {
                                        const MoodIcon = getMoodIcon(emotion.emotion);
                                        return <MoodIcon className="w-6 h-6 text-white" />;
                                    })()}
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-white capitalize">{emotion.emotion}</span>
                                            <span className="text-neutral-400">{emotion.percentage}%</span>
                                        </div>
                                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${emotion.percentage}%`,
                                                    backgroundColor: getMoodColor(emotion.emotion),
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
                            {analytics.topThemes.map((theme, i) => (
                                <span
                                    key={i}
                                    className="px-4 py-2 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full text-white font-medium hover:from-primary/30 hover:to-secondary/30 transition-all cursor-pointer"
                                    style={{ fontSize: `${Math.max(14, 20 - i * 2)}px` }}
                                >
                                    #{theme.theme} ({theme.count})
                                </span>
                            ))}
                            {analytics.topThemes.length === 0 && (
                                <p className="text-neutral-400 w-full text-center py-4">
                                    Add tags to your entries to see themes!
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Gratitude Wall */}
                    <div className="glass-card p-6 rounded-2xl">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Heart className="w-5 h-5" /> Gratitude Wall
                        </h2>
                        <div className="space-y-2">
                            {analytics.gratitudeItems.map((item, i) => (
                                <div key={i} className="p-3 bg-white/5 rounded-xl text-neutral-300 italic">
                                    "{item}"
                                </div>
                            ))}
                            {analytics.gratitudeItems.length === 0 && (
                                <p className="text-neutral-400 text-center py-4">
                                    Express gratitude in your entries to fill this wall!
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* AI Reflection */}
                <div className="mt-8 glass-card p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10">
                    <div className="flex items-center gap-3 mb-4">
                        <Bot className="w-7 h-7 text-white" />
                        <h2 className="text-xl font-bold text-white">AI Reflection</h2>
                    </div>
                    <div className="text-neutral-300 leading-relaxed">
                        {analytics.totalEntries > 0 ? (
                            <>
                                <p className="mb-3">
                                    This {selectedPeriod}, you've written <strong className="text-white">{analytics.totalEntries} entries</strong>,
                                    with an average of <strong className="text-white">{analytics.avgWordCount} words</strong> each.
                                </p>
                                <p className="mb-3">
                                    Your dominant mood has been <strong className="text-white capitalize">{analytics.topMood}</strong>{' '}
                                    {(() => {
                                        const TopMoodIcon = getMoodIcon(analytics.topMood);
                                        return <TopMoodIcon className="inline-block w-4 h-4 text-white" />;
                                    })()},
                                    appearing in {analytics.emotionBreakdown[0]?.percentage || 0}% of your entries.
                                </p>
                                {analytics.currentStreak > 0 && (
                                    <p className="mb-3">
                                        <Flame className="inline-block w-4 h-4 text-white" /> You're on a{' '}
                                        <strong className="text-white">{analytics.currentStreak}-day streak</strong>!
                                        {analytics.currentStreak >= 7 ? ' Amazing consistency!' : ' Keep the momentum going.'}
                                    </p>
                                )}
                                {analytics.topThemes.length > 0 && (
                                    <p>
                                        Your mind has been focused on: <strong className="text-white">{analytics.topThemes.map(t => t.theme).join(', ')}</strong>.
                                    </p>
                                )}
                            </>
                        ) : (
                            <p>Start journaling to unlock personalized insights and reflections!</p>
                        )}
                    </div>
                </div>

                {/* Health & Mood Insights Panel */}
                <HealthInsightsPanel period={selectedPeriod} />
            </div>
        </div>
    );
}
