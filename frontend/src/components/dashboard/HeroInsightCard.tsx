'use client';

import Link from 'next/link';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TagPill } from '@/components/ui/surface';
import { getHeroInsightConfidenceMeta, getPatternScopeLabel } from '@/utils/insight-trust';

type HeroInsight = {
    category: string;
    title: string;
    body: string;
    evidence: string | null;
    entryIds: string[];
    qualityScore: number;
    freshness?: 'cached' | 'fresh';
};

type HeroInsightCardProps = {
    insight: HeroInsight | null;
    loading?: boolean;
    onFeedback?: (reaction: 'expanded' | 'dismissed' | 'helpful' | 'not_helpful') => Promise<void> | void;
    openEntryHref?: (entryId: string) => string;
};

const CATEGORY_ACCENTS: Record<string, { bg: string; dot: string; label: string }> = {
    contradiction: {
        bg: 'rgba(216,199,232,0.12)',
        dot: 'rgba(216,199,232,0.95)',
        label: 'Mismatch',
    },
    hidden_pattern: {
        bg: 'rgba(199,220,203,0.12)',
        dot: 'rgba(199,220,203,0.95)',
        label: 'Hidden pattern',
    },
    growth_signal: {
        bg: 'rgba(199,216,232,0.12)',
        dot: 'rgba(199,216,232,0.95)',
        label: 'Growth signal',
    },
    blind_spot: {
        bg: 'rgba(234,216,189,0.12)',
        dot: 'rgba(234,216,189,0.95)',
        label: 'Blind spot',
    },
    evolution: {
        bg: 'rgba(232,216,199,0.12)',
        dot: 'rgba(232,216,199,0.95)',
        label: 'Evolution',
    },
};

const DEFAULT_ACCENT = { bg: 'rgba(199,220,203,0.12)', dot: 'rgba(199,220,203,0.95)', label: 'Insight' };

export default function HeroInsightCard({ insight, loading, onFeedback, openEntryHref }: HeroInsightCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [displayedBody, setDisplayedBody] = useState('');
    const [typing, setTyping] = useState(true);
    const [selectedFeedback, setSelectedFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
    const [feedbackPending, setFeedbackPending] = useState(false);

    const body = insight?.body ?? '';
    const freshness = insight?.freshness ?? 'cached';

    useEffect(() => {
        setExpanded(false);
        setDismissed(false);
        setSelectedFeedback(null);
        setFeedbackPending(false);
    }, [insight?.title, insight?.body]);

    useEffect(() => {
        if (!body) {
            setDisplayedBody('');
            setTyping(false);
            return;
        }

        if (freshness === 'cached') {
            setDisplayedBody(body);
            setTyping(false);
            return;
        }

        setDisplayedBody('');
        setTyping(true);
        let revealed = 0;
        const tickMs = 24;
        const maxDurationMs = 1500;
        const totalSteps = Math.max(1, Math.ceil(maxDurationMs / tickMs));
        const charsPerStep = Math.max(1, Math.ceil(body.length / totalSteps));

        const interval = setInterval(() => {
            revealed = Math.min(body.length, revealed + charsPerStep);
            setDisplayedBody(body.slice(0, revealed));
            if (revealed >= body.length) {
                clearInterval(interval);
                setTyping(false);
            }
        }, tickMs);

        return () => clearInterval(interval);
    }, [body, freshness]);

    const submitFeedback = useCallback(async (reaction: 'expanded' | 'dismissed' | 'helpful' | 'not_helpful') => {
        if (!onFeedback || feedbackPending) return;

        setFeedbackPending(true);
        try {
            await onFeedback(reaction);
        } catch {
            // Non-blocking telemetry path.
        } finally {
            setFeedbackPending(false);
        }
    }, [feedbackPending, onFeedback]);

    const handleExpand = useCallback(() => {
        if (expanded || feedbackPending) return;
        setExpanded(true);
        void submitFeedback('expanded');
    }, [expanded, feedbackPending, submitFeedback]);

    const handleDismiss = useCallback(() => {
        if (feedbackPending) return;
        setDismissed(true);
        void submitFeedback('dismissed');
    }, [feedbackPending, submitFeedback]);

    const handleFeedback = useCallback((reaction: 'helpful' | 'not_helpful') => {
        if (selectedFeedback === reaction || feedbackPending) return;
        setSelectedFeedback(reaction);
        void submitFeedback(reaction);
    }, [feedbackPending, selectedFeedback, submitFeedback]);

    if (dismissed) return null;

    if (loading) {
        return (
            <div className="notebook-card rounded-[1.75rem] p-5 animate-pulse">
                <div className="mb-3 h-3 w-24 rounded-full" style={{ backgroundColor: 'rgba(var(--paper-border), 0.3)' }} />
                <div className="mb-2 h-4 w-3/4 rounded-full" style={{ backgroundColor: 'rgba(var(--paper-border), 0.2)' }} />
                <div className="h-4 w-1/2 rounded-full" style={{ backgroundColor: 'rgba(var(--paper-border), 0.15)' }} />
            </div>
        );
    }

    if (!insight) return null;

    const accent = CATEGORY_ACCENTS[insight.category] ?? DEFAULT_ACCENT;
    const confidence = getHeroInsightConfidenceMeta(insight.qualityScore, Boolean(insight.evidence), insight.entryIds.length);
    const patternScope = getPatternScopeLabel(insight.entryIds.length);
    const primaryEntryId = insight.entryIds[0] ?? null;
    const sourceEntryHref = primaryEntryId
        ? (openEntryHref ? openEntryHref(primaryEntryId) : `/entry/view?id=${primaryEntryId}`)
        : null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="notebook-card overflow-hidden rounded-[1.75rem]"
            style={{ backgroundColor: accent.bg }}
        >
            <div className="p-5">
                <div className="mb-3 flex items-center gap-2">
                    <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: accent.dot }}
                        aria-hidden="true"
                    />
                    <p
                        className="text-[0.65rem] uppercase tracking-widest"
                        style={{
                            color: 'rgb(var(--paper-ink-muted))',
                            fontFamily: 'var(--font-serif, Georgia, serif)',
                            fontStyle: 'italic',
                        }}
                    >
                        {accent.label}
                    </p>
                </div>

                <h3
                    className="mb-2 text-base font-semibold leading-snug"
                    style={{ color: 'rgb(var(--paper-ink))' }}
                >
                    {insight.title}
                </h3>

                <p
                    className="notebook-copy text-[0.88rem] leading-relaxed"
                    style={{ color: 'rgb(var(--paper-ink-soft))' }}
                >
                    {displayedBody}
                    {typing && (
                        <span
                            className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse align-text-bottom"
                            style={{ backgroundColor: 'rgb(var(--paper-ink-muted))' }}
                        />
                    )}
                </p>

                <div className="mt-4 rounded-[1.1rem] border border-[rgba(var(--paper-border),0.28)] bg-white/35 p-3">
                    <p
                        className="text-[0.66rem] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: 'rgb(var(--paper-ink-muted))' }}
                    >
                        How To Read This
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <TagPill tone={confidence.tone}>{confidence.label}</TagPill>
                        <TagPill>{patternScope}</TagPill>
                        {insight.evidence ? <TagPill>Has evidence</TagPill> : null}
                        {sourceEntryHref ? <TagPill>Source note linked</TagPill> : null}
                    </div>
                    <p
                        className="mt-2 text-[0.76rem] leading-6"
                        style={{ color: 'rgb(var(--paper-ink-soft))' }}
                    >
                        {freshness === 'fresh'
                            ? 'This is today\u2019s fresh read from your recent notes. Use it as a reflection prompt, not a final verdict.'
                            : 'This is a cached daily read from your recent notes. Use it as a reflection prompt, not a final verdict.'}
                    </p>
                </div>

                <AnimatePresence>
                    {expanded && insight.evidence && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="mt-3 pt-3"
                            style={{ borderTop: '1px solid rgba(var(--paper-border), 0.3)' }}
                        >
                            <p
                                className="text-[0.66rem] font-semibold uppercase tracking-[0.12em]"
                                style={{ color: 'rgb(var(--paper-ink-muted))' }}
                            >
                                Why This Showed Up
                            </p>
                            <p
                                className="mt-2 text-[0.78rem] italic"
                                style={{ color: 'rgb(var(--paper-ink-muted))' }}
                            >
                                {insight.evidence}
                            </p>
                            {sourceEntryHref && (
                                <Link
                                    href={sourceEntryHref}
                                    className="mt-3 inline-flex text-[0.72rem] font-semibold underline-offset-4 hover:underline"
                                    style={{ color: 'rgb(var(--paper-ink))' }}
                                >
                                    Open source note
                                </Link>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {!typing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="mt-4 flex flex-wrap items-center gap-2"
                    >
                        {insight.evidence && !expanded && (
                            <button
                                onClick={handleExpand}
                                className="rounded-lg px-3 py-2.5 text-xs font-medium transition-colors"
                                style={{
                                    backgroundColor: 'rgba(var(--brand-strong), 0.1)',
                                    color: 'rgb(var(--paper-ink))',
                                }}
                            >
                                Show evidence
                            </button>
                        )}
                        <button
                            onClick={() => handleFeedback('helpful')}
                            className="rounded-lg px-3 py-2.5 text-xs font-medium transition-colors"
                            style={{
                                backgroundColor: selectedFeedback === 'helpful'
                                    ? 'rgba(var(--brand-strong), 0.14)'
                                    : 'rgba(255,255,255,0.38)',
                                color: 'rgb(var(--paper-ink))',
                            }}
                            aria-pressed={selectedFeedback === 'helpful'}
                            disabled={feedbackPending}
                        >
                            Helpful
                        </button>
                        <button
                            onClick={() => handleFeedback('not_helpful')}
                            className="rounded-lg px-3 py-2.5 text-xs transition-colors"
                            style={{
                                backgroundColor: selectedFeedback === 'not_helpful'
                                    ? 'rgba(216,199,232,0.16)'
                                    : 'rgba(255,255,255,0.18)',
                                color: 'rgb(var(--paper-ink-muted))',
                            }}
                            aria-pressed={selectedFeedback === 'not_helpful'}
                            disabled={feedbackPending}
                        >
                            Off mark
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="rounded-lg px-3 py-2.5 text-xs transition-colors"
                            style={{ color: 'rgb(var(--paper-ink-muted))' }}
                            disabled={feedbackPending}
                        >
                            Hide for now
                        </button>
                        {selectedFeedback && (
                            <span
                                className="text-[0.72rem]"
                                style={{ color: 'rgb(var(--paper-ink-muted))' }}
                            >
                                Thanks. This will tune future insight picks.
                            </span>
                        )}
                    </motion.div>
                )}
            </div>
        </motion.section>
    );
}
