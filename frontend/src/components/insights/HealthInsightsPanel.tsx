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
        stable: { icon: FiMinus, color: 'text-slate-500', label: 'Stable' },
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
            <div className="mt-8 glass-card p-6 rounded-2xl animate-pulse">
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
                className="mt-8 glass-card p-6 rounded-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 blur-[60px] rounded-full" />
                
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                        <FiActivity className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Body & Mood</h3>
                        <p className="text-xs text-slate-500">See body and mood together</p>
                    </div>
                </div>

                <p className="text-sm text-slate-400 mb-4">
                    {healthData.message || 'Connect Google Fit to see how sleep, movement, and recovery connect with mood.'}
                </p>

                <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-4">
                    <FiShield className="w-3 h-3" />
                    <span>Read-only access • Your data stays private</span>
                </div>

                {healthData.connectAvailable === false ? (
                    <div className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-slate-300">
                        Unavailable in this environment
                    </div>
                ) : (
                    <Link href="/profile">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="w-full py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
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
            className="mt-8 glass-card p-6 md:p-8 rounded-2xl relative overflow-hidden"
        >
            {/* Subtle neutral background */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-slate-500/5 blur-[80px] rounded-full" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                        <FiCpu className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Body & Mood</h3>
                        <p className="text-xs text-slate-500">
                            {stats?.daysWithData || 0} days synced
                        </p>
                    </div>
                </div>

                <span className="text-[10px] text-slate-500 uppercase tracking-wider bg-white/5 px-2 py-1 rounded">
                    {period}
                </span>
            </div>

            {/* Stats Grid - Neutral colors */}
            {stats && stats.daysWithData > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                        <FiMoon className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                        <p className="text-xl font-semibold text-white">
                            {stats.avgSleepHours?.toFixed(1) || '—'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                            Avg sleep
                        </p>
                        <TrendIndicator trend={stats.sleepTrend} />
                    </div>

                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                        <FiActivity className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                        <p className="text-xl font-semibold text-white">
                            {stats.avgSteps ? (stats.avgSteps / 1000).toFixed(1) + 'k' : '—'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                            Avg steps
                        </p>
                        <TrendIndicator trend={stats.activityTrend} />
                    </div>

                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                        <FiHeart className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                        <p className="text-xl font-semibold text-white">
                            {stats.avgHeartRate || '—'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                            Avg heart
                        </p>
                    </div>
                </div>
            )}

            {/* Correlations/Insights - Neutral styling */}
            {hasCorrelations && (
                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <FiStar className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                            What Notive noticed
                        </span>
                    </div>

                    <AnimatePresence>
                        {correlations.sleepMood && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                                        <FiMoon className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed">
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
                                className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                                        <FiActivity className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed">
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
                <div className="pt-4 border-t border-slate-700/30">
                    <div className="flex items-center gap-2 mb-3">
                        <FiSun className="w-4 h-4 text-amber-400/70" />
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                            Try this
                        </span>
                    </div>
                    <ul className="space-y-2">
                        {healthData.recommendations.slice(0, 3).map((rec, i) => (
                            <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                                <span className="text-slate-500">•</span>
                                {rec}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Low data state */}
            {stats && stats.daysWithData < 5 && (
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 text-center">
                    <p className="text-sm text-slate-400">
                        Keep syncing to see more.
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {5 - stats.daysWithData} more days needed to compare body and mood
                    </p>
                </div>
            )}
        </motion.div>
    );
}
