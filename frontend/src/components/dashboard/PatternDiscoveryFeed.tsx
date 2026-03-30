'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Correlation Card ─────────────────────────────────────────

type Correlation = {
    topic: string;
    avgMoodWhenPresent: number;
    avgMoodWhenAbsent: number;
    delta: number;
    occurrences: number;
    direction: 'lifter' | 'drain';
};

function CorrelationCard({ data }: { data: Correlation }) {
    const isLifter = data.direction === 'lifter';
    const accent = isLifter ? 'rgba(199,220,203,0.95)' : 'rgba(234,216,189,0.95)';

    return (
        <div className="notebook-card-soft rounded-xl p-4">
            <div className="flex items-start gap-3">
                <div
                    className="h-2.5 w-2.5 mt-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: accent }}
                    aria-hidden="true"
                />
                <div>
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--paper-ink))' }}>
                        When you write about &ldquo;{data.topic}&rdquo;
                    </p>
                    <p className="notebook-copy text-[0.82rem] mt-1" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                        {isLifter
                            ? `your mood tends to be ${Math.abs(data.delta).toFixed(1)} points higher`
                            : `your mood tends to dip by ${Math.abs(data.delta).toFixed(1)} points`}
                    </p>
                    <p className="notebook-muted text-[0.7rem] mt-1">
                        {data.occurrences} {data.occurrences === 1 ? 'note' : 'notes'}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Contradiction Card ───────────────────────────────────────

type Contradiction = {
    entryId: string;
    entryTitle: string | null;
    entryDate: string;
    statedMood: string;
    detectedSentiment: string;
    divergenceScore: number;
    description: string;
};

function ContradictionCard({ data }: { data: Contradiction }) {
    const date = new Date(data.entryDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });

    return (
        <div className="notebook-card-soft rounded-xl p-4">
            <div className="flex items-start gap-3">
                <div
                    className="h-2.5 w-2.5 mt-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: 'rgba(216,199,232,0.95)' }}
                    aria-hidden="true"
                />
                <div>
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--paper-ink))' }}>
                        {data.description}
                    </p>
                    <p className="notebook-muted text-[0.7rem] mt-1">
                        {date}
                        {data.entryTitle ? ` · ${data.entryTitle}` : ''}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Trigger Map Card ─────────────────────────────────────────

type TriggerItem = {
    entity: string;
    direction: 'lifter' | 'drain';
    avgMoodDelta: number;
    occurrences: number;
};

function TriggerMapCard({ lifters, drains }: { lifters: TriggerItem[]; drains: TriggerItem[] }) {
    if (lifters.length === 0 && drains.length === 0) return null;

    return (
        <div className="notebook-card-soft rounded-xl p-4">
            <p className="text-sm font-medium mb-3" style={{ color: 'rgb(var(--paper-ink))' }}>
                What lifts and drains your mood
            </p>
            <div className="grid grid-cols-2 gap-3">
                {/* Lifters */}
                <div>
                    <p className="notebook-muted text-[0.65rem] uppercase tracking-wide mb-1.5">Lifters</p>
                    <div className="space-y-1">
                        {lifters.slice(0, 4).map((item) => (
                            <div key={item.entity} className="flex items-center gap-1.5">
                                <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: 'rgba(199,220,203,0.95)' }} />
                                <span className="text-xs truncate" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                                    {item.entity}
                                </span>
                            </div>
                        ))}
                        {lifters.length === 0 && (
                            <p className="notebook-muted text-[0.7rem]">Not enough data yet</p>
                        )}
                    </div>
                </div>

                {/* Drains */}
                <div>
                    <p className="notebook-muted text-[0.65rem] uppercase tracking-wide mb-1.5">Drains</p>
                    <div className="space-y-1">
                        {drains.slice(0, 4).map((item) => (
                            <div key={item.entity} className="flex items-center gap-1.5">
                                <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: 'rgba(234,216,189,0.95)' }} />
                                <span className="text-xs truncate" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                                    {item.entity}
                                </span>
                            </div>
                        ))}
                        {drains.length === 0 && (
                            <p className="notebook-muted text-[0.7rem]">Not enough data yet</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Pattern Discovery Feed ───────────────────────────────────

type PatternDiscoveryFeedProps = {
    correlations: Correlation[];
    contradictions: Contradiction[];
    triggerMap: TriggerItem[];
};

type FeedTab = 'correlations' | 'contradictions' | 'triggers';

export default function PatternDiscoveryFeed({
    correlations,
    contradictions,
    triggerMap,
}: PatternDiscoveryFeedProps) {
    const hasCorrelations = correlations.length > 0;
    const hasContradictions = contradictions.length > 0;
    const hasTriggers = triggerMap.length > 0;

    const availableTabs: FeedTab[] = [];
    if (hasCorrelations) availableTabs.push('correlations');
    if (hasContradictions) availableTabs.push('contradictions');
    if (hasTriggers) availableTabs.push('triggers');

    const [activeTab, setActiveTab] = useState<FeedTab>(availableTabs[0] ?? 'correlations');

    if (availableTabs.length === 0) return null;

    const lifters = triggerMap.filter((t) => t.direction === 'lifter');
    const drains = triggerMap.filter((t) => t.direction === 'drain');

    const tabLabels: Record<FeedTab, string> = {
        correlations: 'Patterns',
        contradictions: 'Blind spots',
        triggers: 'Triggers',
    };

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="notebook-card rounded-[1.75rem] p-5"
        >
            <p
                className="section-label mb-3"
                style={{ fontStyle: 'italic', fontFamily: 'var(--font-serif, Georgia, serif)' }}
            >
                Pattern discovery
            </p>

            {/* Tabs */}
            {availableTabs.length > 1 && (
                <div className="flex gap-1.5 mb-4">
                    {availableTabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className="rounded-lg px-3 py-2.5 text-xs font-medium transition-colors"
                            style={{
                                backgroundColor: activeTab === tab
                                    ? 'rgba(var(--brand-strong), 0.1)'
                                    : 'transparent',
                                color: activeTab === tab
                                    ? 'rgb(var(--paper-ink))'
                                    : 'rgb(var(--paper-ink-muted))',
                            }}
                        >
                            {tabLabels[tab]}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                >
                    {activeTab === 'correlations' && correlations.slice(0, 3).map((c, i) => (
                        <CorrelationCard key={`${c.topic}-${i}`} data={c} />
                    ))}

                    {activeTab === 'contradictions' && contradictions.slice(0, 3).map((c, i) => (
                        <ContradictionCard key={`${c.entryId}-${i}`} data={c} />
                    ))}

                    {activeTab === 'triggers' && (
                        <TriggerMapCard lifters={lifters} drains={drains} />
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.section>
    );
}
