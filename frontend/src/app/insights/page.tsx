'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useTelemetry from '@/hooks/use-telemetry';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import {
    useAnalytics,
    type PatternDrilldown,
    type PatternSignal,
    type PatternTimelineFilter,
} from '@/hooks/useAnalytics';
import { getMoodEmoji } from '@/constants/moods';
import { SkeletonCard, SkeletonStat } from '@/components/ui/SkeletonLoader';
import MoodRiver from '@/components/insights/MoodRiver';
import ActivityHeatmap from '@/components/insights/ActivityHeatmap';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import SupportConstellation from '@/components/patterns/SupportConstellation';
import type { SupportMapResponse } from '@/components/patterns/types';
import { ActionBar, AppPanel, SectionHeader, StatTile, TagPill } from '@/components/ui/surface';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { writeWorkspaceResume } from '@/utils/workspace-resume';
import { FiArrowRight, FiBarChart2, FiBookOpen, FiCompass, FiRepeat } from 'react-icons/fi';

const PERIODS: Array<'week' | 'month' | 'year'> = ['week', 'month', 'year'];

const normalizePeriod = (value: string | null): 'week' | 'month' | 'year' =>
    value === 'month' || value === 'year' ? value : 'week';
const normalizeDrilldown = (value: string | null): string | null =>
    value && value.trim().length > 0 ? value : null;
const formatEntryDate = (value: string) => new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});
const buildTimelineHrefFromFilter = (
    filter: PatternTimelineFilter | undefined,
    currentReturnTo: string
) => {
    const params = new URLSearchParams();

    if (filter?.search?.trim()) {
        params.set('q', filter.search.trim());
    }

    if (filter?.theme?.trim()) {
        params.set('theme', filter.theme.trim());
    }

    if (filter?.mood?.trim()) {
        params.set('mood', filter.mood.trim());
    }

    if (filter?.date) {
        params.set('date', filter.date);
    }

    if (filter?.startDate) {
        params.set('startDate', filter.startDate);
    }

    if (filter?.endDate) {
        params.set('endDate', filter.endDate);
    }

    if (filter?.weekday?.trim()) {
        params.set('weekday', filter.weekday.trim());
    }

    if (filter?.dayPart?.trim()) {
        params.set('dayPart', filter.dayPart.trim());
    }

    const query = params.toString();

    return appendReturnTo(
        query ? `/timeline?${query}` : '/timeline',
        currentReturnTo
    );
};

const signalCardClasses: Record<PatternSignal['tone'], string> = {
    good: 'border-primary/25 bg-primary/10',
    care: 'border-zinc-400/35 bg-zinc-500/12',
    steady: 'border-white/10 bg-white/[0.03]',
};

const signalPillTones: Record<PatternSignal['tone'], 'primary' | 'muted' | 'default'> = {
    good: 'primary',
    care: 'muted',
    steady: 'default',
};

export default function InsightsPage() {
    return (
        <Suspense
            fallback={(
                <div className="flex min-h-screen items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            )}
        >
            <InsightsPageContent />
        </Suspense>
    );
}

function InsightsPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { trackEvent } = useTelemetry();
    const { apiFetch } = useApi();
    const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>(
        () => normalizePeriod(searchParams.get('period'))
    );
    const [selectedDrilldownId, setSelectedDrilldownId] = useState<string | null>(
        () => normalizeDrilldown(searchParams.get('drilldown'))
    );
    const [showDeepInsights, setShowDeepInsights] = useState<boolean>(
        () => Boolean(normalizeDrilldown(searchParams.get('drilldown')))
    );
    const [supportMap, setSupportMap] = useState<SupportMapResponse | null>(null);
    const [isSupportLoading, setIsSupportLoading] = useState(true);
    const { analytics, signature, isLoading, error } = useAnalytics(selectedPeriod);

    const heatmapData = useMemo(
        () =>
            Object.entries(analytics.activityHeatmap || {}).map(([date, count]) => ({
                date,
                count,
            })),
        [analytics.activityHeatmap]
    );

    useEffect(() => {
        const nextPeriod = normalizePeriod(searchParams.get('period'));
        const nextDrilldown = normalizeDrilldown(searchParams.get('drilldown'));
        setSelectedPeriod((current) => (current === nextPeriod ? current : nextPeriod));
        setSelectedDrilldownId((current) => (current === nextDrilldown ? current : nextDrilldown));
        if (nextDrilldown) {
            setShowDeepInsights(true);
        }
    }, [searchParams]);

    useEffect(() => {
        const controller = new AbortController();
        let mounted = true;

        const fetchSupportMap = async () => {
            setIsSupportLoading(true);
            try {
                const response = await apiFetch(`${API_URL}/ai/support-map?period=${selectedPeriod}`, {
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error('Failed to load support map');
                const data = await response.json().catch(() => null);
                if (!mounted) return;
                setSupportMap(data || null);
                void trackEvent({
                    eventType: 'support_map_loaded',
                    value: selectedPeriod,
                    metadata: {
                        anchorCount: Array.isArray(data?.anchors) ? data.anchors.length : 0,
                    },
                });
            } catch (loadError) {
                if (controller.signal.aborted) return;
                console.error('Failed to load support map:', loadError);
                if (mounted) {
                    setSupportMap(null);
                }
            } finally {
                if (mounted) {
                    setIsSupportLoading(false);
                }
            }
        };

        void fetchSupportMap();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [apiFetch, selectedPeriod, trackEvent]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('period', selectedPeriod);
        if (selectedDrilldownId) {
            nextUrl.searchParams.set('drilldown', selectedDrilldownId);
        } else {
            nextUrl.searchParams.delete('drilldown');
        }
        window.history.replaceState({}, '', nextUrl.toString());
    }, [selectedDrilldownId, selectedPeriod]);

    const currentQuery = `?period=${selectedPeriod}${selectedDrilldownId ? `&drilldown=${selectedDrilldownId}` : ''}`;
    const currentReturnTo = buildCurrentReturnTo(pathname || '/insights', currentQuery);
    const captureHref = appendReturnTo('/entry/new?mode=quick', currentReturnTo);
    const timelineHref = appendReturnTo('/timeline', currentReturnTo);
    const portfolioHref = appendReturnTo('/portfolio', currentReturnTo);
    const patternDigest = signature.patternDigest;
    const patternDrilldowns = signature.patternDrilldowns;
    const chartDrilldowns = signature.chartDrilldowns;
    const thenNow = signature.thenNow;
    const primaryPromptHref = appendReturnTo(
        `/entry/new?mode=quick&prompt=${encodeURIComponent(patternDigest.primary.prompt)}`,
        currentReturnTo
    );
    const signalPromptMap = useMemo(
        () => new Map([patternDigest.primary, ...patternDigest.supporting].map((signal) => [signal.id, signal.prompt])),
        [patternDigest.primary, patternDigest.supporting]
    );
    const allDrilldowns = useMemo(
        () => [...patternDrilldowns.items, ...chartDrilldowns.items],
        [chartDrilldowns.items, patternDrilldowns.items]
    );
    const activeDrilldown = useMemo(
        () => allDrilldowns.find((item) => item.id === selectedDrilldownId) || null,
        [allDrilldowns, selectedDrilldownId]
    );
    const activeTimelineHref = useMemo(
        () => buildTimelineHrefFromFilter(activeDrilldown?.timelineFilter, currentReturnTo),
        [activeDrilldown?.timelineFilter, currentReturnTo]
    );
    const activeTimelineLabel = activeDrilldown?.timelineFilter
        ? 'Open matching notes'
        : 'Open all notes';
    const activeChartDate = activeDrilldown?.id.startsWith('date-')
        ? activeDrilldown.id.replace(/^date-/, '')
        : null;
    const activeDrilldownPrompt = useMemo(() => {
        if (!activeDrilldown) {
            return patternDigest.primary.prompt;
        }

        const directPrompt = signalPromptMap.get(activeDrilldown.id);
        if (directPrompt) {
            return directPrompt;
        }

        if (activeDrilldown.id === 'focus-theme' && patternDigest.focus.theme) {
            return `${patternDigest.focus.theme} keeps showing up in your notes. What part of it matters most right now?`;
        }

        if (activeDrilldown.id === 'supporting-theme' && patternDigest.focus.supportingTheme) {
            return `How does ${patternDigest.focus.supportingTheme.toLowerCase()} connect to the bigger story in your notes?`;
        }

        if (activeDrilldown.id === 'emotion-shift') {
            return patternDigest.emotion.direction === 'down'
                ? 'These notes feel heavier. What has been hardest lately, and what support would help?'
                : patternDigest.emotion.direction === 'up'
                    ? 'These notes feel lighter. What seems to be helping lately?'
                    : 'These notes feel steady. What is helping you stay grounded?';
        }

        if (activeDrilldown.id === 'rhythm') {
            if (patternDigest.rhythm.bestDay && patternDigest.rhythm.bestTime) {
                return `What makes ${patternDigest.rhythm.bestDay} ${patternDigest.rhythm.bestTime.toLowerCase()} easier for writing?`;
            }
            if (patternDigest.rhythm.bestDay) {
                return `What makes ${patternDigest.rhythm.bestDay} easier for writing than other days?`;
            }
            if (patternDigest.rhythm.bestTime) {
                return `What makes ${patternDigest.rhythm.bestTime.toLowerCase()} your easiest time to write?`;
            }
        }

        if (activeDrilldown.id === 'bright-spot' && analytics.gratitudeItems[0]) {
            return `You kept noticing "${analytics.gratitudeItems[0]}". Why does it matter so much right now?`;
        }

        if (activeDrilldown.id === 'change-over-time' && thenNow) {
            return thenNow.prompt;
        }

        return patternDigest.primary.prompt;
    }, [activeDrilldown, analytics.gratitudeItems, patternDigest, signalPromptMap, thenNow]);
    const activeDrilldownPromptHref = appendReturnTo(
        `/entry/new?mode=quick&prompt=${encodeURIComponent(activeDrilldownPrompt)}`,
        currentReturnTo
    );
    const revealDeepInsights = (source: string) => {
        if (showDeepInsights) return;
        setShowDeepInsights(true);
        void trackEvent({
            eventType: 'insights_deeper_toggled',
            value: 'opened',
            metadata: {
                source,
                period: selectedPeriod,
                activeDrilldownId: selectedDrilldownId,
            },
        });
    };
    const toggleDeepInsights = () => {
        const nextValue = !showDeepInsights;
        setShowDeepInsights(nextValue);
        void trackEvent({
            eventType: 'insights_deeper_toggled',
            value: nextValue ? 'opened' : 'closed',
            metadata: {
                source: 'toggle',
                period: selectedPeriod,
                activeDrilldownId: selectedDrilldownId,
            },
        });
    };

    useEffect(() => {
        if (allDrilldowns.length === 0) {
            setSelectedDrilldownId(null);
            return;
        }

        const activeExists = selectedDrilldownId
            ? allDrilldowns.some((item) => item.id === selectedDrilldownId)
            : false;

        if (!activeExists) {
            setSelectedDrilldownId(
                patternDrilldowns.defaultId
                || patternDrilldowns.items[0]?.id
                || chartDrilldowns.items[0]?.id
                || null
            );
        }
    }, [allDrilldowns, chartDrilldowns.items, patternDrilldowns.defaultId, patternDrilldowns.items, selectedDrilldownId]);

    const selectDrilldown = (drilldown: PatternDrilldown, source: string) => {
        revealDeepInsights(source);
        setSelectedDrilldownId(drilldown.id);
        void trackEvent({
            eventType: 'pattern_drilldown_selected',
            value: drilldown.id,
            metadata: {
                period: selectedPeriod,
                source,
                label: drilldown.label,
            },
        });
    };
    const selectChartDate = (date: string, source: string) => {
        const drilldown = chartDrilldowns.items.find((item) => item.id === `date-${date.slice(0, 10)}`);
        if (!drilldown) return;
        selectDrilldown(drilldown, source);
    };

    useEffect(() => {
        if (isLoading || error) return;

        writeWorkspaceResume({
            key: 'insights',
            title: NOTIVE_VOICE.surfaces.signalStudio,
            summary: `${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} view · ${analytics.totalEntries} notes`,
            href: currentReturnTo,
            updatedAt: new Date().toISOString(),
            stage: 'reflect',
            actionLabel: `Resume ${NOTIVE_VOICE.surfaces.signalStudio.toLowerCase()}`,
        });
    }, [analytics.totalEntries, currentReturnTo, error, isLoading, selectedPeriod]);

    const hasDeepInsights = patternDigest.supporting.length > 0
        || allDrilldowns.length > 0
        || analytics.topThemes.length > 0
        || heatmapData.length > 0
        || analytics.moodTrend.length > 0
        || Boolean(thenNow)
        || Boolean(supportMap);
    const insightsOverviewTitle = patternDigest.emotion.direction === 'down'
        ? 'Recent notes feel heavier'
        : patternDigest.emotion.direction === 'up'
            ? 'Recent notes are lifting'
            : 'Recent notes are staying steady';
    const insightsOverviewDescription = patternDigest.focus.theme
        ? `${patternDigest.focus.theme} is the clearest topic in this ${selectedPeriod} view.`
        : 'A few more notes will make the topic layer easier to read.';
    const insightsOverviewFootnote = patternDigest.rhythm.bestTime
        ? `${patternDigest.rhythm.bestTime} is your easiest time to write right now.`
        : patternDigest.rhythm.bestDay
            ? `${patternDigest.rhythm.bestDay} is the day your notes show up most often.`
            : 'Your writing rhythm is still forming, which is normal early on.';
    const deepInsightsTitle = showDeepInsights
        ? 'Hide deeper analysis for now'
        : 'Open deeper analysis when you want more';
    const deepInsightsDescription = showDeepInsights
        ? 'Go back to the headline pattern, one chart, and one next prompt.'
        : 'Topic maps, note evidence, support signals, heatmaps, and change-over-time stay here until you want them.';

    if (isLoading) {
        return (
            <div className="min-h-screen pb-24">
                <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
                    <AppPanel className="space-y-4">
                        <div className="h-7 w-48 animate-pulse rounded bg-white/10" />
                        <div className="h-4 w-72 animate-pulse rounded bg-white/10" />
                    </AppPanel>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-4">
                        {[1, 2, 3, 4].map((item) => <SkeletonStat key={item} />)}
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                        {[1, 2, 3, 4].map((item) => <SkeletonCard key={item} />)}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen px-4 py-10">
                <div className="mx-auto max-w-2xl">
                    <AppPanel className="space-y-5 text-center">
                        <SectionHeader
                            kicker={NOTIVE_VOICE.surfaces.signalStudio}
                            title={`${NOTIVE_VOICE.surfaces.signalStudio} are unavailable`}
                            description={error}
                            className="justify-center text-center"
                        />
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => router.refresh()}
                                className="rounded-xl border border-primary/30 bg-primary/15 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                            >
                                Try Again
                            </button>
                        </div>
                    </AppPanel>
                </div>
            </div>
        );
    }

    if (analytics.totalEntries === 0) {
        return (
            <div className="min-h-screen px-4 py-10">
                <div className="mx-auto max-w-3xl">
                    <AppPanel className="space-y-6 text-center">
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border border-primary/20 bg-primary/10 text-white">
                            <FiBarChart2 size={42} aria-hidden="true" />
                        </div>
                        <SectionHeader
                            kicker={NOTIVE_VOICE.surfaces.signalStudio}
                            title="Your patterns will start here"
                            description="Save a few notes and Notive will show what keeps repeating, how feelings move, and where your story is growing."
                            className="justify-center text-center"
                        />
                        <div className="flex flex-wrap justify-center gap-3">
                            <Link
                                href={captureHref}
                                className="rounded-xl border border-primary/30 bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                            >
                                Write First Note
                            </Link>
                            <Link
                                href="/dashboard"
                                className="rounded-xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                            >
                                Back to {NOTIVE_VOICE.surfaces.homeBase}
                            </Link>
                        </div>
                    </AppPanel>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24">
            <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
                <AppPanel className="space-y-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <SectionHeader
                            kicker={NOTIVE_VOICE.surfaces.signalStudio}
                            title="See what matters most right now"
                            description="Notive puts the clearest pattern first, then shows what can help you understand or use it."
                        />
                        <ActionBar className="overflow-x-auto border-white/10 bg-black/20">
                            {PERIODS.map((period) => (
                                <button
                                    key={period}
                                    type="button"
                                    onClick={() => setSelectedPeriod(period)}
                                    aria-pressed={selectedPeriod === period}
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                                        selectedPeriod === period
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-ink-secondary hover:text-white'
                                    }`}
                                >
                                    {period.charAt(0).toUpperCase() + period.slice(1)}
                                </button>
                            ))}
                            <Link
                                href={timelineHref}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-white"
                            >
                                {NOTIVE_VOICE.surfaces.memoryAtlas}
                            </Link>
                            <Link
                                href={portfolioHref}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-white"
                            >
                                {NOTIVE_VOICE.surfaces.outcomeStudio}
                            </Link>
                        </ActionBar>
                    </div>
                </AppPanel>

                <AppPanel tone="accent" className="space-y-5">
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                        <div className="space-y-5">
                            <div className="flex items-center gap-3">
                                <FiCompass size={24} className="text-white" aria-hidden="true" />
                                <SectionHeader
                                    kicker="Start here"
                                    title={patternDigest.primary.title}
                                    description={patternDigest.primary.summary}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <TagPill tone={signalPillTones[patternDigest.primary.tone]}>
                                    {patternDigest.primary.label}
                                </TagPill>
                                {patternDigest.focus.theme && <TagPill>Topic: {patternDigest.focus.theme}</TagPill>}
                                {patternDigest.rhythm.bestTime && <TagPill>Best time: {patternDigest.rhythm.bestTime}</TagPill>}
                            </div>

                            <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                    {patternDigest.primary.hint}
                                </p>
                                <p className="mt-2 text-3xl font-semibold text-white">
                                    {patternDigest.primary.value}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Link
                                    href={primaryPromptHref}
                                    onClick={() => {
                                        void trackEvent({
                                            eventType: 'pattern_prompt_opened',
                                            value: patternDigest.primary.id,
                                            metadata: {
                                                period: selectedPeriod,
                                                label: patternDigest.primary.label,
                                            },
                                        });
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                                >
                                    Write from this idea
                                    <FiArrowRight size={15} aria-hidden="true" />
                                </Link>
                                <Link
                                    href={timelineHref}
                                    className="rounded-xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    Open {NOTIVE_VOICE.surfaces.memoryAtlas}
                                </Link>
                                {patternDrilldowns.items.some((item) => item.id === patternDigest.primary.id) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const drilldown = patternDrilldowns.items.find((item) => item.id === patternDigest.primary.id);
                                            if (!drilldown) return;
                                            selectDrilldown(drilldown, 'hero');
                                        }}
                                        className="rounded-xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        See notes behind this
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <StatTile label="Notes" value={analytics.totalEntries} hint={`Saved this ${selectedPeriod}`} />
                            <button
                                type="button"
                                onClick={() => {
                                    const drilldown = patternDrilldowns.items.find((item) => item.id === 'rhythm');
                                    if (!drilldown) return;
                                    selectDrilldown(drilldown, 'summary_stat');
                                }}
                                className="text-left"
                            >
                                <StatTile
                                    label="Days with notes"
                                    value={analytics.activeDays}
                                    hint={`${patternDigest.rhythm.coveragePercent}% of days`}
                                    tone="primary"
                                    className={selectedDrilldownId === 'rhythm' ? 'ring-1 ring-primary/40' : undefined}
                                />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const drilldown = patternDrilldowns.items.find((item) => item.id === 'rhythm');
                                    if (!drilldown) return;
                                    selectDrilldown(drilldown, 'summary_stat');
                                }}
                                className="text-left"
                            >
                                <StatTile
                                    label="Best day"
                                    value={patternDigest.rhythm.bestDay || 'Still forming'}
                                    hint={patternDigest.rhythm.bestDay
                                        ? `${patternDigest.rhythm.bestDayCount} notes there`
                                        : 'Keep writing to reveal it'}
                                    className={selectedDrilldownId === 'rhythm' ? 'ring-1 ring-primary/40' : undefined}
                                />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const drilldown = patternDrilldowns.items.find((item) => item.id === 'emotion-shift');
                                    if (!drilldown) return;
                                    selectDrilldown(drilldown, 'summary_stat');
                                }}
                                className="text-left"
                            >
                                <StatTile
                                    label="Main feeling"
                                    value={(
                                        <span className="inline-flex items-center gap-2">
                                            <span>{getMoodEmoji(analytics.topMood)}</span>
                                            <span className="capitalize">{analytics.topMood}</span>
                                        </span>
                                    )}
                                    hint={`Most common this ${selectedPeriod}`}
                                    className={selectedDrilldownId === 'emotion-shift' ? 'ring-1 ring-primary/40' : undefined}
                                />
                            </button>
                        </div>
                    </div>
                </AppPanel>

                <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                    <MoodRiver
                        data={analytics.moodTrend}
                        selectedDate={activeChartDate}
                        onPointSelect={(point) => selectChartDate(point.date, 'mood_river_overview')}
                    />

                    <AppPanel className="space-y-4">
                        <SectionHeader
                            kicker="Quick read"
                            title={insightsOverviewTitle}
                            description={insightsOverviewDescription}
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Main topic</p>
                                <p className="mt-2 text-xl font-semibold text-white">
                                    {patternDigest.focus.theme || 'Still forming'}
                                </p>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    {patternDigest.focus.theme
                                        ? `${patternDigest.focus.noteCount} notes came back to this topic.`
                                        : 'A few more notes will make the topic layer clearer.'}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Main feeling</p>
                                <p className="mt-2 inline-flex items-center gap-2 text-xl font-semibold text-white">
                                    <span>{getMoodEmoji(analytics.topMood)}</span>
                                    <span className="capitalize">{analytics.topMood}</span>
                                </p>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    {patternDigest.emotion.averageScore !== null
                                        ? `Average mood was ${patternDigest.emotion.averageScore}/10 in this ${selectedPeriod} view.`
                                        : 'Mood details are still forming as you add more notes.'}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Keep in mind</p>
                            <p className="mt-2 text-sm leading-7 text-white">{insightsOverviewFootnote}</p>
                        </div>

                        {hasDeepInsights && (
                            <button
                                type="button"
                                onClick={toggleDeepInsights}
                                className="w-full rounded-2xl border border-white/12 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.05]"
                            >
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Explore more</p>
                                <p className="mt-2 text-base font-semibold text-white">{deepInsightsTitle}</p>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">{deepInsightsDescription}</p>
                            </button>
                        )}
                    </AppPanel>
                </section>

                {showDeepInsights && patternDigest.supporting.length > 0 && (
                    <AppPanel className="space-y-4">
                        <SectionHeader
                            kicker="Also worth noticing"
                            title="More patterns you can use"
                            description="Open the notes behind a pattern, or turn it into your next note."
                        />
                        <div className="grid gap-4 md:grid-cols-3">
                            {patternDigest.supporting.map((signal) => {
                                const promptHref = appendReturnTo(
                                    `/entry/new?mode=quick&prompt=${encodeURIComponent(signal.prompt)}`,
                                    currentReturnTo
                                );
                                const signalDrilldown = patternDrilldowns.items.find((item) => item.id === signal.id);

                                return (
                                    <div
                                        key={signal.id}
                                        className={`rounded-2xl border p-4 transition-all hover:scale-[1.01] ${signalCardClasses[signal.tone]}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{signal.label}</p>
                                                <h3 className="mt-2 text-base font-semibold text-white">{signal.title}</h3>
                                            </div>
                                            <TagPill tone={signalPillTones[signal.tone]}>{signal.value}</TagPill>
                                        </div>
                                        <p className="mt-3 text-sm leading-7 text-ink-secondary">{signal.summary}</p>
                                        <p className="mt-4 text-xs uppercase tracking-[0.12em] text-ink-muted">{signal.hint}</p>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {signalDrilldown && (
                                                <button
                                                    type="button"
                                                    onClick={() => selectDrilldown(signalDrilldown, 'supporting_card')}
                                                    className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                                >
                                                    See notes
                                                </button>
                                            )}
                                            <Link
                                                href={promptHref}
                                                onClick={() => {
                                                    void trackEvent({
                                                        eventType: 'pattern_prompt_opened',
                                                        value: signal.id,
                                                        metadata: {
                                                            period: selectedPeriod,
                                                            label: signal.label,
                                                        },
                                                    });
                                                }}
                                                className="rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                            >
                                                Write from this
                                            </Link>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </AppPanel>
                )}

                {showDeepInsights && allDrilldowns.length > 0 && activeDrilldown && (
                    <AppPanel className="space-y-5">
                        <SectionHeader
                            kicker="Notes behind this pattern"
                            title={activeDrilldown.title}
                            description={activeDrilldown.description}
                        />

                        {activeChartDate && (
                            <div className="flex flex-wrap items-center gap-2">
                                <TagPill tone="primary">Focused day</TagPill>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedDrilldownId(patternDrilldowns.defaultId || patternDrilldowns.items[0]?.id || null);
                                    }}
                                    className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/[0.06] hover:text-white"
                                >
                                    Back to main patterns
                                </button>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {patternDrilldowns.items.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => selectDrilldown(item, 'drilldown_tabs')}
                                    className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                                        item.id === activeDrilldown.id
                                            ? 'border-primary/30 bg-primary/12 text-primary'
                                            : 'border-white/15 bg-white/[0.03] text-ink-secondary hover:bg-white/[0.06] hover:text-white'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {activeDrilldown.entries.map((entry) => (
                                    <Link
                                        key={entry.id}
                                        href={appendReturnTo(`/entry/view?id=${entry.id}`, currentReturnTo)}
                                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                                {formatEntryDate(entry.createdAt)}
                                            </p>
                                            {entry.mood && (
                                                <TagPill>{getMoodEmoji(entry.mood)} {entry.mood}</TagPill>
                                            )}
                                        </div>
                                        <p className="mt-3 text-xs uppercase tracking-[0.12em] text-primary">
                                            {entry.matchReason}
                                        </p>
                                        <h3 className="mt-2 text-base font-semibold text-white">
                                            {entry.title || 'Untitled note'}
                                        </h3>
                                        <p className="mt-2 line-clamp-4 text-sm leading-7 text-ink-secondary">
                                            {entry.content}
                                        </p>
                                        {entry.themes.length > 0 && (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {entry.themes.map((theme) => (
                                                    <span
                                                        key={`${entry.id}-${theme}`}
                                                        className="rounded-full border border-white/15 bg-black/20 px-2.5 py-1 text-xs uppercase tracking-[0.08em] text-ink-secondary"
                                                    >
                                                        {theme}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </Link>
                                ))}
                            </div>

                            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Use this view</p>
                                <p className="text-sm leading-7 text-white">
                                    Open these notes when you want to see the exact moments creating this pattern.
                                </p>
                                <Link
                                    href={activeDrilldownPromptHref}
                                    className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                                >
                                    Write about this pattern
                                    <FiArrowRight size={14} aria-hidden="true" />
                                </Link>
                                <Link
                                    href={activeTimelineHref}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                                >
                                    {activeTimelineLabel}
                                </Link>
                            </div>
                        </div>
                    </AppPanel>
                )}
                {showDeepInsights && (
                <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <AppPanel className="space-y-5">
                        <SectionHeader
                            kicker="What keeps showing up"
                            title={patternDigest.focus.theme
                                ? `${patternDigest.focus.theme} is your clearest topic`
                                : 'Your main topics are still forming'}
                            description={patternDigest.focus.theme
                                ? `${patternDigest.focus.share}% of notes touched this topic in the current view.`
                                : 'Topics get clearer when you add tags, skills, or lessons to your notes.'}
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const drilldown = patternDrilldowns.items.find((item) => item.id === 'focus-theme');
                                    if (!drilldown) return;
                                    selectDrilldown(drilldown, 'focus_panel');
                                }}
                                className={`rounded-2xl border bg-white/[0.03] p-4 text-left transition-colors ${
                                    selectedDrilldownId === 'focus-theme'
                                        ? 'border-primary/30'
                                        : 'border-white/10 hover:border-white/15'
                                }`}
                            >
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Main topic</p>
                                <p className="mt-2 text-xl font-semibold text-white">
                                    {patternDigest.focus.theme || 'Still forming'}
                                </p>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    {patternDigest.focus.theme
                                        ? `${patternDigest.focus.noteCount} notes came back to this topic.`
                                        : 'A few more notes will make the topic layer clearer.'}
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const drilldown = patternDrilldowns.items.find((item) => item.id === 'supporting-theme');
                                    if (!drilldown) return;
                                    selectDrilldown(drilldown, 'focus_panel');
                                }}
                                className={`rounded-2xl border bg-white/[0.03] p-4 text-left transition-colors ${
                                    selectedDrilldownId === 'supporting-theme'
                                        ? 'border-primary/30'
                                        : 'border-white/10 hover:border-white/15'
                                }`}
                            >
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Second topic</p>
                                <p className="mt-2 text-xl font-semibold text-white">
                                    {patternDigest.focus.supportingTheme || 'None yet'}
                                </p>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                    {patternDigest.focus.supportingTheme
                                        ? 'This often shows up near your main topic, which hints at a bigger story thread.'
                                        : 'A second theme will appear when another idea starts repeating.'}
                                </p>
                            </button>
                        </div>

                        <div>
                            <p className="mb-3 text-xs uppercase tracking-[0.12em] text-ink-muted">Topic map</p>
                            <div className="flex flex-wrap gap-2">
                                {analytics.topThemes.length > 0 ? analytics.topThemes.map((theme, index) => (
                                    <button
                                        key={`${theme.theme}-${index}`}
                                        type="button"
                                        onClick={() => {
                                            const drilldownId = index === 0 ? 'focus-theme' : index === 1 ? 'supporting-theme' : null;
                                            if (!drilldownId) return;
                                            const drilldown = patternDrilldowns.items.find((item) => item.id === drilldownId);
                                            if (!drilldown) return;
                                            selectDrilldown(drilldown, 'topic_map');
                                        }}
                                        className={`rounded-full border px-3 py-2 font-semibold text-white transition-colors ${
                                            (index === 0 && selectedDrilldownId === 'focus-theme') || (index === 1 && selectedDrilldownId === 'supporting-theme')
                                                ? 'border-primary/30 bg-primary/12'
                                                : 'border-white/15 bg-white/5 hover:border-white/25'
                                        }`}
                                        style={{ fontSize: `${Math.max(12, 18 - index * 2)}px` }}
                                    >
                                        #{theme.theme} ({theme.count})
                                    </button>
                                )) : (
                                    <p className="text-sm text-ink-secondary">
                                        Add tags, skills, or lessons to build a clearer topic map.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <p className="mb-3 text-xs uppercase tracking-[0.12em] text-ink-muted">Good things to keep</p>
                            <div className="space-y-2">
                                {analytics.gratitudeItems.length > 0 ? analytics.gratitudeItems.map((item, index) => (
                                    <div key={`${item}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3 italic text-ink-secondary">
                                        "{item}"
                                    </div>
                                )) : (
                                    <p className="text-sm text-ink-secondary">
                                        When you write one good thing in a note, Notive will keep it here.
                                    </p>
                                )}
                            </div>
                        </div>
                    </AppPanel>

                    <ActivityHeatmap
                        data={heatmapData}
                        weeks={12}
                        selectedDate={activeChartDate}
                        onDaySelect={(day) => selectChartDate(day.date, 'activity_heatmap')}
                    />
                </section>
                )}

                {showDeepInsights && (
                <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
                    <MoodRiver
                        data={analytics.moodTrend}
                        selectedDate={activeChartDate}
                        onPointSelect={(point) => selectChartDate(point.date, 'mood_river')}
                    />

                    <AppPanel className="space-y-4">
                        <SectionHeader
                            kicker="Change over time"
                            title={thenNow ? 'See what changed' : 'Your longer story will show here'}
                            description={thenNow
                                ? 'Match a recent note with an older one so change is easier to spot.'
                                : 'Keep writing over a longer stretch of time and Notive will start linking older moments to newer ones.'}
                        />

                        {thenNow ? (
                            <>
                                <div className="grid gap-3">
                                    <Link
                                        href={appendReturnTo(`/entry/view?id=${thenNow.thenEntry.id}`, currentReturnTo)}
                                        onClick={() => {
                                            void trackEvent({
                                                eventType: 'then_now_opened',
                                                value: 'then',
                                                metadata: {
                                                    entryId: thenNow.thenEntry.id,
                                                },
                                            });
                                        }}
                                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.05]"
                                    >
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                            Then · {new Date(thenNow.thenEntry.createdAt).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </p>
                                        <h3 className="mt-2 text-base font-semibold text-white">
                                            {thenNow.thenEntry.title || 'Earlier note'}
                                        </h3>
                                        <p className="mt-2 line-clamp-3 text-sm leading-7 text-ink-secondary">
                                            {thenNow.thenEntry.content}
                                        </p>
                                    </Link>

                                    <Link
                                        href={appendReturnTo(`/entry/view?id=${thenNow.nowEntry.id}`, currentReturnTo)}
                                        onClick={() => {
                                            void trackEvent({
                                                eventType: 'then_now_opened',
                                                value: 'now',
                                                metadata: {
                                                    entryId: thenNow.nowEntry.id,
                                                },
                                            });
                                        }}
                                        className="rounded-2xl border border-primary/20 bg-primary/10 p-4 transition-colors hover:bg-primary/15"
                                    >
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                            Now · {new Date(thenNow.nowEntry.createdAt).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </p>
                                        <h3 className="mt-2 text-base font-semibold text-white">
                                            {thenNow.nowEntry.title || 'Recent note'}
                                        </h3>
                                        <p className="mt-2 line-clamp-3 text-sm leading-7 text-ink-secondary">
                                            {thenNow.nowEntry.content}
                                        </p>
                                    </Link>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <TagPill tone="primary">{thenNow.daysBetween} days apart</TagPill>
                                    {thenNow.sharedThemes.map((theme) => (
                                        <TagPill key={`shared-${theme}`}>Still about #{theme}</TagPill>
                                    ))}
                                    {thenNow.emergingThemes.map((theme) => (
                                        <TagPill key={`new-${theme}`} tone="primary">Now includes #{theme}</TagPill>
                                    ))}
                                </div>

                                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Reflection question</p>
                                    <p className="mt-2 text-sm leading-7 text-white">{thenNow.prompt}</p>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-ink-secondary">
                                Add more notes across time and this section will start showing older and newer moments side by side.
                            </div>
                        )}
                    </AppPanel>
                </section>
                )}

                {showDeepInsights && (isSupportLoading ? (
                    <AppPanel className="space-y-4">
                        <SectionHeader
                            kicker="Support"
                            title="Loading your support map"
                            description="Notive is gathering the people, places, and routines that seem to steady you."
                        />
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
                            <div className="h-72 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.03]" />
                            <div className="space-y-4">
                                <div className="h-28 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.03]" />
                                <div className="h-40 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.03]" />
                            </div>
                        </div>
                    </AppPanel>
                ) : (
                    <SupportConstellation
                        supportMap={supportMap}
                        openEntryHref={(entryId) => appendReturnTo(`/entry/view?id=${entryId}`, currentReturnTo)}
                        onAnchorSelect={(anchor) => {
                            void trackEvent({
                                eventType: 'support_anchor_selected',
                                value: anchor.id,
                                metadata: {
                                    period: selectedPeriod,
                                    type: anchor.type,
                                },
                            });
                        }}
                        onCopyStarter={(anchor) => {
                            void trackEvent({
                                eventType: 'support_prompt_copied',
                                value: anchor.id,
                                metadata: {
                                    period: selectedPeriod,
                                    type: anchor.type,
                                },
                            });
                        }}
                    />
                ))}

                <AppPanel tone="accent" className="space-y-4">
                    <div className="flex items-center gap-3">
                        <FiRepeat size={22} className="text-white" aria-hidden="true" />
                        <SectionHeader
                            kicker="Next note"
                            title="Use this question to keep the pattern clear"
                            description={signature.editorialRecap.nextPrompt}
                        />
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href={appendReturnTo(
                                `/entry/new?mode=quick&prompt=${encodeURIComponent(signature.editorialRecap.nextPrompt)}`,
                                currentReturnTo
                            )}
                            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                        >
                            Write this next
                            <FiArrowRight size={14} aria-hidden="true" />
                        </Link>
                        <Link
                            href={captureHref}
                            className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                        >
                            Quick note
                        </Link>
                    </div>
                </AppPanel>

                {showDeepInsights && (
                <AppPanel className="space-y-4">
                    <SectionHeader
                        kicker="Quick facts"
                        title="A simple read of this pattern view"
                        description="These are the easiest numbers to scan when you just want the basics."
                    />
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                        <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                            <p className="mb-2 flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                <FiBookOpen size={11} aria-hidden="true" /> Notes
                            </p>
                            <p className="text-sm font-semibold text-white">{analytics.totalEntries} notes</p>
                            <p className="mt-1 text-xs text-ink-secondary">{analytics.avgWordCount} words per note</p>
                        </div>
                        <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">Rhythm</p>
                            <p className="text-sm font-semibold text-white">{patternDigest.rhythm.bestDay || 'Still forming'}</p>
                            <p className="mt-1 text-xs text-ink-secondary">
                                {patternDigest.rhythm.bestTime
                                    ? `${patternDigest.rhythm.bestTime} is your easiest time`
                                    : 'A best time will appear soon'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">Mood</p>
                            <p className="text-sm font-semibold text-white">
                                {patternDigest.emotion.direction === 'up'
                                    ? 'Lifting'
                                    : patternDigest.emotion.direction === 'down'
                                        ? 'Heavier'
                                        : 'Steady'}
                            </p>
                            <p className="mt-1 text-xs text-ink-secondary">
                                {patternDigest.emotion.averageScore !== null
                                    ? `Average ${patternDigest.emotion.averageScore}/10`
                                    : 'Mood details are still forming'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                            <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-muted">Topic</p>
                            <p className="text-sm font-semibold text-white">{patternDigest.focus.theme || 'Still forming'}</p>
                            <p className="mt-1 text-xs text-ink-secondary">
                                {patternDigest.focus.share > 0
                                    ? `${patternDigest.focus.share}% of notes`
                                    : 'A strong topic will appear soon'}
                            </p>
                        </div>
                    </div>
                </AppPanel>
                )}
            </div>
        </div>
    );
}
