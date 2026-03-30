'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type WellnessCheckinProps = {
    onSubmit: (data: WellnessData) => void;
    submitted?: boolean;
};

export type WellnessData = {
    energyLevel: number;
    socialBattery: number;
    stressLevel: number;
    screenTimeFeeling: number;
    notificationPressure: number;
};

const DIMENSIONS = [
    {
        key: 'energyLevel' as const,
        label: 'Energy',
        low: 'Drained',
        high: 'Fully charged',
        icon: '⚡',
    },
    {
        key: 'stressLevel' as const,
        label: 'Stress',
        low: 'Calm',
        high: 'Overwhelmed',
        icon: '🌊',
    },
    {
        key: 'socialBattery' as const,
        label: 'Social battery',
        low: 'Need alone time',
        high: 'Ready for people',
        icon: '👥',
    },
    {
        key: 'screenTimeFeeling' as const,
        label: 'Screen time',
        low: 'Too much today',
        high: 'Balanced',
        icon: '📱',
    },
    {
        key: 'notificationPressure' as const,
        label: 'Notification pressure',
        low: 'Peaceful',
        high: 'Buzzing nonstop',
        icon: '🔔',
    },
];

const DOT_COLORS = [
    'rgba(234,216,189,0.9)',  // 1 - amber
    'rgba(232,216,199,0.9)',  // 2 - warm
    'rgba(199,216,232,0.9)',  // 3 - sky
    'rgba(199,220,203,0.9)',  // 4 - sage
    'rgba(216,199,232,0.9)',  // 5 - lilac
];

export default function WellnessCheckin({ onSubmit, submitted }: WellnessCheckinProps) {
    const [values, setValues] = useState<Record<string, number>>({});
    const [expanded, setExpanded] = useState(false);

    const answeredCount = Object.keys(values).length;
    const allAnswered = answeredCount === DIMENSIONS.length;

    const handleSelect = useCallback((key: string, value: number) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSubmit = useCallback(() => {
        if (!allAnswered) return;
        onSubmit(values as unknown as WellnessData);
    }, [allAnswered, values, onSubmit]);

    if (submitted) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="notebook-card-soft rounded-[1.75rem] p-4 text-center"
            >
                <p className="text-sm" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                    Check-in saved. This helps your insights get smarter.
                </p>
            </motion.div>
        );
    }

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="notebook-card rounded-[1.75rem] p-5"
        >
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between"
            >
                <p
                    className="section-label"
                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                >
                    Daily check-in
                </p>
                <span className="notebook-muted text-xs">
                    {answeredCount > 0 ? `${answeredCount}/${DIMENSIONS.length}` : 'Tap to start'}
                </span>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mt-4 space-y-4"
                    >
                        {DIMENSIONS.map((dim) => (
                            <div key={dim.key}>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <span className="text-sm" aria-hidden="true">{dim.icon}</span>
                                    <p className="text-xs font-medium" style={{ color: 'rgb(var(--paper-ink))' }}>
                                        {dim.label}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="notebook-muted text-[0.65rem] w-16 text-right shrink-0">{dim.low}</span>
                                    <div className="flex gap-1.5 flex-1 justify-center">
                                        {[1, 2, 3, 4, 5].map((v) => (
                                            <button
                                                key={v}
                                                onClick={() => handleSelect(dim.key, v)}
                                                className="flex items-center justify-center rounded-full transition-all"
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                }}
                                                aria-label={`${dim.label}: ${v}`}
                                            >
                                                <span
                                                    className="rounded-full transition-all"
                                                    style={{
                                                        width: values[dim.key] === v ? 28 : 22,
                                                        height: values[dim.key] === v ? 28 : 22,
                                                        backgroundColor: values[dim.key] === v
                                                            ? DOT_COLORS[v - 1]
                                                            : 'rgba(var(--paper-border), 0.3)',
                                                        border: values[dim.key] === v
                                                            ? '2px solid rgba(var(--paper-ink-muted), 0.3)'
                                                            : '1px solid transparent',
                                                    }}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    <span className="notebook-muted text-[0.65rem] w-16 shrink-0">{dim.high}</span>
                                </div>
                            </div>
                        ))}

                        {allAnswered && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="pt-2"
                            >
                                <button
                                    onClick={handleSubmit}
                                    className="w-full rounded-xl py-2.5 text-sm font-medium transition-colors"
                                    style={{
                                        backgroundColor: 'rgba(var(--brand-strong), 0.12)',
                                        color: 'rgb(var(--paper-ink))',
                                    }}
                                >
                                    Save check-in
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.section>
    );
}
