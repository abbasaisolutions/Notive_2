'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Moon, Footprints, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface HealthContextSummary {
    date: string;
    sleepHours: number | null;
    sleepQuality: string | null;
    steps: number | null;
    activityLevel: 'low' | 'moderate' | 'high' | null;
    avgHeartRate: number | null;
}

interface Props {
    context: HealthContextSummary | null;
    healthInsight?: string | null;
    minimal?: boolean;
}

export default function HealthContextBadge({ context, healthInsight, minimal = false }: Props) {
    if (!context) {
        return null;
    }

    const hasSleep = context.sleepHours !== null;
    const hasActivity = context.steps !== null || context.activityLevel !== null;

    if (!hasSleep && !hasActivity) {
        return null;
    }

    // Activity level colors and icons
    const activityConfig = {
        low: { color: 'text-orange-400', bg: 'bg-orange-500/10' },
        moderate: { color: 'text-green-400', bg: 'bg-green-500/10' },
        high: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    };

    // Sleep quality colors
    const sleepConfig = {
        poor: { color: 'text-red-400', label: 'Poor' },
        fair: { color: 'text-orange-400', label: 'Fair' },
        good: { color: 'text-green-400', label: 'Good' },
        excellent: { color: 'text-emerald-400', label: 'Excellent' },
    };

    if (minimal) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-xs"
            >
                {hasSleep && (
                    <span className="flex items-center gap-1 text-indigo-300">
                        <Moon className="w-3 h-3" />
                        {context.sleepHours}h
                    </span>
                )}
                {hasSleep && hasActivity && <span className="text-white/20">•</span>}
                {hasActivity && (
                    <span className={`flex items-center gap-1 ${activityConfig[context.activityLevel || 'moderate'].color}`}>
                        <Footprints className="w-3 h-3" />
                        {context.steps ? context.steps.toLocaleString() : context.activityLevel}
                    </span>
                )}
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-white/[0.03] border border-white/5 p-4 space-y-3"
        >
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                    Yesterday's Health
                </span>
            </div>

            <div className="flex items-center gap-4">
                {/* Sleep */}
                {hasSleep && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                            <Moon className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">{context.sleepHours}h</p>
                            {context.sleepQuality && (
                                <p className={`text-[10px] ${sleepConfig[context.sleepQuality as keyof typeof sleepConfig]?.color || 'text-slate-500'}`}>
                                    {sleepConfig[context.sleepQuality as keyof typeof sleepConfig]?.label || context.sleepQuality}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Activity */}
                {hasActivity && (
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${activityConfig[context.activityLevel || 'moderate'].bg} flex items-center justify-center`}>
                            <Footprints className={`w-4 h-4 ${activityConfig[context.activityLevel || 'moderate'].color}`} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">
                                {context.steps ? context.steps.toLocaleString() : '—'}
                            </p>
                            <p className={`text-[10px] capitalize ${activityConfig[context.activityLevel || 'moderate'].color}`}>
                                {context.activityLevel || 'Activity'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* AI Health Insight */}
            {healthInsight && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="pt-2 border-t border-white/5"
                >
                    <p className="text-xs text-slate-400 italic">
                        💡 {healthInsight}
                    </p>
                </motion.div>
            )}
        </motion.div>
    );
}

// Separate component for trend indicators
export function HealthTrendIndicator({ 
    trend, 
    label 
}: { 
    trend: 'improving' | 'declining' | 'stable'; 
    label: string;
}) {
    const config = {
        improving: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
        declining: { icon: TrendingDown, color: 'text-orange-400', bg: 'bg-orange-500/10' },
        stable: { icon: Minus, color: 'text-slate-400', bg: 'bg-white/5' },
    };

    const { icon: Icon, color, bg } = config[trend];

    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${bg}`}>
            <Icon className={`w-3 h-3 ${color}`} />
            <span className={`text-xs ${color}`}>{label}</span>
        </div>
    );
}
