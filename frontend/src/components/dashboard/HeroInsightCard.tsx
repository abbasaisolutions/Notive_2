'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type HeroInsight = {
    category: string;
    title: string;
    body: string;
    evidence: string | null;
    entryIds: string[];
    qualityScore: number;
};

type HeroInsightCardProps = {
    insight: HeroInsight | null;
    loading?: boolean;
    onFeedback?: (reaction: 'expanded' | 'dismissed') => void;
};

const CATEGORY_ACCENTS: Record<string, { bg: string; dot: string; label: string }> = {
    contradiction: {
        bg: 'rgba(216,199,232,0.12)',
        dot: 'rgba(216,199,232,0.95)',
        label: 'Blind spot',
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

export default function HeroInsightCard({ insight, loading, onFeedback }: HeroInsightCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [displayedBody, setDisplayedBody] = useState('');
    const [typing, setTyping] = useState(true);

    const body = insight?.body ?? '';

    // Typewriter effect
    useEffect(() => {
        if (!body) {
            setDisplayedBody('');
            setTyping(false);
            return;
        }

        setDisplayedBody('');
        setTyping(true);
        let i = 0;
        const speed = Math.max(12, Math.min(30, 1500 / body.length)); // adaptive speed

        const interval = setInterval(() => {
            i++;
            setDisplayedBody(body.slice(0, i));
            if (i >= body.length) {
                clearInterval(interval);
                setTyping(false);
            }
        }, speed);

        return () => clearInterval(interval);
    }, [body]);

    const handleExpand = useCallback(() => {
        if (!expanded) {
            setExpanded(true);
            onFeedback?.('expanded');
        }
    }, [expanded, onFeedback]);

    const handleDismiss = useCallback(() => {
        setDismissed(true);
        onFeedback?.('dismissed');
    }, [onFeedback]);

    if (dismissed) return null;

    // Loading skeleton
    if (loading) {
        return (
            <div className="notebook-card rounded-[1.75rem] p-5 animate-pulse">
                <div className="h-3 rounded-full w-24 mb-3" style={{ backgroundColor: 'rgba(var(--paper-border), 0.3)' }} />
                <div className="h-4 rounded-full w-3/4 mb-2" style={{ backgroundColor: 'rgba(var(--paper-border), 0.2)' }} />
                <div className="h-4 rounded-full w-1/2" style={{ backgroundColor: 'rgba(var(--paper-border), 0.15)' }} />
            </div>
        );
    }

    if (!insight) return null;

    const accent = CATEGORY_ACCENTS[insight.category] ?? DEFAULT_ACCENT;

    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="notebook-card rounded-[1.75rem] overflow-hidden"
            style={{ backgroundColor: accent.bg }}
        >
            <div className="p-5">
                {/* Category label */}
                <div className="flex items-center gap-2 mb-3">
                    <div
                        className="h-2 w-2 rounded-full shrink-0"
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

                {/* Title */}
                <h3
                    className="text-base font-semibold mb-2 leading-snug"
                    style={{ color: 'rgb(var(--paper-ink))' }}
                >
                    {insight.title}
                </h3>

                {/* Body with typewriter */}
                <p
                    className="notebook-copy text-[0.88rem] leading-relaxed"
                    style={{ color: 'rgb(var(--paper-ink-soft))' }}
                >
                    {displayedBody}
                    {typing && (
                        <span
                            className="inline-block w-[2px] h-[1em] ml-0.5 align-text-bottom animate-pulse"
                            style={{ backgroundColor: 'rgb(var(--paper-ink-muted))' }}
                        />
                    )}
                </p>

                {/* Evidence (expanded) */}
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
                                className="text-[0.78rem] italic"
                                style={{ color: 'rgb(var(--paper-ink-muted))' }}
                            >
                                {insight.evidence}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Actions */}
                {!typing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-2 mt-4"
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
                                Tell me more
                            </button>
                        )}
                        <button
                            onClick={handleDismiss}
                            className="rounded-lg px-3 py-2.5 text-xs transition-colors"
                            style={{ color: 'rgb(var(--paper-ink-muted))' }}
                        >
                            I knew that
                        </button>
                    </motion.div>
                )}
            </div>
        </motion.section>
    );
}
