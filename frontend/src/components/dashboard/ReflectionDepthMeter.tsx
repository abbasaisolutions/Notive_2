'use client';

import React from 'react';
import { motion } from 'framer-motion';

type ReflectionDepthMeterProps = {
    level: 0 | 1 | 2 | 3 | 4;
    levelLabel: string;
    score: number;
    progressToNext: number;
};

const LEVEL_LABELS = ['Surface', 'Noticing', 'Connecting', 'Pattern-finding', 'Integrating'];
const LEVEL_DESCRIPTIONS = [
    'Recording what happened',
    'Naming what you feel',
    'Linking events to emotions',
    'Seeing recurring themes',
    'Extracting lessons that stick',
];

export default function ReflectionDepthMeter({
    level,
    levelLabel,
    score,
    progressToNext,
}: ReflectionDepthMeterProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.28 }}
            className="notebook-card-soft rounded-[1.75rem] p-5"
        >
            <p
                className="section-label mb-3"
                style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
            >
                Reflection depth
            </p>

            {/* Depth levels */}
            <div className="space-y-1.5">
                {LEVEL_LABELS.map((label, i) => {
                    const isActive = i <= level;
                    const isCurrent = i === level;

                    return (
                        <div key={label} className="flex items-center gap-2.5">
                            {/* Level indicator */}
                            <div
                                className="h-2 rounded-full transition-all shrink-0"
                                style={{
                                    width: `${12 + i * 6}px`,
                                    backgroundColor: isActive
                                        ? 'rgba(var(--brand-strong), 0.7)'
                                        : 'rgba(var(--paper-border), 0.4)',
                                }}
                            />
                            <span
                                className="text-xs"
                                style={{
                                    color: isCurrent
                                        ? 'rgb(var(--paper-ink))'
                                        : isActive
                                            ? 'rgb(var(--paper-ink-soft))'
                                            : 'rgb(var(--paper-ink-muted))',
                                    fontWeight: isCurrent ? 600 : 400,
                                }}
                            >
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Progress to next */}
            {level < 4 && (
                <div className="mt-4">
                    <div className="flex items-center justify-between mb-1">
                        <p className="notebook-muted text-[0.7rem]">
                            Progress to {LEVEL_LABELS[level + 1]}
                        </p>
                        <p className="notebook-muted text-[0.7rem] tabular-nums">
                            {Math.round(progressToNext * 100)}%
                        </p>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ backgroundColor: 'rgba(var(--paper-border), 0.4)' }}>
                        <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: 'rgba(var(--brand-strong), 0.55)' }}
                            initial={{ width: 0 }}
                            animate={{ width: `${progressToNext * 100}%` }}
                            transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
                        />
                    </div>
                </div>
            )}

            <p className="notebook-copy text-[0.82rem] mt-3" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                {LEVEL_DESCRIPTIONS[level]}
            </p>
        </motion.div>
    );
}
