'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TagPill } from '@/components/ui/surface';
import useApi from '@/hooks/use-api';
import useTelemetry from '@/hooks/use-telemetry';
import { API_URL } from '@/constants/config';
import { getContradictionConfidenceMeta, getPatternConfidenceMeta } from '@/utils/insight-trust';

// ── Shared types ──────────────────────────────────────────────

type SurfaceType = 'correlation' | 'contradiction' | 'trigger';
type Reaction = 'helpful' | 'not_helpful';

type FeedbackHandler = (
    surfaceType: SurfaceType,
    entityKey: string,
    reaction: Reaction,
) => void | Promise<void>;

type FeedbackState = {
    selected: Reaction | null;
    pending: boolean;
};

type CardFeedbackProps = {
    surfaceType: SurfaceType;
    entityKey: string;
    state: FeedbackState;
    onFeedback: FeedbackHandler;
};

function CardFeedbackStrip({ surfaceType, entityKey, state, onFeedback }: CardFeedbackProps) {
    const { selected, pending } = state;
    const disabled = pending;

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[rgba(var(--paper-border),0.22)] pt-3">
            <span className="text-[0.68rem]" style={{ color: 'rgb(var(--paper-ink-muted))' }}>
                Helpful read?
            </span>
            <button
                type="button"
                onClick={() => { void onFeedback(surfaceType, entityKey, 'helpful'); }}
                disabled={disabled}
                className="rounded-lg px-2.5 py-1.5 text-[0.7rem] font-medium transition-colors"
                style={{
                    backgroundColor: selected === 'helpful'
                        ? 'rgba(var(--brand-strong), 0.14)'
                        : 'rgba(255,255,255,0.38)',
                    color: 'rgb(var(--paper-ink))',
                }}
                aria-pressed={selected === 'helpful'}
            >
                Helpful
            </button>
            <button
                type="button"
                onClick={() => { void onFeedback(surfaceType, entityKey, 'not_helpful'); }}
                disabled={disabled}
                className="rounded-lg px-2.5 py-1.5 text-[0.7rem] transition-colors"
                style={{
                    backgroundColor: selected === 'not_helpful'
                        ? 'rgba(216,199,232,0.16)'
                        : 'rgba(255,255,255,0.18)',
                    color: 'rgb(var(--paper-ink-muted))',
                }}
                aria-pressed={selected === 'not_helpful'}
            >
                Off mark
            </button>
            {selected === 'not_helpful' && (
                <span className="text-[0.66rem]" style={{ color: 'rgb(var(--paper-ink-muted))' }}>
                    We&rsquo;ll hide similar reads.
                </span>
            )}
        </div>
    );
}

// ── Correlation Card ─────────────────────────────────────────

type Correlation = {
    topic: string;
    avgMoodWhenPresent: number;
    avgMoodWhenAbsent: number;
    delta: number;
    occurrences: number;
    direction: 'lifter' | 'drain';
};

function CorrelationCard({
    data,
    feedback,
    onFeedback,
}: {
    data: Correlation;
    feedback: FeedbackState;
    onFeedback: FeedbackHandler;
}) {
    const isLifter = data.direction === 'lifter';
    const accent = isLifter ? 'rgba(199,220,203,0.95)' : 'rgba(234,216,189,0.95)';
    const confidence = getPatternConfidenceMeta(data.occurrences);

    return (
        <div className="notebook-card-soft rounded-xl p-4">
            <div className="flex items-start gap-3">
                <div
                    className="h-2.5 w-2.5 mt-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: accent }}
                    aria-hidden="true"
                />
                <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--paper-ink))' }}>
                        When you write about &ldquo;{data.topic}&rdquo;
                    </p>
                    <p className="notebook-copy text-[0.82rem] mt-1" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                        {isLifter
                            ? `your mood tends to be ${Math.abs(data.delta).toFixed(1)} points higher`
                            : `your mood tends to dip by ${Math.abs(data.delta).toFixed(1)} points`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <TagPill tone={confidence.tone}>{confidence.label}</TagPill>
                        <TagPill>{data.occurrences} {data.occurrences === 1 ? 'note' : 'notes'}</TagPill>
                        <TagPill>{data.avgMoodWhenPresent.toFixed(1)} vs {data.avgMoodWhenAbsent.toFixed(1)}</TagPill>
                    </div>
                    <p className="notebook-muted mt-2 text-[0.66rem] leading-5">
                        Why this showed up: Notive compared your mood when this topic was present versus when it was absent.
                    </p>
                    <CardFeedbackStrip
                        surfaceType="correlation"
                        entityKey={data.topic}
                        state={feedback}
                        onFeedback={onFeedback}
                    />
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

function ContradictionCard({
    data,
    feedback,
    onFeedback,
}: {
    data: Contradiction;
    feedback: FeedbackState;
    onFeedback: FeedbackHandler;
}) {
    const date = new Date(data.entryDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
    const divergenceMeta = getContradictionConfidenceMeta(data.divergenceScore);

    return (
        <div className="notebook-card-soft rounded-xl p-4">
            <div className="flex items-start gap-3">
                <div
                    className="h-2.5 w-2.5 mt-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: 'rgba(216,199,232,0.95)' }}
                    aria-hidden="true"
                />
                <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--paper-ink))' }}>
                        {data.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <TagPill tone={divergenceMeta.tone}>{divergenceMeta.label}</TagPill>
                        <TagPill>{data.statedMood}</TagPill>
                        <TagPill>{data.detectedSentiment} tone</TagPill>
                    </div>
                    <p className="notebook-muted text-[0.7rem] mt-1">
                        {date}
                        {data.entryTitle ? ` · ${data.entryTitle}` : ''}
                    </p>
                    <p className="notebook-muted mt-2 text-[0.66rem] leading-5">
                        Why this showed up: the mood you picked and the writing tone in that same note pulled in different directions.
                    </p>
                    <CardFeedbackStrip
                        surfaceType="contradiction"
                        entityKey={data.entryId}
                        state={feedback}
                        onFeedback={onFeedback}
                    />
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

function TriggerRow({
    item,
    feedback,
    onFeedback,
    accent,
}: {
    item: TriggerItem;
    feedback: FeedbackState;
    onFeedback: FeedbackHandler;
    accent: string;
}) {
    const handleOffMark = useCallback(
        () => { void onFeedback('trigger', item.entity, 'not_helpful'); },
        [onFeedback, item.entity],
    );

    if (feedback.selected === 'not_helpful') return null;

    return (
        <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
            <span className="text-xs truncate flex-1" style={{ color: 'rgb(var(--paper-ink-soft))' }}>
                {item.entity}
            </span>
            <span className="text-[0.62rem] text-[rgb(107,107,107)]">
                {item.occurrences}x
            </span>
            <button
                type="button"
                onClick={handleOffMark}
                disabled={feedback.pending}
                aria-label={`Hide ${item.entity} from triggers`}
                className="text-[0.62rem] px-1 py-0.5 rounded text-[rgb(140,140,140)] hover:text-[rgb(var(--paper-ink-muted))] transition-colors"
            >
                hide
            </button>
        </div>
    );
}

function TriggerMapCard({
    lifters,
    drains,
    feedbackMap,
    onFeedback,
}: {
    lifters: TriggerItem[];
    drains: TriggerItem[];
    feedbackMap: Record<string, FeedbackState>;
    onFeedback: FeedbackHandler;
}) {
    const getState = (entity: string): FeedbackState =>
        feedbackMap[`trigger:${entity.toLowerCase()}`] || { selected: null, pending: false };

    const visibleLifters = lifters.filter((l) => getState(l.entity).selected !== 'not_helpful').slice(0, 4);
    const visibleDrains = drains.filter((d) => getState(d.entity).selected !== 'not_helpful').slice(0, 4);

    if (visibleLifters.length === 0 && visibleDrains.length === 0) return null;

    return (
        <div className="notebook-card-soft rounded-xl p-4">
            <p className="text-sm font-medium mb-3" style={{ color: 'rgb(var(--paper-ink))' }}>
                What lifts and drains your mood
            </p>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="notebook-muted text-[0.65rem] uppercase tracking-wide mb-1.5">Lifters</p>
                    <div className="space-y-1">
                        {visibleLifters.map((item) => (
                            <TriggerRow
                                key={item.entity}
                                item={item}
                                feedback={getState(item.entity)}
                                onFeedback={onFeedback}
                                accent="rgba(199,220,203,0.95)"
                            />
                        ))}
                        {visibleLifters.length === 0 && (
                            <p className="notebook-muted text-[0.7rem]">Not enough data yet</p>
                        )}
                    </div>
                </div>

                <div>
                    <p className="notebook-muted text-[0.65rem] uppercase tracking-wide mb-1.5">Drains</p>
                    <div className="space-y-1">
                        {visibleDrains.map((item) => (
                            <TriggerRow
                                key={item.entity}
                                item={item}
                                feedback={getState(item.entity)}
                                onFeedback={onFeedback}
                                accent="rgba(234,216,189,0.95)"
                            />
                        ))}
                        {visibleDrains.length === 0 && (
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

const feedbackKey = (surfaceType: SurfaceType, entityKey: string): string =>
    `${surfaceType}:${entityKey.toLowerCase()}`;

export default function PatternDiscoveryFeed({
    correlations,
    contradictions,
    triggerMap,
}: PatternDiscoveryFeedProps) {
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();

    const hasCorrelations = correlations.length > 0;
    const hasContradictions = contradictions.length > 0;
    const hasTriggers = triggerMap.length > 0;

    const availableTabs: FeedTab[] = [];
    if (hasCorrelations) availableTabs.push('correlations');
    if (hasContradictions) availableTabs.push('contradictions');
    if (hasTriggers) availableTabs.push('triggers');

    const [activeTab, setActiveTab] = useState<FeedTab>(availableTabs[0] ?? 'correlations');
    const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackState>>({});

    const handleFeedback: FeedbackHandler = useCallback(
        async (surfaceType, entityKey, reaction) => {
            const key = feedbackKey(surfaceType, entityKey);
            const current = feedbackMap[key];
            if (current?.selected === reaction || current?.pending) return;

            setFeedbackMap((prev) => ({
                ...prev,
                [key]: { selected: reaction, pending: true },
            }));

            try {
                await apiFetch(`/ai/surface-feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ surfaceType, entityKey, reaction }),
                });

                void trackEvent({
                    eventType: 'pattern_discovery_feedback',
                    field: surfaceType,
                    value: reaction,
                    metadata: { surface: 'pattern_discovery', entityKey },
                });
            } catch {
                // keep the optimistic selection — user sees their choice registered
            } finally {
                setFeedbackMap((prev) => ({
                    ...prev,
                    [key]: { selected: reaction, pending: false },
                }));
            }
        },
        [apiFetch, feedbackMap, trackEvent],
    );

    const getFeedbackState = (surfaceType: SurfaceType, entityKey: string): FeedbackState =>
        feedbackMap[feedbackKey(surfaceType, entityKey)] || { selected: null, pending: false };

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
            <p className="notebook-muted mb-3 text-[0.72rem] leading-6">
                These are repeatable reads from your saved notes, not diagnoses. Use them to spot patterns worth checking against your own memory.
            </p>

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

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                >
                    {activeTab === 'correlations' && correlations
                        .filter((c) => getFeedbackState('correlation', c.topic).selected !== 'not_helpful')
                        .slice(0, 3)
                        .map((c, i) => (
                            <CorrelationCard
                                key={`${c.topic}-${i}`}
                                data={c}
                                feedback={getFeedbackState('correlation', c.topic)}
                                onFeedback={handleFeedback}
                            />
                        ))}

                    {activeTab === 'contradictions' && contradictions
                        .filter((c) => getFeedbackState('contradiction', c.entryId).selected !== 'not_helpful')
                        .slice(0, 3)
                        .map((c, i) => (
                            <ContradictionCard
                                key={`${c.entryId}-${i}`}
                                data={c}
                                feedback={getFeedbackState('contradiction', c.entryId)}
                                onFeedback={handleFeedback}
                            />
                        ))}

                    {activeTab === 'triggers' && (
                        <TriggerMapCard
                            lifters={lifters}
                            drains={drains}
                            feedbackMap={feedbackMap}
                            onFeedback={handleFeedback}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.section>
    );
}
