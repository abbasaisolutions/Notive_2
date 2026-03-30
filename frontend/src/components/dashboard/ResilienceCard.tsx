'use client';

import React from 'react';
import { motion } from 'framer-motion';

type ResilienceCardProps = {
    currentRecovery: number | null;
    previousRecovery: number | null;
    trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
    narrative: string;
    dipCount: number;
};

const TREND_ACCENT: Record<string, { color: string; label: string }> = {
    improving: { color: 'rgba(199,220,203,0.95)', label: 'Getting stronger' },
    stable: { color: 'rgba(191,214,221,0.95)', label: 'Holding steady' },
    declining: { color: 'rgba(234,216,189,0.95)', label: 'A bit harder lately' },
    insufficient_data: { color: 'rgba(var(--paper-border), 0.6)', label: 'Steady sailing' },
};

export default function ResilienceCard({
    currentRecovery,
    previousRecovery,
    trend,
    narrative,
    dipCount,
}: ResilienceCardProps) {
    const accent = TREND_ACCENT[trend] ?? TREND_ACCENT.stable;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.28 }}
            className="notebook-card-soft rounded-[1.75rem] p-5"
        >
            <div className="flex items-center gap-2 mb-3">
                <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: accent.color }}
                    aria-hidden="true"
                />
                <p
                    className="section-label"
                    style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
                >
                    Resilience
                </p>
            </div>

            <p className="notebook-copy text-sm leading-relaxed" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                {narrative}
            </p>

            {/* Visual comparison */}
            {currentRecovery !== null && previousRecovery !== null && (
                <div className="mt-4 flex gap-3">
                    <div className="flex-1 notebook-card rounded-xl p-3 text-center">
                        <p className="notebook-muted text-[0.65rem] uppercase tracking-wide">Before</p>
                        <p
                            className="text-xl font-bold tabular-nums mt-1"
                            style={{ color: 'rgb(var(--paper-ink))' }}
                        >
                            {previousRecovery}
                        </p>
                        <p className="notebook-muted text-[0.7rem]">
                            {previousRecovery === 1 ? 'entry' : 'entries'}
                        </p>
                    </div>
                    <div className="flex items-center">
                        <span className="notebook-muted text-lg">→</span>
                    </div>
                    <div className="flex-1 notebook-card rounded-xl p-3 text-center">
                        <p className="notebook-muted text-[0.65rem] uppercase tracking-wide">Now</p>
                        <p
                            className="text-xl font-bold tabular-nums mt-1"
                            style={{ color: 'rgb(var(--paper-ink))' }}
                        >
                            {currentRecovery}
                        </p>
                        <p className="notebook-muted text-[0.7rem]">
                            {currentRecovery === 1 ? 'entry' : 'entries'}
                        </p>
                    </div>
                </div>
            )}

            <p className="notebook-muted text-xs mt-3">{accent.label}</p>
        </motion.div>
    );
}
