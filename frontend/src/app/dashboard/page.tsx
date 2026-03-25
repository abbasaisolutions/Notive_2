'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSmartContext } from '@/context/smart-context';
import StreakCounter from '@/components/gamification/StreakCounter';
import EntryCard from '@/components/ui/EntryCard';
import useApi from '@/hooks/use-api';
import { API_URL } from '@/constants/config';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { getOnboardingState, getOnboardingStateFromProfile, getRecommendedPrompt, OnboardingState } from '@/utils/onboarding';
import { progressivePersonalizationService } from '@/services/progressive-personalization.service';
import { buildHomeActionContent } from '@/services/home-action.service';
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { SmartSearch } from '@/components/search/SmartSearch';
import { FiCompass, FiCpu, FiLayers, FiPlus, FiRepeat, FiTrendingUp } from 'react-icons/fi';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import BridgeCard from '@/components/action/BridgeCard';
import type { StudentActionResponse } from '@/components/action/types';
import SafetyBanner from '@/components/safety/SafetyBanner';
import useTelemetry from '@/hooks/use-telemetry';


interface Entry {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    coverImage: string | null;
    audioUrl?: string | null;
    createdAt: string;
}

interface ResurfacedMoment {
    sourceEntry: {
        id: string;
        title: string | null;
        createdAt: string;
    };
    matchedEntry: {
        id: string;
        title: string | null;
        contentPreview: string;
        mood: string | null;
        createdAt: string;
    };
    relevance: number;
    matchReasons: string[];
}

interface ThemeCluster {
    id: string;
    label: string;
    summary: string;
    entryCount: number;
    dominantMood: string | null;
    topThemes: string[];
    averageSimilarity: number;
    representativeEntries: Array<{
        id: string;
        title: string | null;
        contentPreview: string;
        createdAt: string;
        mood: string | null;
    }>;
}

export default function DashboardPage() {
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { simulateEvent } = useSmartContext();
    const { apiFetch } = useApi();
    const { trackEvent } = useTelemetry();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [resurfacedMoments, setResurfacedMoments] = useState<ResurfacedMoment[]>([]);
    const [themeClusters, setThemeClusters] = useState<ThemeCluster[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
    const [todayAction, setTodayAction] = useState<StudentActionResponse | null>(null);
    const [showExploreDeck, setShowExploreDeck] = useState(false);

    useEffect(() => {
        const fromProfile = getOnboardingStateFromProfile(user?.profile);
        if (fromProfile) {
            setOnboarding(fromProfile);
            return;
        }

        setOnboarding(getOnboardingState(user?.id));
    }, [user]);

    useEffect(() => {
        const controller = new AbortController();
        let mounted = true;

        const fetchEntries = async () => {
            setIsLoading(true);
            try {
                const [entriesResponse, resurfacedResponse, clustersResponse, actionResponse] = await Promise.all([
                    apiFetch(`${API_URL}/entries`, {
                        signal: controller.signal,
                    }),
                    apiFetch(`${API_URL}/entries/resurfaced?limit=3`, {
                        signal: controller.signal,
                    }).catch(() => null),
                    apiFetch(`${API_URL}/entries/theme-clusters?limit=4`, {
                        signal: controller.signal,
                    }).catch(() => null),
                    apiFetch(`${API_URL}/ai/action/today`, {
                        signal: controller.signal,
                    }).catch(() => null),
                ]);

                if (mounted && entriesResponse.ok) {
                    const data = await entriesResponse.json();
                    setEntries(data.entries);
                }

                if (mounted && resurfacedResponse?.ok) {
                    const data = await resurfacedResponse.json().catch(() => null);
                    setResurfacedMoments(Array.isArray(data?.resurfaced) ? data.resurfaced : []);
                } else if (mounted) {
                    setResurfacedMoments([]);
                }

                if (mounted && clustersResponse?.ok) {
                    const data = await clustersResponse.json().catch(() => null);
                    setThemeClusters(Array.isArray(data?.clusters) ? data.clusters : []);
                } else if (mounted) {
                    setThemeClusters([]);
                }

                if (mounted && actionResponse?.ok) {
                    const data = await actionResponse.json().catch(() => null);
                    setTodayAction(data || null);
                } else if (mounted) {
                    setTodayAction(null);
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error('Failed to fetch entries:', error);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        if (user) {
            fetchEntries();
        }

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [user, apiFetch]);

    const profileRecommendedPrompt = progressivePersonalizationService.getPromptSuggestionForProfile(user?.profile);
    const fallbackRecommendedPrompt = onboarding?.starterPrompt?.trim() || profileRecommendedPrompt || getRecommendedPrompt(onboarding);
    const dashboardReturnTo = buildCurrentReturnTo('/dashboard', '');
    const newEntryHref = appendReturnTo('/entry/new?mode=quick', dashboardReturnTo);
    const guideHref = appendReturnTo('/chat', dashboardReturnTo);
    const portfolioHref = appendReturnTo('/portfolio', dashboardReturnTo);
    const resumeHref = appendReturnTo('/portfolio?view=export&pack=resume', dashboardReturnTo);
    const statementHref = appendReturnTo('/portfolio?view=export&pack=statement', dashboardReturnTo);
    const interviewHref = appendReturnTo('/portfolio?view=interview', dashboardReturnTo);
    const timelineHref = appendReturnTo('/timeline', dashboardReturnTo);
    const onboardingTrackLabel = onboarding?.track === 'career'
        ? 'Career Growth'
        : onboarding?.track === 'life'
            ? 'Personal Growth'
            : onboarding?.track === 'both'
                ? 'Life + Career Growth'
                : 'Personal Reflection';
    const statusValue = onboarding?.completed ? 'Ready' : 'Setup';
    const statusLabel = 'Status';
    const todayBrief = todayAction?.brief || null;
    const todayBridge = todayAction?.bridge || null;
    const todaySupportMemory = todayBrief?.reachOut?.supportMemory || todayBridge?.supportMemory || null;
    const todayFallbackSupport = todayBrief?.reachOut?.fallbackSupport || todayBridge?.fallbackSupport || null;
    const openDashboardEntryHref = (entryId: string) => appendReturnTo(`/entry/view?id=${entryId}`, dashboardReturnTo);
    const latestEntry = entries[0] || null;
    const homeAction = buildHomeActionContent({
        todayAction,
        entries,
        onboardingTrackLabel,
        fallbackPrompt: fallbackRecommendedPrompt,
    });
    const recommendedHref = appendReturnTo(`/entry/new?mode=quick&prompt=${encodeURIComponent(homeAction.prompt)}&source=dashboard_one_thing`, dashboardReturnTo);
    const hasExploreDeck = Boolean(
        todayBridge
        || todaySupportMemory
        || todayFallbackSupport
        || todayBrief?.whatHelpedBefore
        || (todayAction?.highlights?.length || 0) > 0
        || resurfacedMoments.length > 0
        || themeClusters.length > 0
    );
    const handleDashboardBridgeCopy = (recipient: string) => {
        void trackEvent({
            eventType: 'student_bridge_copied',
            field: 'recipient',
            value: recipient,
            metadata: {
                surface: 'dashboard',
                riskLevel: todayAction?.risk.level || 'none',
            },
        });
    };
    const handleToggleExploreDeck = () => {
        const nextValue = !showExploreDeck;
        setShowExploreDeck(nextValue);
        void trackEvent({
            eventType: 'dashboard_explore_toggled',
            value: nextValue ? 'opened' : 'closed',
            metadata: {
                hasBridge: Boolean(todayBridge),
                hasSupportContext: Boolean(todaySupportMemory || todayFallbackSupport),
                resurfacedCount: resurfacedMoments.length,
                clusterCount: themeClusters.length,
            },
        });
    };
    const handleStartOneThing = () => {
        void trackEvent({
            eventType: 'dashboard_primary_cta',
            field: 'one_thing',
            value: homeAction.scenario,
            metadata: {
                label: homeAction.primaryCtaLabel,
                promptSource: homeAction.promptSource,
                groundingCount: homeAction.groundingCount,
                riskLevel: todayAction?.risk.level || 'none',
            },
        });
    };


    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }
    const safeUser = user!;
    const firstName = safeUser.name ? safeUser.name.split(' ')[0] : 'there';
    const isEmptyDashboard = !isLoading && entries.length === 0;

    if (isEmptyDashboard) {
        return (
            <div className="min-h-screen flex relative page-transition">
                <main className="flex-1 overflow-y-auto p-6 md:p-12 relative z-10">
                    <div className="max-w-6xl mx-auto space-y-8">
                        <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_0.9fr] gap-8">
                            <section className="bento-box p-10 md:p-12 flex flex-col justify-between gap-8">
                                <div>
                                    <div className="flex items-center gap-4 mb-4">
                                        <span className="section-kicker">First Signal</span>
                                        <StreakCounter />
                                    </div>
                                    <h1 className="text-4xl md:text-5xl font-serif mb-4 leading-tight">
                                        Start with one note, <br />
                                        {firstName}.
                                    </h1>
                                    <p className="zen-text text-lg max-w-xl">
                                        One honest note is enough. Notive can help you find patterns and build your story after you save it.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                    <Link
                                        href={recommendedHref}
                                        className="primary-cta px-8 py-4 rounded-[1.5rem] font-semibold transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                                    >
                                        <FiPlus size={22} aria-hidden="true" />
                                        Write Your First Note
                                    </Link>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="bento-box p-8">
                                    <p className="text-xs uppercase tracking-[0.18em] text-ink-muted mb-3">Starter Spark</p>
                                    <p className="text-lg text-white font-serif leading-relaxed">{homeAction.prompt}</p>
                                </div>

                                <div className="bento-box p-8">
                                    <div className="grid gap-4">
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted mb-1">Focus</p>
                                            <p className="text-sm text-white">{onboardingTrackLabel}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted mb-1">Time</p>
                                            <p className="text-sm text-white">Two to five minutes is enough to save something useful.</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted mb-1">After Save</p>
                                            <p className="text-sm text-white">You can fix details later while Notive starts finding patterns in the note.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex relative page-transition">


            <main className="flex-1 overflow-y-auto p-6 md:p-12 relative z-10">
                <div className="max-w-6xl mx-auto space-y-6">

                    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                        <div className="bento-box p-8 md:p-10">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="section-kicker">{NOTIVE_VOICE.surfaces.homeBase}</span>
                                <StreakCounter />
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.12em] text-ink-secondary">
                                    {entries.length} notes
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.12em] text-ink-secondary">
                                    {statusLabel}: {statusValue}
                                </span>
                            </div>

                            <div className="mt-4 max-w-3xl">
                                <h1 className="text-4xl font-serif leading-tight text-white md:text-5xl">
                                    Welcome back, {firstName}.
                                </h1>
                                <p className="mt-4 text-base leading-8 text-ink-secondary md:text-lg">
                                    {homeAction.intro}
                                </p>
                            </div>

                            <div className="mt-6 rounded-[1.85rem] border border-primary/20 bg-[linear-gradient(135deg,rgba(45,84,198,0.18),rgba(8,12,22,0.82))] p-6 md:p-7">
                                <p className="text-xs uppercase tracking-[0.14em] text-primary/80">One Thing</p>
                                <h2 className="mt-3 text-2xl font-serif text-white md:text-[2rem]">{homeAction.title}</h2>
                                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/90 md:text-base">
                                    {homeAction.body}
                                </p>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <Link
                                        href={recommendedHref}
                                        onClick={handleStartOneThing}
                                        className="primary-cta inline-flex items-center gap-3 rounded-[1.25rem] px-6 py-3 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <FiPlus size={18} aria-hidden="true" />
                                        {homeAction.primaryCtaLabel}
                                    </Link>
                                    <Link
                                        href={timelineHref}
                                        className="rounded-[1.25rem] border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-white/[0.10] hover:text-white"
                                    >
                                        Open Memories
                                    </Link>
                                </div>
                                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">Why this is showing up</p>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">{homeAction.evidence}</p>
                                </div>
                            </div>

                            {todayAction && (
                                <div className="mt-5">
                                    <SafetyBanner risk={todayAction.risk} safetyCard={todayAction.safetyCard} surface="dashboard" compact />
                                </div>
                            )}
                        </div>

                        <aside className="grid gap-4">
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Continue</p>
                                {latestEntry ? (
                                    <>
                                        <h2 className="mt-2 text-lg font-semibold text-white">{latestEntry.title || 'Recent note'}</h2>
                                        <p className="mt-2 text-sm leading-7 text-ink-secondary">{latestEntry.content.slice(0, 150)}{latestEntry.content.length > 150 ? '...' : ''}</p>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Link
                                                href={appendReturnTo(`/entry/view?id=${latestEntry.id}`, dashboardReturnTo)}
                                                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-white/[0.08] hover:text-white"
                                            >
                                                Open last note
                                            </Link>
                                            <Link
                                                href={newEntryHref}
                                                className="rounded-full border border-primary/30 bg-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/20"
                                            >
                                                Write another
                                            </Link>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h2 className="mt-2 text-lg font-semibold text-white">Pick up gently</h2>
                                        <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                            Keep the session light. Save one note now, then come back only when you want more depth.
                                        </p>
                                    </>
                                )}
                            </div>

                            <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-6">
                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Small Wins</p>
                                <h2 className="mt-2 text-lg font-semibold text-white">{homeAction.smallWinTitle}</h2>
                                <p className="mt-2 text-sm leading-7 text-ink-secondary">{homeAction.smallWinBody}</p>
                            </div>

                            {hasExploreDeck && (
                                <button
                                    type="button"
                                    onClick={handleToggleExploreDeck}
                                    className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 text-left transition-colors hover:bg-white/[0.05]"
                                >
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Explore</p>
                                    <h2 className="mt-2 text-lg font-semibold text-white">
                                        {showExploreDeck ? 'Hide the deeper tools for now' : 'Open more from your notes'}
                                    </h2>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                        {showExploreDeck
                                            ? 'Go back to one clear next move.'
                                            : 'Search, story tools, and deeper pattern views stay here when you want them.'}
                                    </p>
                                </button>
                            )}
                        </aside>
                    </section>

                    {hasExploreDeck && showExploreDeck && (
                        <section className="rounded-[2rem] border border-white/10 bg-surface-2/30 p-5 md:p-6">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Explore More</p>
                                    <h2 className="mt-1 text-2xl font-serif text-white">Open the deeper tools only when you want them</h2>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                        Search, reuse, and reflection live here so Home can stay focused on one next move.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleToggleExploreDeck}
                                    className="rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:bg-white/[0.08] hover:text-white"
                                >
                                    Close Explore
                                </button>
                            </div>

                            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
                                <div className="space-y-4">
                                    {todayBridge && (
                                        <BridgeCard
                                            bridge={todayBridge}
                                            surface="dashboard"
                                            openEntryHref={openDashboardEntryHref}
                                            onCopyDraft={() => handleDashboardBridgeCopy(todayBridge.recommendedRecipient)}
                                        />
                                    )}

                                    {!todayBridge && (todaySupportMemory || todayFallbackSupport) && (
                                        <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(135deg,rgba(92,76,28,0.18),rgba(8,12,22,0.78))] p-5">
                                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Support</p>
                                            <h3 className="mt-2 text-lg font-semibold text-white">
                                                {todaySupportMemory ? 'Someone steady has helped before' : 'Keep one support option nearby'}
                                            </h3>
                                            <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                                {todaySupportMemory?.summary || todayFallbackSupport?.rationale || 'A real person can stay visible in the background while you keep journaling.'}
                                            </p>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <Link
                                                    href={guideHref}
                                                    className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-white/[0.08] hover:text-white"
                                                >
                                                    Open Guide
                                                </Link>
                                                <Link
                                                    href={timelineHref}
                                                    className="rounded-full border border-primary/30 bg-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/20"
                                                >
                                                    Reopen timeline
                                                </Link>
                                            </div>
                                        </div>
                                    )}

                                    {todayAction && (todayBrief?.whatHelpedBefore || todayAction.highlights.length > 0) && (
                                        <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/30 bg-primary/12 text-primary">
                                                    <FiRepeat size={18} aria-hidden="true" />
                                                </span>
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">What Helped Before</p>
                                                    <h3 className="text-xl font-serif text-white">Reopen a steadier thread</h3>
                                                </div>
                                            </div>
                                            {todayBrief?.whatHelpedBefore && (
                                                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                    <p className="text-sm leading-7 text-white/90">{todayBrief.whatHelpedBefore.summary}</p>
                                                    {todayBrief.whatHelpedBefore.entryId && (
                                                        <Link
                                                            href={appendReturnTo(`/entry/view?id=${todayBrief.whatHelpedBefore.entryId}`, dashboardReturnTo)}
                                                            className="mt-3 inline-flex rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:bg-white/[0.08] hover:text-white"
                                                        >
                                                            Open that note
                                                        </Link>
                                                    )}
                                                </div>
                                            )}
                                            {todayAction.highlights.length > 0 && (
                                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                    {todayAction.highlights.slice(0, 2).map((highlight) => (
                                                        <Link
                                                            key={highlight.id}
                                                            href={appendReturnTo(`/entry/view?id=${highlight.id}`, dashboardReturnTo)}
                                                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]"
                                                        >
                                                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">{highlight.createdAt}</p>
                                                            <p className="mt-2 text-sm font-semibold text-white">{highlight.title || 'Untitled note'}</p>
                                                            <p className="mt-2 text-sm leading-6 text-ink-secondary">{highlight.excerpt}</p>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="bento-box p-6">
                                        <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Quick search</p>
                                        <h2 className="mt-2 text-xl font-serif text-white">Find a note or topic fast</h2>
                                        <div className="mt-4">
                                            <SmartSearch />
                                        </div>
                                    </div>

                                    <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6">
                                        <div className="flex items-start gap-3">
                                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/12 text-primary">
                                                <FiLayers size={18} aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Stories and outputs</p>
                                                <h2 className="mt-2 text-lg font-semibold text-white">Reuse what your notes are already teaching you</h2>
                                                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                                    When you need them, stories, statements, and interview examples stay here instead of crowding your first decision.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Link
                                                href={portfolioHref}
                                                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.08]"
                                            >
                                                Open stories
                                            </Link>
                                            <Link
                                                href={resumeHref}
                                                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.08]"
                                            >
                                                Resume
                                            </Link>
                                            <Link
                                                href={statementHref}
                                                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.08]"
                                            >
                                                Statement
                                            </Link>
                                            <Link
                                                href={interviewHref}
                                                className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.08]"
                                            >
                                                Interview
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {(resurfacedMoments.length > 0 || themeClusters.length > 0) && (
                                <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                                    {resurfacedMoments.length > 0 && (
                                        <section className="bento-box p-6 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/30 bg-primary/12 text-primary">
                                                    <FiRepeat size={18} aria-hidden="true" />
                                                </span>
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Written Before</p>
                                                    <h3 className="text-xl font-serif text-white">Past notes echoing back</h3>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                {resurfacedMoments.map((moment) => (
                                                    <div key={`${moment.sourceEntry.id}-${moment.matchedEntry.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                                            <span>{new Date(moment.sourceEntry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                            <span className="h-1 w-1 rounded-full bg-white/25" />
                                                            <span>{Math.round(moment.relevance * 100)}% match</span>
                                                        </div>
                                                        <p className="mt-2 text-sm text-white">
                                                            <span className="font-semibold">{moment.sourceEntry.title || 'Recent note'}</span>
                                                            {' '}connects back to{' '}
                                                            <Link href={appendReturnTo(`/entry/view?id=${moment.matchedEntry.id}`, dashboardReturnTo)} className="text-primary hover:text-white transition-colors">
                                                                {moment.matchedEntry.title || 'an older note'}
                                                            </Link>
                                                        </p>
                                                        <p className="mt-2 text-sm leading-6 text-ink-secondary">{moment.matchedEntry.contentPreview}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {themeClusters.length > 0 && (
                                        <section className="bento-box p-6 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-secondary/30 bg-secondary/12 text-secondary">
                                                    <FiLayers size={18} aria-hidden="true" />
                                                </span>
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Theme Clusters</p>
                                                    <h3 className="text-xl font-serif text-white">Your archive is forming themes</h3>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                {themeClusters.map((cluster) => (
                                                    <div key={cluster.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="rounded-full border border-secondary/30 bg-secondary/10 px-2 py-1 text-xs uppercase tracking-[0.08em] text-secondary">
                                                                {cluster.label}
                                                            </span>
                                                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-xs uppercase tracking-[0.08em] text-ink-secondary">
                                                                {cluster.entryCount} notes
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 text-ink-secondary">{cluster.summary}</p>
                                                        <div className="mt-3 space-y-2">
                                                            {cluster.representativeEntries.slice(0, 2).map((entry) => (
                                                                <Link
                                                                    key={entry.id}
                                                                    href={appendReturnTo(`/entry/view?id=${entry.id}`, dashboardReturnTo)}
                                                                    className="block rounded-xl border border-white/8 bg-black/20 px-3 py-2 transition-colors hover:border-white/15 hover:bg-black/30"
                                                                >
                                                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                                                        {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                    </p>
                                                                    <p className="mt-1 text-sm font-semibold text-white">{entry.title || 'Untitled note'}</p>
                                                                    <p className="mt-1 text-xs leading-6 text-ink-secondary">{entry.contentPreview}</p>
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Writing sparks</p>
                                        <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                            Use one quick nudge only when you want help getting started.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => simulateEvent('A fresh workout finished. Reflect on the energy.')}
                                            className="inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-secondary/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-secondary transition-colors hover:bg-secondary/20"
                                        >
                                            <FiTrendingUp size={14} aria-hidden="true" />
                                            Energy
                                        </button>
                                        <button
                                            onClick={() => simulateEvent('Travel detected. What captured your eye?')}
                                            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                        >
                                            <FiCompass size={14} aria-hidden="true" />
                                            Fresh place
                                        </button>
                                        <button
                                            onClick={() => simulateEvent('4 hours of deep work detected. How is your focus?')}
                                            className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-accent transition-colors hover:bg-accent/20"
                                        >
                                            <FiCpu size={14} aria-hidden="true" />
                                            Focus
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-2xl font-serif">Recent notes</h3>
                            <Link href={timelineHref} className="text-xs text-primary hover:text-white transition-colors tracking-widest font-bold uppercase">Open {NOTIVE_VOICE.surfaces.memoryAtlas}</Link>
                        </div>

                        {isLoading ? (
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="bento-box h-64 p-8 flex flex-col gap-4">
                                        <div className="h-8 w-3/4 rounded-lg bg-surface-2 animate-pulse" />
                                        <div className="h-4 w-full rounded-lg bg-surface-2 animate-pulse" />
                                        <div className="h-4 w-full rounded-lg bg-surface-2 animate-pulse" />
                                        <div className="mt-auto h-10 w-32 rounded-xl bg-surface-2 animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {entries.slice(0, 4).map((entry, index) => (
                                    <EntryCard key={entry.id} entry={entry} delay={index * 0.08} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}


