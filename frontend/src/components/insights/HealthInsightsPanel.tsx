'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { resolveApiUrl } from '@/constants/config';
import {
    FiActivity,
    FiCpu,
    FiHeart,
    FiLink,
    FiMinus,
    FiMoon,
    FiShield,
    FiStar,
    FiSun,
    FiTrendingDown,
    FiTrendingUp,
} from 'react-icons/fi';
import Link from 'next/link';

interface HealthStats {
    avgSleepHours: number | null;
    avgSteps: number | null;
    avgHeartRate: number | null;
    daysWithData: number;
    sleepTrend: 'improving' | 'declining' | 'stable';
    activityTrend: 'improving' | 'declining' | 'stable';
}

interface HealthCorrelations {
    sleepMood: string | null;
    activityMood: string | null;
}

interface ComprehensiveInsights {
    insights: {
        dominantMood: string;
        moodTrend: 'improving' | 'declining' | 'stable';
        entryCount: number;
        combinedInsights: string[];
    };
    healthData: {
        connected: boolean;
        available?: boolean;
        connectAvailable?: boolean;
        stats?: HealthStats;
        correlations?: HealthCorrelations;
        patterns?: string[];
        recommendations?: string[];
        message?: string;
    };
}

interface Props {
    period?: 'week' | 'month' | 'year';
}

// Trend indicator component
function TrendIndicator({ trend }: { trend: 'improving' | 'declining' | 'stable' }) {
    const config = {
        improving: { icon: FiTrendingUp, color: 'text-emerald-400', label: 'Improving' },
        declining: { icon: FiTrendingDown, color: 'text-amber-400', label: 'Declining' },
        stable: { icon: FiMinus, color: 'text-ink-muted', label: 'Stable' },
    };

    const { icon: Icon, color } = config[trend];

    return (
        <div className="mt-1 flex justify-center">
            <Icon className={`w-3 h-3 ${color}`} />
        </div>
    );
}

export default function HealthInsightsPanel({ period = 'month' }: Props) {
    const { accessToken } = useAuth();
    const [data, setData] = useState<ComprehensiveInsights | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const API_URL = resolveApiUrl();

    const fetchInsights = useCallback(async () => {
        try {
            const response = await fetch(
                `${API_URL}/analytics/comprehensive-insights?period=${period}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (response.ok) {
                setData(await response.json());
            } else {
                throw new Error('Failed to fetch insights');
            }
        } catch (err) {
            console.error('Error fetching health insights:', err);
            setError('Could not load health insights');
        } finally {
            setIsLoading(false);
        }
    }, [accessToken, API_URL, period]);

    useEffect(() => {
        if (accessToken) {
            fetchInsights();
        }
    }, [accessToken, fetchInsights]);

    if (isLoading) {
        return (
            <div className="workspace-panel mt-8 rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-white/10 rounded w-1/3 mb-4" />
                <div className="h-4 bg-white/10 rounded w-2/3 mb-2" />
                <div className="h-4 bg-white/10 rounded w-1/2" />
            </div>
        );
    }

    if (error || !data) {
        return null;
    }

    const { healthData } = data;

    // If not connected, show CTA with neutral styling
    if (!healthData.connected) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="workspace-panel relative mt-8 overflow-hidden rounded-2xl p-6"
            >
                <div className="health-glow absolute right-0 top-0 h-32 w-32 rounded-full blur-[60px]" />
                
                <div className="flex items-center gap-3 mb-4">
                    <div className="health-icon-well flex h-10 w-10 items-center justify-center rounded-xl">
                        <FiActivity className="h-5 w-5 text-ink-secondary" />
                    </div>
                    <div>
                        <h3 className="workspace-heading text-lg font-semibold">Body & Mood</h3>
                        <p className="health-copy text-xs">See body and mood together</p>
                    </div>
                </div>

                <p className="health-copy mb-4 text-sm">
                    {healthData.message || 'Connect Google Fit to see how sleep, movement, and recovery connect with mood.'}
                </p>

                <div className="health-quiet mb-4 flex items-center gap-2 text-xs">
                    <FiShield className="w-3 h-3" />
                    <span>Read-only access • Your data stays private</span>
                </div>

                {healthData.connectAvailable === false ? (
                    <div className="workspace-soft-panel w-full rounded-xl px-4 py-3 text-center text-sm text-ink-secondary">
                        Unavailable in this environment
                    </div>
                ) : (
                    <Link href="/profile">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="health-muted-button flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all"
                        >
                            <FiLink className="w-4 h-4" />
                            Connect in Me
                        </motion.button>
                    </Link>
                )}
            </motion.div>
        );
    }

    const stats = healthData.stats;
    const correlations = healthData.correlations;
    const hasCorrelations = correlations?.sleepMood || correlations?.activityMood;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="workspace-panel relative mt-8 overflow-hidden rounded-2xl p-6 md:p-8"
        >
            {/* Subtle neutral background */}
            <div className="health-glow absolute right-0 top-0 h-40 w-40 rounded-full blur-[80px]" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="health-icon-well flex h-10 w-10 items-center justify-center rounded-xl">
                        <FiCpu className="h-5 w-5 text-ink-secondary" />
                    </div>
                    <div>
                        <h3 className="workspace-heading text-lg font-semibold">Body & Mood</h3>
                        <p className="health-kicker">
                            {stats?.daysWithData || 0} days synced
                        </p>
                    </div>
                </div>

                <span className="health-chip px-2 py-1 text-xs uppercase tracking-wider">
                    {period}
                </span>
            </div>

            {/* Stats Grid - Neutral colors */}
            {stats && stats.daysWithData > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="health-stat-card rounded-xl p-4 text-center">
                        <FiMoon className="mx-auto mb-2 h-5 w-5 text-ink-secondary" />
                        <p className="workspace-heading text-xl font-semibold">
                            {stats.avgSleepHours?.toFixed(1) || '—'}
                        </p>
                        <p className="health-kicker">
                            Avg sleep
                        </p>
                        <TrendIndicator trend={stats.sleepTrend} />
                    </div>

                    <div className="health-stat-card rounded-xl p-4 text-center">
                        <FiActivity className="mx-auto mb-2 h-5 w-5 text-ink-secondary" />
                        <p className="workspace-heading text-xl font-semibold">
                            {stats.avgSteps ? (stats.avgSteps / 1000).toFixed(1) + 'k' : '—'}
                        </p>
                        <p className="health-kicker">
                            Avg steps
                        </p>
                        <TrendIndicator trend={stats.activityTrend} />
                    </div>

                    <div className="health-stat-card rounded-xl p-4 text-center">
                        <FiHeart className="mx-auto mb-2 h-5 w-5 text-ink-secondary" />
                        <p className="workspace-heading text-xl font-semibold">
                            {stats.avgHeartRate || '—'}
                        </p>
                        <p className="health-kicker">
                            Avg heart
                        </p>
                    </div>
                </div>
            )}

            {/* Correlations/Insights - Neutral styling */}
            {hasCorrelations && (
                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <FiStar className="h-4 w-4 text-ink-secondary" />
                        <span className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
                            What Notive noticed
                        </span>
                    </div>

                    <AnimatePresence>
                        {correlations.sleepMood && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="health-note-card rounded-xl p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="health-icon-chip flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
                                        <FiMoon className="h-4 w-4 text-ink-secondary" />
                                    </div>
                                    <p className="health-copy text-sm leading-relaxed">
                                        {correlations.sleepMood}
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {correlations.activityMood && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="health-note-card rounded-xl p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="health-icon-chip flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
                                        <FiActivity className="h-4 w-4 text-ink-secondary" />
                                    </div>
                                    <p className="health-copy text-sm leading-relaxed">
                                        {correlations.activityMood}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Recommendations - Neutral */}
            {healthData.recommendations && healthData.recommendations.length > 0 && (
                <div className="border-t border-[rgba(var(--paper-border),0.92)] pt-4">
                    <div className="flex items-center gap-2 mb-3">
                        <FiSun className="w-4 h-4 text-amber-400/70" />
                        <span className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
                            Try this
                        </span>
                    </div>
                    <ul className="space-y-2">
                        {healthData.recommendations.slice(0, 3).map((rec, i) => (
                            <li key={i} className="health-copy flex items-start gap-2 text-sm">
                                <span className="text-ink-muted">•</span>
                                {rec}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Low data state */}
            {stats && stats.daysWithData < 5 && (
                <div className="health-note-card rounded-xl p-4 text-center">
                    <p className="health-copy text-sm">
                        Keep syncing to see more.
                    </p>
                    <p className="health-quiet mt-1 text-xs">
                        {5 - stats.daysWithData} more days needed to compare body and mood
                    </p>
                </div>
            )}
        </motion.div>
    );
}
