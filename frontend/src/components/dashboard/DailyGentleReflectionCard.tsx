/* Optional reflection card for users who want a lighter diary prompt. */
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Surface, TagPill } from '@/components/ui/surface';
import useApi from '@/hooks/use-api';
import useTelemetry from '@/hooks/use-telemetry';
import { API_URL } from '@/constants/config';
import type { GentleReflectionDraft } from '@/services/gentle-reflection.service';

type DailyGentleReflectionCardProps = {
    reflection: GentleReflectionDraft;
    journalHref: string;
    insightsHref: string;
    portfolioHref: string;
    isDisabling: boolean;
    onAccept: () => void;
    onDismiss: () => void;
    onDisable: () => void;
    embedded?: boolean;
};

export default function DailyGentleReflectionCard({
    reflection,
    journalHref,
    insightsHref,
    portfolioHref,
    isDisabling,
    onAccept,
    onDismiss,
    onDisable,
    embedded = false,
}: DailyGentleReflectionCardProps) {
    const isCompactDashboard = embedded;
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const [trustFeedback, setTrustFeedback] = useState<'helpful' | 'not_helpful' | null>(null);
    const [trustPending, setTrustPending] = useState(false);

    useEffect(() => {
        setTrustFeedback(null);
        setTrustPending(false);
    }, [reflection.id]);

    const handleTrustFeedback = async (reaction: 'helpful' | 'not_helpful') => {
        if (trustPending || trustFeedback === reaction) return;

        setTrustFeedback(reaction);
        setTrustPending(true);

        try {
            await apiFetch(`${API_URL}/ai/surface-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    surfaceType: 'reflection',
                    entityKey: reflection.id,
                    reaction,
                }),
            });

            void trackEvent({
                eventType: 'gentle_reflection_feedback',
                field: reflection.contextLabel,
                value: reaction,
                metadata: {
                    reflectionId: reflection.id,
                    sourceLabel: reflection.sourceLabel,
                    strengthLabel: reflection.strengthLabel,
                    embedded: isCompactDashboard,
                },
            });
        } catch {
            // keep the optimistic selection — user sees their choice registered
        } finally {
            setTrustPending(false);
        }
    };

    const content = (
        <div className={isCompactDashboard ? 'space-y-3' : 'space-y-4'}>
            <div>
                <p className="section-label">Reflection prompt</p>
                <h2 className={`notebook-title mt-2 ${isCompactDashboard ? 'text-[1.02rem] leading-6 md:text-[1.15rem]' : 'text-xl md:text-[1.55rem]'}`}>
                    Treat this like a quick reading, not a final verdict.
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                    <TagPill tone="primary">{reflection.sourceLabel}</TagPill>
                    <TagPill>{reflection.contextLabel}</TagPill>
                    {reflection.strengthLabel ? <TagPill>{reflection.strengthLabel}</TagPill> : null}
                </div>
                <p className={`notebook-copy mt-3 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
                    {reflection.title}
                </p>
                <p className={`notebook-copy mt-2 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
                    {reflection.body}
                </p>
            </div>

            <div className="app-paper-soft rounded-[1.25rem] p-4">
                <p className="section-label">Why this showed up</p>
                <p className={`notebook-copy mt-2 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
                    {reflection.evidence}
                </p>
                {reflection.strengthLabel && (
                    <p className={`notebook-muted mt-2 ${isCompactDashboard ? 'text-[0.72rem] leading-5' : 'text-xs leading-6'}`}>
                        Hidden strength showing up: {reflection.strengthLabel}
                    </p>
                )}
                <p className={`notebook-muted mt-2 ${isCompactDashboard ? 'text-[0.72rem] leading-5' : 'text-xs leading-6'}`}>
                    This prompt is built from note patterns you already saved, not from a fresh live AI guess.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`notebook-muted ${isCompactDashboard ? 'text-[0.72rem] leading-5' : 'text-xs leading-6'}`}>
                        Was this explanation helpful?
                    </span>
                    <button
                        type="button"
                        onClick={() => { void handleTrustFeedback('helpful'); }}
                        disabled={trustPending}
                        className="rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                        style={{
                            backgroundColor: trustFeedback === 'helpful'
                                ? 'rgba(var(--brand-strong), 0.14)'
                                : 'rgba(255,255,255,0.38)',
                            color: 'rgb(var(--paper-ink))',
                        }}
                        aria-pressed={trustFeedback === 'helpful'}
                    >
                        Helpful
                    </button>
                    <button
                        type="button"
                        onClick={() => { void handleTrustFeedback('not_helpful'); }}
                        disabled={trustPending}
                        className="rounded-lg px-3 py-2 text-xs transition-colors"
                        style={{
                            backgroundColor: trustFeedback === 'not_helpful'
                                ? 'rgba(216,199,232,0.16)'
                                : 'rgba(255,255,255,0.18)',
                            color: 'rgb(var(--paper-ink-muted))',
                        }}
                        aria-pressed={trustFeedback === 'not_helpful'}
                    >
                        Off mark
                    </button>
                    {trustFeedback && (
                        <span className={`notebook-muted ${isCompactDashboard ? 'text-[0.72rem] leading-5' : 'text-xs leading-6'}`}>
                            Thanks. Notive will use this to tune future reflection prompts.
                        </span>
                    )}
                </div>
            </div>

            <div className="app-paper-soft rounded-[1.25rem] p-4">
                <p className="section-label">Suggested use</p>
                <p className={`notebook-title mt-2 ${isCompactDashboard ? 'text-[1rem] leading-6' : 'text-lg'}`}>Start a draft</p>
                <p className={`notebook-copy mt-2 ${isCompactDashboard ? 'text-[0.82rem] leading-6' : 'text-[0.875rem] leading-7'}`}>
                    {reflection.prompt}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Link
                    href={journalHref}
                    onClick={onAccept}
                    className="workspace-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold"
                >
                    Start a draft
                </Link>
                <button
                    type="button"
                    onClick={onDismiss}
                    className="workspace-button-outline rounded-xl px-4 py-3 text-sm font-semibold"
                >
                    Not now
                </button>
                <button
                    type="button"
                    onClick={onDisable}
                    disabled={isDisabling}
                    className="text-xs font-semibold text-[rgb(var(--paper-ink-soft))] underline-offset-4 transition-colors hover:text-[rgb(var(--paper-ink))] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isDisabling ? 'Saving...' : 'Turn off reflection prompts'}
                </button>
            </div>

            {!isCompactDashboard && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--paper-ink-muted))]">
                    <Link href={insightsHref} className="transition-colors hover:text-[rgb(var(--paper-ink))]">
                        Open patterns
                    </Link>
                    <span>·</span>
                    <Link href={portfolioHref} className="transition-colors hover:text-[rgb(var(--paper-ink))]">
                        Open growth
                    </Link>
                </div>
            )}
        </div>
    );

    if (embedded) {
        return content;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
        >
            <Surface doodle="sprout" doodleAccent="sage" className="app-paper">
                {content}
            </Surface>
        </motion.div>
    );
}
