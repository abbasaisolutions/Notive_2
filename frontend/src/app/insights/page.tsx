'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAnalytics } from '@/hooks/useAnalytics';
import useTelemetry from '@/hooks/use-telemetry';
import { getMoodEmoji } from '@/constants/moods';
import { SkeletonCard, SkeletonStat } from '@/components/ui/SkeletonLoader';
import MoodRiver from '@/components/insights/MoodRiver';
import ActivityHeatmap from '@/components/insights/ActivityHeatmap';
import PredictiveInsights from '@/components/insights/PredictiveInsights';
import { ActionBar, AppPanel, SectionHeader, StatTile, TagPill } from '@/components/ui/surface';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import { writeWorkspaceResume } from '@/utils/workspace-resume';
import { FiArrowRight, FiBarChart2, FiBookOpen, FiCompass, FiTag } from 'react-icons/fi';

const PERIODS: Array<'week' | 'month' | 'year'> = ['week', 'month', 'year'];
const normalizePeriod = (value: string | null): 'week' | 'month' | 'year' =>
    value === 'month' || value === 'year' ? value : 'week';

function InsightsPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { trackEvent } = useTelemetry();
    const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>(
        () => normalizePeriod(searchParams.get('period'))
    );
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
        setSelectedPeriod((current) => (current === nextPeriod ? current : nextPeriod));
    }, [searchParams]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('period', selectedPeriod);
        window.history.replaceState({}, '', nextUrl.toString());
    }, [selectedPeriod]);

    const currentReturnTo = buildCurrentReturnTo(pathname || '/insights', `?period=${selectedPeriod}`);
    const captureHref = appendReturnTo('/entry/new?mode=quick', currentReturnTo);
    const timelineHref = appendReturnTo('/timeline', currentReturnTo);
    const portfolioHref = appendReturnTo('/portfolio', currentReturnTo);
    const editorialRecap = signature.editorialRecap;
    const thenNow = signature.thenNow;

    useEffect(() => {
        if (isLoading || error) return;

        writeWorkspaceResume({
            key: 'insights',
            title: 'Insights',
            summary: `${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} view · ${analytics.totalEntries} entries`,
            href: currentReturnTo,
            updatedAt: new Date().toISOString(),
            stage: 'reflect',
            actionLabel: 'Resume insights',
        });
    }, [analytics.totalEntries, currentReturnTo, error, isLoading, selectedPeriod]);

    if (isLoading) {
        return (
            <div className="min-h-screen pb-24">
                <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
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
                            kicker="Insights"
                            title="Insights unavailable"
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
                            kicker="Insights"
                            title="Your insights are waiting"
                            description="Start journaling to reveal emotional patterns, recurring themes, and growth markers over time."
                            className="justify-center text-center"
                        />
                        <div className="flex flex-wrap justify-center gap-3">
                            <Link
                                href={captureHref}
                                className="rounded-xl border border-primary/30 bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                            >
                                Write Your First Entry
                            </Link>
                            <Link
                                href="/dashboard"
                                className="rounded-xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white/10 hover:text-white"
                            >
                                Back to Dashboard
                            </Link>
                        </div>
                    </AppPanel>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24">
            <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
                <AppPanel className="space-y-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <SectionHeader
                            kicker="Insights"
                            title="Insight Studio"
                            description="Scan trends, confirm patterns, and decide on the next reflective move without leaving context."
                        />
                        <ActionBar className="overflow-x-auto bg-black/20 border-white/10">
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
                                Timeline
                            </Link>
                            <Link
                                href={portfolioHref}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:text-white"
                            >
                                Portfolio
                            </Link>
                        </ActionBar>
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
                        <StatTile label="Entries" value={analytics.totalEntries} hint="Across the selected period" />
                        <StatTile label="Current Streak" value={analytics.currentStreak} hint="Days in a row" tone="primary" />
                        <StatTile label="Words / Entry" value={analytics.avgWordCount} hint="Average entry volume" />
                        <StatTile
                            label="Top Mood"
                            value={(
                                <span className="inline-flex items-center gap-2">
                                    <span>{getMoodEmoji(analytics.topMood)}</span>
                                    <span className="capitalize">{analytics.topMood}</span>
                                </span>
                            )}
                            hint={`Dominant signal this ${selectedPeriod}`}
                        />
                    </div>
                </AppPanel>

                <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
                    <AppPanel tone="accent" className="space-y-4">
                        <div className="flex items-center gap-3">
                            <FiCompass size={24} className="text-white" aria-hidden="true" />
                            <SectionHeader
                                kicker="Editorial Recap"
                                title={editorialRecap.title}
                                description={editorialRecap.summary}
                            />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            {editorialRecap.highlights.map((highlight) => (
                                <div key={highlight} className="rounded-2xl border border-white/12 bg-white/5 p-4 text-sm leading-7 text-white/90">
                                    {highlight}
                                </div>
                            ))}
                        </div>
                        <div className="rounded-2xl border border-white/12 bg-black/20 p-4">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Next reflection prompt</p>
                            <p className="mt-2 text-sm leading-7 text-white">{editorialRecap.nextPrompt}</p>
                            <Link
                                href={appendReturnTo(`/entry/new?mode=quick&prompt=${encodeURIComponent(editorialRecap.nextPrompt)}`, currentReturnTo)}
                                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                            >
                                Write from this prompt
                                <FiArrowRight size={14} aria-hidden="true" />
                            </Link>
                        </div>
                    </AppPanel>

                    <AppPanel className="space-y-4">
                        <SectionHeader
                            kicker="Then vs Now"
                            title="Resurfaced comparison"
                            description="Pair a recent entry with an older moment so growth becomes easier to see, not just feel."
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
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Then · {new Date(thenNow.thenEntry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                        <h3 className="mt-2 text-base font-semibold text-white">{thenNow.thenEntry.title || 'Earlier entry'}</h3>
                                        <p className="mt-2 line-clamp-3 text-sm leading-7 text-ink-secondary">{thenNow.thenEntry.content}</p>
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
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Now · {new Date(thenNow.nowEntry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                        <h3 className="mt-2 text-base font-semibold text-white">{thenNow.nowEntry.title || 'Recent entry'}</h3>
                                        <p className="mt-2 line-clamp-3 text-sm leading-7 text-ink-secondary">{thenNow.nowEntry.content}</p>
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
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Reflection cue</p>
                                    <p className="mt-2 text-sm leading-7 text-white">{thenNow.prompt}</p>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-ink-secondary">
                                Keep journaling across a longer stretch of time and this comparison view will start resurfacing earlier moments automatically.
                            </div>
                        )}
                    </AppPanel>
                </section>

                <PredictiveInsights
                    analytics={{
                        currentStreak: analytics.currentStreak,
                        totalEntries: analytics.totalEntries,
                        moodTrend: analytics.moodTrend,
                        topMood: analytics.topMood,
                        topThemes: analytics.topThemes,
                    }}
                    currentReturnTo={currentReturnTo}
                />

                {analytics.profileContext && (
                    <AppPanel className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <SectionHeader
                                kicker="Profile Lens"
                                title="Growth context"
                                description="These scores shape how Notive frames your journal and portfolio surfaces."
                            />
                            <TagPill tone="primary">
                                {analytics.profileContext.track} track / {analytics.profileContext.stage.replace('_', ' ')}
                            </TagPill>
                        </div>
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                            <StatTile label="Completion" value={`${analytics.profileContext.completionScore}%`} hint="Profile context coverage" />
                            <StatTile label="Personal Growth" value={`${analytics.profileContext.personalGrowthScore}%`} hint="Reflective growth score" />
                            <StatTile label="Professional Readiness" value={`${analytics.profileContext.professionalReadinessScore}%`} hint="Career-oriented readiness" />
                        </div>
                    </AppPanel>
                )}

                <section className="grid gap-6 md:grid-cols-2">
                    <MoodRiver data={analytics.moodTrend} />

                    <AppPanel className="space-y-4">
                        <SectionHeader
                            kicker="Mood"
                            title="Emotion Breakdown"
                            description="Which emotional tones dominate this period."
                        />
                        <div className="space-y-3">
                            {analytics.emotionBreakdown.slice(0, 6).map((emotion, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <span className="text-2xl">{getMoodEmoji(emotion.emotion)}</span>
                                    <div className="flex-1">
                                        <div className="mb-1 flex justify-between">
                                            <span className="capitalize text-white">{emotion.emotion}</span>
                                            <span className="text-ink-secondary">{emotion.percentage}%</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${emotion.percentage}%`,
                                                    backgroundColor: emotion.color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </AppPanel>
                </section>

                <section className="grid gap-6 md:grid-cols-2">
                    <ActivityHeatmap data={heatmapData} weeks={12} />

                    <AppPanel className="space-y-5">
                        <SectionHeader
                            kicker="Themes"
                            title="Theme Constellation"
                            description="Recurring ideas and gratitude signals showing up across entries."
                        />

                        <div>
                            <p className="mb-3 text-xs uppercase tracking-[0.12em] text-ink-muted">Top themes</p>
                            <div className="flex flex-wrap gap-2">
                                {analytics.topThemes.length > 0 ? analytics.topThemes.map((theme, index) => (
                                    <span
                                        key={index}
                                        className="rounded-full border border-white/15 bg-white/5 px-3 py-2 font-semibold text-white"
                                        style={{ fontSize: `${Math.max(12, 18 - index * 2)}px` }}
                                    >
                                        #{theme.theme} ({theme.count})
                                    </span>
                                )) : (
                                    <p className="text-ink-secondary">Add tags in entries to build theme clusters.</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <p className="mb-3 text-xs uppercase tracking-[0.12em] text-ink-muted">Gratitude highlights</p>
                            <div className="space-y-2">
                                {analytics.gratitudeItems.length > 0 ? analytics.gratitudeItems.map((item, index) => (
                                    <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-3 italic text-ink-secondary">
                                        "{item}"
                                    </div>
                                )) : (
                                    <p className="text-ink-secondary">Write a gratitude line in entries to populate this section.</p>
                                )}
                            </div>
                        </div>
                    </AppPanel>
                </section>

                <AppPanel tone="accent" className="space-y-4">
                    <div className="flex items-center gap-3">
                        <FiCompass size={24} className="text-white" aria-hidden="true" />
                        <SectionHeader
                            title="Narrative Snapshot"
                            description="A compact summary of the journal signal you are producing right now."
                        />
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                        <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                            <p className="mb-2 flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                <FiBookOpen size={11} aria-hidden="true" /> Volume
                            </p>
                            <p className="text-sm font-semibold text-white">{analytics.totalEntries} entries</p>
                            <p className="mt-1 text-xs text-ink-secondary">{analytics.avgWordCount} words / entry</p>
                        </div>
                        <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                            <p className="mb-2 flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                <span>{getMoodEmoji(analytics.topMood)}</span> Tone
                            </p>
                            <p className="text-sm font-semibold capitalize text-white">{analytics.topMood}</p>
                            <p className="mt-1 text-xs text-ink-secondary">Dominant emotional signal this {selectedPeriod}</p>
                        </div>
                        <div className="rounded-xl border border-white/12 bg-white/5 p-4">
                            <p className="mb-2 flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                <FiTag size={11} aria-hidden="true" /> Themes
                            </p>
                            <p className="text-sm font-semibold text-white">
                                {analytics.topThemes.length > 0
                                    ? analytics.topThemes.slice(0, 3).map((theme) => theme.theme).join(', ')
                                    : 'No strong theme yet'}
                            </p>
                            <p className="mt-1 text-xs text-ink-secondary">Use tags consistently to sharpen clusters</p>
                        </div>
                    </div>
                </AppPanel>
            </div>
        </div>
    );
}

export default function InsightsPage() {
    return (
        <Suspense
            fallback={(
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
                </div>
            )}
        >
            <InsightsPageContent />
        </Suspense>
    );
}
