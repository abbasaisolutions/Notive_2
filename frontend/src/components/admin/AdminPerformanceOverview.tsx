'use client';

import React, { useMemo } from 'react';
import { AppPanel, SectionHeader, StatTile, TagPill } from '@/components/ui/surface';
import { NotebookDoodle } from '@/components/dashboard/NotebookDoodles';

export type AdminPerformanceOverviewData = {
    generatedAt: string;
    population: {
        totalUsers: number;
        usersWithNotes: number;
        activeUsers7d: number;
        activeUsers30d: number;
        newUsers30d: number;
    };
    dashboard: {
        writerDnaReady: number;
        emotionalFingerprintReady: number;
        primeTimeReady: number;
        fullInsightsReady: number;
        recentJournalIntelReady: number;
        deviceContextReady: number;
        freshHeroInsightUsers: number;
    };
    content: {
        totalEntries: number;
        analyzedEntries: number;
        analysisCoverage: number;
        moodCoverage: number;
        reflectionCoverage: number;
        voiceEntryCoverage: number;
    };
    voice: {
        totalJobs30d: number;
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        canceled: number;
        completionRate: number;
    };
};

function percent(value: number, total: number) {
    return total > 0 ? Math.round((value / total) * 100) : 0;
}

function MeterRow({
    label,
    value,
    caption,
    gradient,
}: {
    label: string;
    value: number;
    caption: string;
    gradient: string;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{label}</p>
                <p className="text-sm font-semibold workspace-heading">{value}%</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full" style={{ width: `${Math.max(value, 4)}%`, background: gradient }} />
            </div>
            <p className="text-xs text-ink-secondary">{caption}</p>
        </div>
    );
}

function ObservationCard({
    title,
    detail,
}: {
    title: string;
    detail: string;
}) {
    return (
        <div className="rounded-2xl workspace-soft-panel p-4">
            <p className="text-sm font-semibold workspace-heading">{title}</p>
            <p className="mt-1.5 text-sm leading-6 text-ink-secondary">{detail}</p>
        </div>
    );
}

export default function AdminPerformanceOverview({
    overview,
}: {
    overview: AdminPerformanceOverviewData;
}) {
    const notePopulation = Math.max(overview.population.usersWithNotes, 1);
    const dashboardMeters = [
        {
            label: 'Writer DNA',
            value: percent(overview.dashboard.writerDnaReady, notePopulation),
            caption: `${overview.dashboard.writerDnaReady} note-holding users have enough writing for the first identity layer.`,
            gradient: 'linear-gradient(90deg, rgba(199,220,203,0.9), rgba(153, 211, 186, 0.8))',
        },
        {
            label: 'Fingerprint',
            value: percent(overview.dashboard.emotionalFingerprintReady, notePopulation),
            caption: `${overview.dashboard.emotionalFingerprintReady} users can unlock a stronger emotion map.`,
            gradient: 'linear-gradient(90deg, rgba(216,199,232,0.88), rgba(187, 160, 218, 0.78))',
        },
        {
            label: 'Prime Time',
            value: percent(overview.dashboard.primeTimeReady, notePopulation),
            caption: `${overview.dashboard.primeTimeReady} users have enough notes for timing-based rhythm cards.`,
            gradient: 'linear-gradient(90deg, rgba(191,214,221,0.88), rgba(130, 181, 196, 0.78))',
        },
        {
            label: 'Full Insights',
            value: percent(overview.dashboard.fullInsightsReady, notePopulation),
            caption: `${overview.dashboard.fullInsightsReady} users are at the 20-note threshold for the fuller dashboard.`,
            gradient: 'linear-gradient(90deg, rgba(240,205,184,0.88), rgba(226, 165, 128, 0.8))',
        },
    ];

    const observations = useMemo(() => {
        const cards: Array<{ title: string; detail: string }> = [];

        if (overview.content.analysisCoverage < 80) {
            cards.push({
                title: 'Analysis coverage still has room',
                detail: `${overview.content.analysisCoverage}% of notes have structured analysis, so some insight cards may stay quiet longer than expected.`,
            });
        }

        if (overview.voice.failed > 0) {
            cards.push({
                title: 'Voice pipeline needs attention',
                detail: `${overview.voice.failed} voice jobs failed in the last 30 days. This is the first place to look if speech notes feel unreliable.`,
            });
        }

        if (overview.dashboard.deviceContextReady < Math.max(1, Math.round(overview.population.activeUsers30d * 0.3))) {
            cards.push({
                title: 'Device context is still sparse',
                detail: `${overview.dashboard.deviceContextReady} users had recent device or wellness signals, so context-aware strips will stay light for most people.`,
            });
        }

        if (cards.length === 0) {
            cards.push({
                title: 'The core systems look healthy',
                detail: 'Readiness, note coverage, and voice throughput all look stable enough for the admin team to focus on edge cases rather than systemic gaps.',
            });
        }

        return cards.slice(0, 3);
    }, [overview]);

    const generatedLabel = new Date(overview.generatedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

    return (
        <AppPanel className="admin-hero-panel relative overflow-hidden space-y-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,rgba(214,185,149,0.16),transparent_48%),radial-gradient(circle_at_top_left,rgba(168,177,191,0.12),transparent_38%)]" />
            <div className="pointer-events-none absolute -right-3 top-4 hidden lg:block opacity-75">
                <NotebookDoodle name="ladder" accent="amber" className="h-20 w-20 rotate-[8deg]" />
            </div>
            <div className="pointer-events-none absolute left-4 top-24 hidden lg:block opacity-60">
                <NotebookDoodle name="star" accent="sky" className="h-14 w-14 -rotate-[14deg]" />
            </div>

            <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <SectionHeader
                    kicker="Operations"
                    title="App performance overview"
                    description="Live readiness for dashboards, note analysis, device context, and voice throughput across Notive."
                />
                <div className="flex flex-wrap gap-2 xl:max-w-[360px] xl:justify-end">
                    <TagPill tone="primary">{overview.population.totalUsers} total users</TagPill>
                    <TagPill tone="muted">{overview.population.activeUsers30d} active in 30d</TagPill>
                    <TagPill tone="muted">Updated {generatedLabel}</TagPill>
                </div>
            </div>

            <div className="relative grid gap-4 xl:grid-cols-[1.15fr_0.95fr_0.9fr]">
                <div className="rounded-[1.75rem] workspace-soft-panel p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Dashboard Readiness</p>
                            <p className="mt-1 text-lg font-semibold workspace-heading">How much of the magic can users actually see?</p>
                        </div>
                        <NotebookDoodle name="moon" accent="lilac" className="hidden h-12 w-12 opacity-70 sm:block" />
                    </div>
                    <div className="mt-5 space-y-4">
                        {dashboardMeters.map((meter) => (
                            <MeterRow
                                key={meter.label}
                                label={meter.label}
                                value={meter.value}
                                caption={meter.caption}
                                gradient={meter.gradient}
                            />
                        ))}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <StatTile label="Note holders" value={overview.population.usersWithNotes} hint="Users with at least one saved note" />
                        <StatTile label="Hero insight fresh" value={overview.dashboard.freshHeroInsightUsers} hint="Users with a fresh insight in 7d" tone="primary" />
                    </div>
                </div>

                <div className="rounded-[1.75rem] workspace-soft-panel p-5">
                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Coverage</p>
                    <p className="mt-1 text-lg font-semibold workspace-heading">How complete is the note layer?</p>
                    <div className="mt-5 space-y-4">
                        <MeterRow
                            label="Analysis"
                            value={overview.content.analysisCoverage}
                            caption={`${overview.content.analyzedEntries} of ${overview.content.totalEntries} notes can feed deterministic and AI insight cards.`}
                            gradient="linear-gradient(90deg, rgba(214,185,149,0.88), rgba(176,142,104,0.82))"
                        />
                        <MeterRow
                            label="Mood"
                            value={overview.content.moodCoverage}
                            caption="Mood coverage powers trend, trigger, and resilience comparisons."
                            gradient="linear-gradient(90deg, rgba(199,220,203,0.9), rgba(126, 190, 159, 0.78))"
                        />
                        <MeterRow
                            label="Reflection"
                            value={overview.content.reflectionCoverage}
                            caption="Reflection text is part of the deeper pattern and growth layer."
                            gradient="linear-gradient(90deg, rgba(191,214,221,0.9), rgba(129, 169, 182, 0.82))"
                        />
                        <MeterRow
                            label="Voice entries"
                            value={overview.content.voiceEntryCoverage}
                            caption="Entries with attached audio or voice-first capture."
                            gradient="linear-gradient(90deg, rgba(240,205,184,0.9), rgba(227, 171, 139, 0.82))"
                        />
                    </div>
                </div>

                <div className="rounded-[1.75rem] workspace-soft-panel p-5">
                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Voice + Activity</p>
                    <p className="mt-1 text-lg font-semibold workspace-heading">Recent pipeline and usage pulse</p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <StatTile label="Voice jobs" value={overview.voice.totalJobs30d} hint="Last 30 days" />
                        <StatTile label="Completion" value={`${overview.voice.completionRate}%`} hint="Completed jobs in 30d" tone="primary" />
                        <StatTile label="Active 7d" value={overview.population.activeUsers7d} hint="Users who wrote in 7d" />
                        <StatTile label="New 30d" value={overview.population.newUsers30d} hint="New signups in 30d" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <TagPill tone="muted">Pending {overview.voice.pending}</TagPill>
                        <TagPill tone="muted">Processing {overview.voice.processing}</TagPill>
                        <TagPill tone="primary">Completed {overview.voice.completed}</TagPill>
                        <TagPill tone="muted">Failed {overview.voice.failed}</TagPill>
                        {overview.voice.canceled > 0 && <TagPill tone="muted">Canceled {overview.voice.canceled}</TagPill>}
                    </div>
                    <div className="mt-4 rounded-2xl bg-black/15 px-4 py-3">
                        <p className="text-sm font-semibold workspace-heading">Context coverage</p>
                        <p className="mt-1 text-sm leading-6 text-ink-secondary">
                            {overview.dashboard.deviceContextReady} users had recent device or wellness context, and {overview.dashboard.recentJournalIntelReady} users had enough recent notes for the deeper journal-intelligence layer.
                        </p>
                    </div>
                </div>
            </div>

            <div className="relative grid gap-4 lg:grid-cols-3">
                {observations.map((observation) => (
                    <ObservationCard
                        key={observation.title}
                        title={observation.title}
                        detail={observation.detail}
                    />
                ))}
            </div>
        </AppPanel>
    );
}
