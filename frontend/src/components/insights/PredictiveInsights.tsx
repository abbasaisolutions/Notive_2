// Predictive Insights Component - AI-powered suggestions and patterns
// File: frontend/src/components/insights/PredictiveInsights.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { API_URL } from '@/constants/config';
import type { LucideIcon } from 'lucide-react';
import { Flame, Heart, Moon, Sparkles, Star, Sunrise, Sun, Target, Trophy } from 'lucide-react';

interface Insight {
    id: string;
    type: 'motivation' | 'wellness' | 'suggestion' | 'achievement' | 'pattern';
    icon: LucideIcon;
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
    action?: {
        label: string;
        href: string;
    };
}

interface AnalyticsData {
    currentStreak: number;
    totalEntries: number;
    moodTrend: Array<{ mood: string; score: number }>;
    topMood: string;
    topThemes: Array<{ theme: string; count: number }>;
}

export function PredictiveInsights({ analytics }: { analytics: AnalyticsData }) {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        const generated = generateInsights(analytics);
        setInsights(generated);
    }, [analytics]);

    const generateInsights = (data: AnalyticsData): Insight[] => {
        const insights: Insight[] = [];
        const now = new Date();
        const hour = now.getHours();

        // Streak-based insights
        if (data.currentStreak >= 7) {
            insights.push({
                id: 'streak-week',
                type: 'achievement',
                icon: Trophy,
                title: 'Weekly Champion!',
                message: `You've journaled for ${data.currentStreak} days straight! You're building an incredible habit.`,
                priority: 'high',
            });
        } else if (data.currentStreak >= 3 && data.currentStreak < 7) {
            insights.push({
                id: 'streak-progress',
                type: 'motivation',
                icon: Flame,
                title: `${7 - data.currentStreak} more days to weekly goal!`,
                message: 'Keep going! Consistency is key to self-discovery.',
                priority: 'medium',
                action: { label: 'Write now', href: '/entry/new' },
            });
        } else if (data.currentStreak === 0) {
            insights.push({
                id: 'streak-restart',
                type: 'motivation',
                icon: Sparkles,
                title: 'Start fresh today!',
                message: "Every journey begins with a single step. Let's restart your streak.",
                priority: 'high',
                action: { label: 'Begin', href: '/entry/new' },
            });
        }

        // Mood pattern detection
        if (data.moodTrend.length >= 3) {
            const recentMoods = data.moodTrend.slice(-7);
            const negativeCount = recentMoods.filter(m => m.score < 5).length;
            const positiveCount = recentMoods.filter(m => m.score >= 7).length;

            if (negativeCount >= 4) {
                insights.push({
                    id: 'mood-check',
                    type: 'wellness',
                    icon: Heart,
                    title: 'Checking in with you',
                    message: "Your recent entries suggest you might be going through a tough time. Remember, it's okay to not be okay.",
                    priority: 'high',
                    action: { label: 'Talk to Chat', href: '/chat' },
                });
            } else if (positiveCount >= 5) {
                insights.push({
                    id: 'mood-positive',
                    type: 'pattern',
                    icon: Sun,
                    title: 'You\'re on a roll!',
                    message: `Your mood has been consistently positive lately. Keep doing what you're doing!`,
                    priority: 'low',
                });
            }
        }

        // Time-based suggestions
        if (hour >= 6 && hour < 10) {
            insights.push({
                id: 'morning-reflection',
                type: 'suggestion',
                icon: Sunrise,
                title: 'Morning reflection',
                message: 'Start your day with intention. What are you grateful for this morning?',
                priority: 'medium',
                action: { label: 'Reflect', href: '/entry/new' },
            });
        } else if (hour >= 21 || hour < 2) {
            insights.push({
                id: 'evening-review',
                type: 'suggestion',
                icon: Moon,
                title: 'Evening wind-down',
                message: 'Take a moment to reflect on your day before rest.',
                priority: 'medium',
                action: { label: 'Review day', href: '/entry/new' },
            });
        }

        // Theme-based insights
        if (data.topThemes.length > 0) {
            const topTheme = data.topThemes[0];
            if (topTheme.count >= 5) {
                insights.push({
                    id: 'theme-focus',
                    type: 'pattern',
                    icon: Target,
                    title: `Focused on "${topTheme.theme}"`,
                    message: `This theme appears ${topTheme.count} times in your entries. It seems important to you right now.`,
                    priority: 'low',
                    action: { label: 'Explore', href: `/search?q=${topTheme.theme}` },
                });
            }
        }

        // Entry milestone insights
        if (data.totalEntries === 10) {
            insights.push({
                id: 'milestone-10',
                type: 'achievement',
                icon: Sparkles,
                title: 'Double digits!',
                message: "You've written 10 entries! Your journal is starting to paint a picture of your journey.",
                priority: 'high',
            });
        } else if (data.totalEntries === 50) {
            insights.push({
                id: 'milestone-50',
                type: 'achievement',
                icon: Star,
                title: '50 entries milestone!',
                message: 'Half a century of reflections! Your dedication to self-discovery is inspiring.',
                priority: 'high',
            });
        } else if (data.totalEntries === 100) {
            insights.push({
                id: 'milestone-100',
                type: 'achievement',
                icon: Star,
                title: 'Century mark!',
                message: '100 entries! You have a treasure trove of personal insights waiting to be explored.',
                priority: 'high',
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return insights.slice(0, 4); // Limit to 4 insights
    };

    const dismissInsight = (id: string) => {
        setDismissed(prev => new Set([...prev, id]));
    };

    const visibleInsights = insights.filter(i => !dismissed.has(i.id));

    if (visibleInsights.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    AI Insights
                </h3>
                <span className="text-xs text-slate-500">Personalized for you</span>
            </div>

            <div className="grid gap-4">
                {visibleInsights.map((insight) => (
                    <div
                        key={insight.id}
                        className={`relative p-5 rounded-2xl border transition-all hover:scale-[1.01] ${insight.priority === 'high'
                                ? 'bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20'
                                : insight.priority === 'medium'
                                    ? 'bg-white/5 border-white/10'
                                    : 'bg-white/[0.02] border-white/5'
                            }`}
                    >
                        {/* Dismiss button */}
                        <button
                            onClick={() => dismissInsight(insight.id)}
                            className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors text-slate-500 hover:text-white"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                            </svg>
                        </button>

                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                {(() => {
                                    const Icon = insight.icon;
                                    return <Icon className="w-7 h-7 text-white" />;
                                })()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white mb-1">{insight.title}</h4>
                                <p className="text-sm text-slate-400 leading-relaxed">{insight.message}</p>

                                {insight.action && (
                                    <Link
                                        href={insight.action.href}
                                        className="inline-flex items-center gap-2 mt-3 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                                    >
                                        {insight.action.label}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m9 18 6-6-6-6" />
                                        </svg>
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Type badge */}
                        <div className="absolute bottom-3 right-3">
                            <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded-full ${insight.type === 'achievement' ? 'bg-yellow-500/20 text-yellow-400' :
                                    insight.type === 'wellness' ? 'bg-blue-500/20 text-blue-400' :
                                        insight.type === 'motivation' ? 'bg-green-500/20 text-green-400' :
                                            insight.type === 'pattern' ? 'bg-purple-500/20 text-purple-400' :
                                                'bg-white/10 text-slate-400'
                                }`}>
                                {insight.type}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default PredictiveInsights;
