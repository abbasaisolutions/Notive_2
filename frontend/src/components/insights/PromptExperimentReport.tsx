'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AppPanel, SectionHeader, TagPill } from '@/components/ui/surface';
import useApi from '@/hooks/use-api';
import { useAuth } from '@/context/auth-context';

type PromptExperimentSurface = 'smart_prompt' | 'progressive_prompt';

interface PromptExperimentVariantReport {
    variant: string;
    impressions: number;
    accepted: number;
    dismissed: number;
    ignored: number;
    acceptanceRate: number;
    dismissalRate: number;
    ignoreRate: number;
}

interface PromptExperimentReportEntry {
    experimentId: string;
    surface: PromptExperimentSurface;
    impressions: number;
    accepted: number;
    dismissed: number;
    ignored: number;
    acceptanceRate: number;
    dismissalRate: number;
    ignoreRate: number;
    winningVariant: string | null;
    variants: PromptExperimentVariantReport[];
}

interface PromptExperimentReportPayload {
    generatedAt: string;
    rangeDays: number;
    totalExperiments: number;
    experiments: PromptExperimentReportEntry[];
}

const EMPTY_REPORT: PromptExperimentReportPayload = {
    generatedAt: new Date(0).toISOString(),
    rangeDays: 60,
    totalExperiments: 0,
    experiments: [],
};

const SURFACE_LABELS: Record<PromptExperimentSurface, { title: string; description: string }> = {
    smart_prompt: {
        title: 'Quick Prompt Style',
        description: 'Short prompts shown from live context like time, health, and momentum.',
    },
    progressive_prompt: {
        title: 'Profile Prompt Style',
        description: 'Simple profile questions that help Notive learn how to guide you.',
    },
};

const VARIANT_LABELS: Record<string, string> = {
    signal: 'Signal-led',
    momentum: 'Momentum-led',
    story: 'Story-led',
    guide: 'Guide-led',
    benefit: 'Benefit-led',
    future: 'Future-led',
};

const formatRate = (value: number): string => `${Math.round(value * 100)}%`;

const formatVariantName = (variant: string): string =>
    VARIANT_LABELS[variant] || variant.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export default function PromptExperimentReport() {
    const { accessToken } = useAuth();
    const { apiFetch } = useApi();
    const [report, setReport] = useState<PromptExperimentReportPayload>(EMPTY_REPORT);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!accessToken) {
            setIsLoading(false);
            return;
        }

        const load = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await apiFetch('/analytics/prompt-experiments?days=60');
                if (!response.ok) {
                    throw new Error('Failed to fetch prompt experiment report');
                }

                const payload = await response.json();
                setReport({
                    generatedAt: typeof payload?.generatedAt === 'string' ? payload.generatedAt : EMPTY_REPORT.generatedAt,
                    rangeDays: typeof payload?.rangeDays === 'number' ? payload.rangeDays : EMPTY_REPORT.rangeDays,
                    totalExperiments: typeof payload?.totalExperiments === 'number' ? payload.totalExperiments : 0,
                    experiments: Array.isArray(payload?.experiments) ? payload.experiments as PromptExperimentReportEntry[] : [],
                });
            } catch (loadError) {
                console.error('Prompt experiment report error:', loadError);
                setError('Prompt results are unavailable right now.');
            } finally {
                setIsLoading(false);
            }
        };

        void load();
    }, [accessToken, apiFetch]);

    const generatedLabel = useMemo(() => {
        const parsed = new Date(report.generatedAt);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        return parsed.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        });
    }, [report.generatedAt]);

    return (
        <AppPanel className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeader
                    kicker="Prompt Results"
                    title="Which prompt style gets better replies"
                    description="Notive tests different prompt styles, then keeps score on which ones people answer more often."
                />
                <div className="flex flex-wrap gap-2">
                    <TagPill tone="primary">{report.totalExperiments} experiments</TagPill>
                    <TagPill>{report.rangeDays}-day window</TagPill>
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[1, 2].map((item) => (
                        <div key={item} className="workspace-soft-panel rounded-2xl p-5">
                            <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
                            <div className="mt-3 h-4 w-64 animate-pulse rounded bg-white/10" />
                            <div className="mt-5 grid grid-cols-3 gap-3">
                                {[1, 2, 3].map((metric) => (
                                    <div key={metric} className="h-16 animate-pulse rounded-2xl bg-white/10" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="workspace-soft-panel rounded-2xl p-5 text-sm text-ink-secondary">
                    {error}
                </div>
            ) : report.experiments.length === 0 ? (
                <div className="workspace-soft-panel rounded-2xl p-5 text-sm leading-7 text-ink-secondary">
                    Prompt results will appear here after Notive has enough prompt views and replies to compare.
                </div>
            ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                    {report.experiments.map((experiment) => {
                        const labels = SURFACE_LABELS[experiment.surface];
                        return (
                            <div key={`${experiment.surface}-${experiment.experimentId}`} className="workspace-soft-panel rounded-[1.75rem] p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-2">
                                        <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">{labels.title}</p>
                                        <h3 className="workspace-heading text-lg font-semibold">
                                            {formatVariantName(experiment.winningVariant || 'No winner yet')}
                                        </h3>
                                        <p className="max-w-xl text-sm leading-7 text-ink-secondary">
                                            {labels.description}
                                        </p>
                                    </div>
                                    <TagPill tone="primary">
                                        Winner: {formatVariantName(experiment.winningVariant || 'pending')}
                                    </TagPill>
                                </div>

                                <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                                    <div className="workspace-muted-panel rounded-2xl p-3">
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Impressions</p>
                                        <p className="workspace-heading mt-2 text-lg font-semibold">{experiment.impressions}</p>
                                    </div>
                                    <div className="workspace-muted-panel rounded-2xl p-3">
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Accepted</p>
                                        <p className="workspace-heading mt-2 text-lg font-semibold">{formatRate(experiment.acceptanceRate)}</p>
                                    </div>
                                    <div className="workspace-muted-panel rounded-2xl p-3">
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Dismissed</p>
                                        <p className="workspace-heading mt-2 text-lg font-semibold">{formatRate(experiment.dismissalRate)}</p>
                                    </div>
                                    <div className="workspace-muted-panel rounded-2xl p-3">
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Ignored</p>
                                        <p className="workspace-heading mt-2 text-lg font-semibold">{formatRate(experiment.ignoreRate)}</p>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {experiment.variants.map((variant) => {
                                        const isWinner = variant.variant === experiment.winningVariant;
                                        return (
                                            <div
                                                key={variant.variant}
                                                className={`rounded-2xl border p-4 ${
                                                    isWinner
                                                        ? 'border-primary/30 bg-primary/10'
                                                        : 'workspace-soft-panel'
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="workspace-heading text-sm font-semibold">{formatVariantName(variant.variant)}</p>
                                                        <p className="text-xs text-ink-secondary">{variant.impressions} prompt views</p>
                                                    </div>
                                                    {isWinner && <TagPill tone="primary">Top style</TagPill>}
                                                </div>

                                                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Accept</p>
                                                        <p className="workspace-heading mt-1 font-semibold">{formatRate(variant.acceptanceRate)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Dismiss</p>
                                                        <p className="workspace-heading mt-1 font-semibold">{formatRate(variant.dismissalRate)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Ignore</p>
                                                        <p className="workspace-heading mt-1 font-semibold">{formatRate(variant.ignoreRate)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {generatedLabel && !isLoading && !error && (
                <p className="text-xs text-ink-muted">
                    Updated {generatedLabel}. Ignore rate means a prompt was shown but the user did not answer it.
                </p>
            )}
        </AppPanel>
    );
}
