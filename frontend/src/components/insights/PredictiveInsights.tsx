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

const DISMISSED_STORAGE_KEY = 'notive_predictive_insights_dismissed_v1';
const DISMISS_TTL_MS = 12 * 60 * 60 * 1000;

const INSIGHT_TYPE_LABELS: Record<Insight['type'], string> = {
    achievement: 'Milestone',
    wellness: 'Health',
    motivation: 'Momentum',
    pattern: 'Pattern',
    suggestion: 'Tip',
};

const readDismissedInsights = (): Record<string, string> => {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw) as Record<string, string>;
        const now = Date.now();
        return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
            const timestamp = Date.parse(value);
            if (Number.isFinite(timestamp) && now - timestamp < DISMISS_TTL_MS) {
                acc[key] = value;
            }
            return acc;
        }, {});
    } catch {
        return {};
    }
};

const writeDismissedInsights = (value: Record<string, string>) => {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(value));
};

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
        setDismissed(new Set(Object.keys(readDismissedInsights())));
    }, []);

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
                title: '7 days in a row',
                message: 'A full week of notes is enough to start showing real patterns.',
                priority: 'high',
                signals: [{ label: 'Streak', value: `${data.currentStreak}d` }],
            });
        } else if (data.currentStreak >= 3 && data.currentStreak < 7) {
            insights.push({
                id: 'streak-progress',
                type: 'motivation',
                iconKey: 'streak',
                title: `${7 - data.currentStreak} more days for 7 in a row`,
                message: 'One honest note today keeps the habit going.',
                priority: 'medium',
                signals: [
                    { label: 'Streak', value: `${data.currentStreak}d` },
                    { label: 'Goal', value: '7d' },
                ],
                action: { label: 'Write today', href: '/entry/new' },
            });
        } else if (data.currentStreak === 0) {
            insights.push({
                id: 'streak-restart',
                type: 'motivation',
                iconKey: 'restart',
                title: 'Start again with one note',
                message: 'One clear note is enough to get going again.',
                priority: 'high',
                signals: [{ label: 'Streak', value: '0d' }],
                action: { label: 'Write note', href: '/entry/new' },
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
                    title: 'Hard feelings may be building',
                    message: 'A short note could help you name what keeps coming back.',
                    priority: 'high',
                    signals: [{ label: 'Low days', value: String(negativeCount) }],
                    action: { label: 'Open AskNotive', href: '/chat' },
                });
            } else if (positiveCount >= 5) {
                insights.push({
                    id: 'mood-positive',
                    type: 'pattern',
                    iconKey: 'positive',
                    title: 'You seem steadier lately',
                    message: 'Recent notes suggest your mood has been steadier than usual.',
                    priority: 'low',
                    signals: [{ label: 'Good days', value: String(positiveCount) }],
                });
            }
        }

        // Time-based suggestions
        if (hour >= 6 && hour < 10) {
            insights.push({
                id: 'morning-reflection',
                type: 'suggestion',
                iconKey: 'sunrise',
                title: 'Start the day with one note',
                message: 'Name one plan or worry before the day gets busy.',
                priority: 'medium',
                signals: [{ label: 'Time', value: 'Morning' }],
                action: { label: 'Write morning note', href: '/entry/new' },
            });
        } else if (hour >= 21 || hour < 2) {
            insights.push({
                id: 'evening-review',
                type: 'suggestion',
                iconKey: 'moon',
                title: 'Wrap up today',
                message: 'A short recap can help tomorrow feel easier.',
                priority: 'medium',
                signals: [{ label: 'Time', value: 'Evening' }],
                action: { label: 'Write recap', href: '/entry/new' },
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
                    title: `Topic showing up: ${topTheme.theme}`,
                    message: 'This topic is coming up often in your notes.',
                    priority: 'low',
                    signals: [{ label: 'Times seen', value: String(topTheme.count) }],
                    action: { label: 'See topic', href: `/timeline?q=${encodeURIComponent(topTheme.theme)}` },
                });
            }
        }

        // Entry milestone insights
        if (data.totalEntries === 10) {
            insights.push({
                id: 'milestone-10',
                type: 'achievement',
                iconKey: 'milestone',
                title: '10 notes: patterns are starting to show',
                message: 'You now have enough notes for Notive to start showing repeats.',
                priority: 'high',
                signals: [{ label: 'Notes', value: '10' }],
            });
        } else if (data.totalEntries === 50) {
            insights.push({
                id: 'milestone-50',
                type: 'achievement',
                iconKey: 'milestone',
                title: '50 notes: your patterns are getting clearer',
                message: 'You now have enough history for stronger comparisons and clearer themes.',
                priority: 'high',
                signals: [{ label: 'Notes', value: '50' }],
            });
        } else if (data.totalEntries === 100) {
            insights.push({
                id: 'milestone-100',
                type: 'achievement',
                iconKey: 'century',
                title: '100 notes: your memory base is strong',
                message: 'You now have a deep note history for stronger patterns and stories.',
                priority: 'high',
                signals: [{ label: 'Notes', value: '100' }],
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
            const stored = readDismissedInsights();
            stored[id] = new Date().toISOString();
            writeDismissedInsights(stored);
            return next;
        });
    };

    const visibleInsights = insights.filter(i => !dismissed.has(i.id));

    if (visibleInsights.length === 0) {
        return null;
    }

    const priorityStyles: Record<Insight['priority'], string> = {
        high: 'border-primary/30 bg-gradient-to-br from-primary/12 to-secondary/12',
        medium: 'workspace-soft-panel',
        low: 'workspace-muted-panel',
    };

    const typeStyles: Record<Insight['type'], string> = {
        achievement: 'workspace-pill text-ink-secondary',
        wellness: 'workspace-pill text-[rgb(var(--text-primary))]',
        motivation: 'workspace-pill-muted text-ink-muted',
        pattern: 'workspace-soft-panel text-ink-secondary',
        suggestion: 'workspace-pill-muted text-ink-secondary',
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className="workspace-heading flex items-center gap-2 text-lg font-bold">
                    <FiZap size={20} aria-hidden="true" />
                    Quick Ideas
                </h3>
                <span className="text-xs text-ink-muted">Personalized</span>
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
                            className="absolute right-3 top-3 rounded-full p-1 text-ink-muted transition-colors hover:bg-primary/10 hover:text-[rgb(var(--text-primary))]"
                            aria-label="Dismiss insight"
                        >
                            <FiX size={14} aria-hidden="true" />
                        </button>

                        <div className="flex items-start gap-3">
                            <div className="workspace-icon-badge rounded-xl p-2 text-[rgb(var(--text-primary))]">
                                <InsightIcon size={22} aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1 pr-7">
                                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                    <h4 className="workspace-heading font-bold">{insight.title}</h4>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-[0.14em] ${typeStyles[insight.type]}`}>
                                        {INSIGHT_TYPE_LABELS[insight.type]}
                                    </span>
                                    <span className="workspace-pill-muted rounded-full px-2 py-0.5 text-xs uppercase tracking-[0.14em] text-ink-muted">
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
                                    className="workspace-pill-muted rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary"
                                >
                                    {signal.label}: <span className="text-[rgb(var(--text-primary))]">{signal.value}</span>
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

