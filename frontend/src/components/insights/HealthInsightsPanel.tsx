'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { 
    Moon, Footprints, Heart, Brain, TrendingUp, TrendingDown, Minus, 
    Lightbulb, Activity, Sparkles, Link2
} from 'lucide-react';
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

export default function HealthInsightsPanel({ period = 'month' }: Props) {
    const { accessToken } = useAuth();
    const [data, setData] = useState<ComprehensiveInsights | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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
            <div className="bento-box p-6 animate-pulse">
                <div className="h-6 bg-white/10 rounded w-1/3 mb-4" />
                <div className="h-4 bg-white/10 rounded w-2/3 mb-2" />
                <div className="h-4 bg-white/10 rounded w-1/2" />
            </div>
        );
    }

    if (error || !data) {
        return null; // Silently fail - health insights are supplementary
    }

    const { healthData } = data;

    // If not connected, show CTA
    if (!healthData.connected) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bento-box p-6 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-[60px] rounded-full" />
                
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Health Insights</h3>
                        <p className="text-xs text-slate-500">Unlock health-mood correlations</p>
                    </div>
                </div>

                <p className="text-sm text-slate-400 mb-4">
                    Connect Google Fit to discover how your sleep and activity patterns relate to your mood.
                </p>

                <Link href="/profile">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 text-sm font-medium transition-all flex items-center justify-center gap-2"
                    >
                        <Link2 className="w-4 h-4" />
                        Connect in Settings
                    </motion.button>
                </Link>
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
            className="bento-box p-6 md:p-8 relative overflow-hidden"
        >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-green-500/10 to-indigo-500/10 blur-[80px] rounded-full" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-indigo-500/20 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Health & Mood</h3>
                        <p className="text-xs text-slate-500">
                            {stats?.daysWithData || 0} days of data
                        </p>
                    </div>
                </div>

                <span className="text-[10px] text-slate-500 uppercase tracking-wider bg-white/5 px-2 py-1 rounded">
                    {period}
                </span>
            </div>

            {/* Stats Grid */}
            {stats && stats.daysWithData > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                        <Moon className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
                        <p className="text-xl font-semibold text-white">
                            {stats.avgSleepHours?.toFixed(1) || '—'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                            Avg Sleep
                        </p>
                        <TrendIndicator trend={stats.sleepTrend} />
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                        <Footprints className="w-5 h-5 text-green-400 mx-auto mb-2" />
                        <p className="text-xl font-semibold text-white">
                            {stats.avgSteps ? (stats.avgSteps / 1000).toFixed(1) + 'k' : '—'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                            Avg Steps
                        </p>
                        <TrendIndicator trend={stats.activityTrend} />
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                        <Heart className="w-5 h-5 text-red-400 mx-auto mb-2" />
                        <p className="text-xl font-semibold text-white">
                            {stats.avgHeartRate || '—'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                            Avg HR
                        </p>
                    </div>
                </div>
            )}

            {/* Correlations/Insights */}
            {hasCorrelations && (
                <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                            Discovered Patterns
                        </span>
                    </div>

                    <AnimatePresence>
                        {correlations.sleepMood && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                        <Moon className="w-4 h-4 text-indigo-400" />
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
                                className="p-4 rounded-xl bg-green-500/5 border border-green-500/10"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                        <Footprints className="w-4 h-4 text-green-400" />
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

            {/* Recommendations */}
            {healthData.recommendations && healthData.recommendations.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                            Suggestions
                        </span>
                    </div>
                    <ul className="space-y-2">
                        {healthData.recommendations.slice(0, 3).map((rec, i) => (
                            <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                                <span className="text-amber-500">•</span>
                                {rec}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Low data state */}
            {stats && stats.daysWithData < 5 && (
                <div className="p-4 rounded-xl bg-white/5 text-center">
                    <p className="text-sm text-slate-400">
                        Keep syncing health data to unlock more insights!
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {5 - stats.daysWithData} more days needed for correlations
                    </p>
                </div>
            )}
        </motion.div>
    );
}

// Trend indicator component
function TrendIndicator({ trend }: { trend: 'improving' | 'declining' | 'stable' }) {
    const config = {
        improving: { icon: TrendingUp, color: 'text-green-400' },
        declining: { icon: TrendingDown, color: 'text-orange-400' },
        stable: { icon: Minus, color: 'text-slate-500' },
    };

    const { icon: Icon, color } = config[trend];

    return (
        <div className="mt-1 flex justify-center">
            <Icon className={`w-3 h-3 ${color}`} />
        </div>
    );
}
