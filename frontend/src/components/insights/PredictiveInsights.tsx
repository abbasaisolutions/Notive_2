// Predictive Insights Component - AI-powered suggestions and patterns
// File: frontend/src/components/insights/PredictiveInsights.tsx

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { IconType } from 'react-icons';
import {
    FiActivity,
    FiArrowRight,
    FiAward,
    FiBarChart2,
    FiMoon,
    FiRefreshCw,
    FiStar,
    FiSun,
    FiTarget,
    FiTrendingUp,
    FiX,
    FiZap,
} from 'react-icons/fi';
import { appendReturnTo } from '@/utils/navigation';

interface Insight {
    id: string;
    type: 'motivation' | 'wellness' | 'suggestion' | 'achievement' | 'pattern';
    iconKey: keyof typeof INSIGHT_ICONS;
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
    signals?: Array<{ label: string; value: string }>;
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

const INSIGHT_ICONS = {
    award: FiAward,
    streak: FiTrendingUp,
    restart: FiRefreshCw,
    wellness: FiActivity,
    positive: FiSun,
    sunrise: FiSun,
    moon: FiMoon,
    target: FiTarget,
    milestone: FiStar,
    century: FiBarChart2,
    signal: FiZap,
} satisfies Record<string, IconType>;

export function PredictiveInsights({
    analytics,
    currentReturnTo,
}: {
    analytics: AnalyticsData;
    currentReturnTo?: string;
}) {
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
                iconKey: 'award',
                title: 'Weekly streak unlocked',
                message: 'Consistency is compounding.',
                priority: 'high',
                signals: [{ label: 'Streak', value: `${data.currentStreak}d` }],
            });
        } else if (data.currentStreak >= 3 && data.currentStreak < 7) {
            insights.push({
                id: 'streak-progress',
                type: 'motivation',
                iconKey: 'streak',
                title: `${7 - data.currentStreak} days to weekly goal`,
                message: 'Keep your rhythm today.',
                priority: 'medium',
                signals: [
                    { label: 'Streak', value: `${data.currentStreak}d` },
                    { label: 'Goal', value: '7d' },
                ],
                action: { label: 'Write now', href: '/entry/new' },
            });
        } else if (data.currentStreak === 0) {
            insights.push({
                id: 'streak-restart',
                type: 'motivation',
                iconKey: 'restart',
                title: 'Reset and restart',
                message: 'One entry brings momentum back.',
                priority: 'high',
                signals: [{ label: 'Streak', value: '0d' }],
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
                    iconKey: 'wellness',
                    title: 'Low mood cluster detected',
                    message: 'Open a quick check-in to process it.',
                    priority: 'high',
                    signals: [{ label: 'Last 7 low', value: String(negativeCount) }],
                    action: { label: 'Talk to Chat', href: '/chat' },
                });
            } else if (positiveCount >= 5) {
                insights.push({
                    id: 'mood-positive',
                    type: 'pattern',
                    iconKey: 'positive',
                    title: 'Positive run detected',
                    message: 'Recent entries trend resilient.',
                    priority: 'low',
                    signals: [{ label: 'Last 7 positive', value: String(positiveCount) }],
                });
            }
        }

        // Time-based suggestions
        if (hour >= 6 && hour < 10) {
            insights.push({
                id: 'morning-reflection',
                type: 'suggestion',
                iconKey: 'sunrise',
                title: 'Morning reflection',
                message: 'Capture one intention before the day starts.',
                priority: 'medium',
                signals: [{ label: 'Window', value: 'Morning' }],
                action: { label: 'Reflect', href: '/entry/new' },
            });
        } else if (hour >= 21 || hour < 2) {
            insights.push({
                id: 'evening-review',
                type: 'suggestion',
                iconKey: 'moon',
                title: 'Evening wind-down',
                message: 'Close the day with a short review.',
                priority: 'medium',
                signals: [{ label: 'Window', value: 'Evening' }],
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
                    iconKey: 'target',
                    title: `Theme focus: ${topTheme.theme}`,
                    message: 'A recurring theme is shaping your narrative.',
                    priority: 'low',
                    signals: [{ label: 'Mentions', value: String(topTheme.count) }],
                    action: { label: 'Explore', href: `/timeline?q=${encodeURIComponent(topTheme.theme)}` },
                });
            }
        }

        // Entry milestone insights
        if (data.totalEntries === 10) {
            insights.push({
                id: 'milestone-10',
                type: 'achievement',
                iconKey: 'milestone',
                title: 'Double digits!',
                message: 'Your first pattern set is now visible.',
                priority: 'high',
                signals: [{ label: 'Entries', value: '10' }],
            });
        } else if (data.totalEntries === 50) {
            insights.push({
                id: 'milestone-50',
                type: 'achievement',
                iconKey: 'milestone',
                title: '50 entries milestone!',
                message: 'Your journal now has depth for trend analysis.',
                priority: 'high',
                signals: [{ label: 'Entries', value: '50' }],
            });
        } else if (data.totalEntries === 100) {
            insights.push({
                id: 'milestone-100',
                type: 'achievement',
                iconKey: 'century',
                title: 'Century mark!',
                message: 'You have a rich memory corpus to mine.',
                priority: 'high',
                signals: [{ label: 'Entries', value: '100' }],
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return insights.slice(0, 4); // Limit to 4 insights
    };

    const dismissInsight = (id: string) => {
        setDismissed(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    };

    const visibleInsights = insights.filter(i => !dismissed.has(i.id));

    if (visibleInsights.length === 0) {
        return null;
    }

    const priorityStyles: Record<Insight['priority'], string> = {
        high: 'border-primary/30 bg-gradient-to-br from-primary/12 to-secondary/12',
        medium: 'border-white/12 bg-surface-1/60',
        low: 'border-white/10 bg-surface-1/35',
    };

    const typeStyles: Record<Insight['type'], string> = {
        achievement: 'bg-zinc-500/20 text-zinc-200 border border-zinc-400/30',
        wellness: 'bg-white/[0.07] text-white border border-white/15',
        motivation: 'bg-neutral-500/20 text-neutral-200 border border-neutral-400/30',
        pattern: 'bg-stone-500/20 text-stone-200 border border-stone-400/30',
        suggestion: 'bg-white/10 text-ink-secondary border border-white/15',
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FiZap size={20} aria-hidden="true" />
                    Insight Signals
                </h3>
                <span className="text-xs text-ink-muted">Live</span>
            </div>

            <div className="grid gap-4">
                {visibleInsights.map((insight) => (
                    <div
                        key={insight.id}
                        className={`relative rounded-2xl border p-4 transition-all hover:scale-[1.01] ${priorityStyles[insight.priority]}`}
                    >
                        {(() => {
                            const InsightIcon = INSIGHT_ICONS[insight.iconKey];
                            return (
                        <>
                        <button
                            onClick={() => dismissInsight(insight.id)}
                            className="absolute right-3 top-3 rounded-full p-1 text-ink-muted transition-colors hover:bg-white/10 hover:text-white"
                            aria-label="Dismiss insight"
                        >
                            <FiX size={14} aria-hidden="true" />
                        </button>

                        <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-white/5 p-2 text-white">
                                <InsightIcon size={22} aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1 pr-7">
                                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                    <h4 className="font-bold text-white">{insight.title}</h4>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-[0.14em] ${typeStyles[insight.type]}`}>
                                        {insight.type}
                                    </span>
                                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs uppercase tracking-[0.14em] text-ink-muted">
                                        {insight.priority}
                                    </span>
                                </div>
                                <p className="line-clamp-2 text-sm leading-relaxed text-ink-secondary">{insight.message}</p>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {(insight.signals || []).map((signal) => (
                                <span
                                    key={`${insight.id}-${signal.label}`}
                                    className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary"
                                >
                                    {signal.label}: <span className="text-white">{signal.value}</span>
                                </span>
                            ))}

                            {insight.action && (
                                <Link
                                    href={appendReturnTo(insight.action.href, currentReturnTo)}
                                    className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                >
                                    {insight.action.label}
                                    <FiArrowRight size={12} aria-hidden="true" />
                                </Link>
                            )}
                        </div>
                        </>
                            );
                        })()}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default PredictiveInsights;

