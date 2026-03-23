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
import { NOTIVE_VOICE } from '@/content/notive-voice';
import { SmartSearch } from '@/components/search/SmartSearch';
import { FiCompass, FiCpu, FiLayers, FiPlus, FiRepeat, FiTrendingUp } from 'react-icons/fi';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';
import BridgeCard from '@/components/action/BridgeCard';
import CompassCard from '@/components/action/CompassCard';
import FallbackSupportCallout from '@/components/action/FallbackSupportCallout';
import SupportMemoryCallout from '@/components/action/SupportMemoryCallout';
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
    const recommendedPrompt = todayAction?.starter?.prompt || onboarding?.starterPrompt?.trim() || profileRecommendedPrompt || getRecommendedPrompt(onboarding);
    const dashboardReturnTo = buildCurrentReturnTo('/dashboard', '');
    const newEntryHref = appendReturnTo('/entry/new', dashboardReturnTo);
    const recommendedHref = appendReturnTo(`/entry/new?prompt=${encodeURIComponent(recommendedPrompt)}&source=dashboard_reco`, dashboardReturnTo);
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
    const todayGroundingCount = todayBrief?.groundingEntryIds?.length || todayAction?.highlights?.length || 0;
    const openDashboardEntryHref = (entryId: string) => appendReturnTo(`/entry/view?id=${entryId}`, dashboardReturnTo);
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
                                    <p className="text-lg text-white font-serif leading-relaxed">{recommendedPrompt}</p>
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


            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6 md:p-12 relative z-10">
                <div className="max-w-7xl mx-auto space-y-8">

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                        <section className="bento-box p-8 md:p-10">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="section-kicker">{NOTIVE_VOICE.surfaces.homeBase}</span>
                                <StreakCounter />
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
                                    {entries.length} notes
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-ink-secondary">
                                    {statusLabel}: {statusValue}
                                </span>
                            </div>

                            <div className="mt-4 max-w-3xl">
                                <h1 className="text-4xl font-serif leading-tight text-white md:text-5xl">
                                    Welcome back, {firstName}.
                                </h1>
                                <p className="mt-4 text-base leading-8 text-ink-secondary md:text-lg">
                                    {todayBrief?.headline || 'Pick one thing to do next: write a fresh note, reopen an important thread, or turn a strong moment into a story you can use later.'}
                                </p>
                            </div>

                            <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="max-w-2xl">
                                        <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Start here</p>
                                        <p className="mt-2 text-lg font-semibold text-white">{recommendedPrompt}</p>
                                        <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                            Current focus: {onboardingTrackLabel}. Use this as a quick prompt if you want an easy way back into writing.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <Link
                                            href={newEntryHref}
                                            className="primary-cta inline-flex items-center gap-3 rounded-[1.25rem] px-6 py-3 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            <FiPlus size={18} aria-hidden="true" />
                                            Write now
                                        </Link>
                                        <Link
                                            href={timelineHref}
                                            className="rounded-[1.25rem] border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white/[0.06] hover:text-white"
                                        >
                                            Open Memories
                                        </Link>
                                        <Link
                                            href={portfolioHref}
                                            className="rounded-[1.25rem] border border-white/12 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-ink-secondary transition-colors hover:bg-white/[0.06] hover:text-white"
                                        >
                                            Open Stories
                                        </Link>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
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

                            {todayAction && (
                                <div className="mt-6 space-y-5">
                                    <SafetyBanner risk={todayAction.risk} safetyCard={todayAction.safetyCard} surface="dashboard" compact />

                                    <div className="grid gap-4 md:grid-cols-2">
                                        <CompassCard
                                            kicker="Now"
                                            title={todayBrief?.headline || 'Start with one honest note'}
                                            body={todayBrief?.pattern || 'Once there is a little history, Notive can start turning notes into grounded next moves.'}
                                            grounding={todayGroundingCount > 0 ? `Built from ${todayGroundingCount} recent note${todayGroundingCount === 1 ? '' : 's'}` : 'Built from recent notes'}
                                        />
                                        <CompassCard
                                            kicker="Next Move"
                                            title={todayBrief?.nextMove?.label || 'Write one honest note'}
                                            body={todayBrief?.nextMove?.description || recommendedPrompt}
                                            grounding={todayBrief?.followUpPrompt || 'One useful next move beats solving everything at once.'}
                                            accent="primary"
                                        />
                                        <CompassCard
                                            kicker="Reach Out"
                                            title={todayBrief?.reachOut?.label || 'One person who feels steady'}
                                            body={todayBrief?.reachOut?.rationale || 'When things feel heavier, a short check-in with a real person can help.'}
                                            grounding={todayFallbackSupport
                                                ? 'A backup lane is ready if this still feels heavy'
                                                : todaySupportMemory
                                                ? 'Grounded in your past support history'
                                                : todayBrief?.reachOut?.draftStarter
                                                    ? `Try saying: ${todayBrief.reachOut.draftStarter}`
                                                    : 'Human support stays visible by design.'}
                                            accent="support"
                                        />
                                        <CompassCard
                                            kicker="Keep"
                                            title={todayBrief?.keep?.label || 'Quiet proof is building'}
                                            body={todayBrief?.keep?.evidence || 'Small notes can become strengths, stories, and future evidence over time.'}
                                            grounding={todayBrief?.whatHelpedBefore?.summary ? 'Grounded in what helped before' : 'Grounded in repeated patterns'}
                                        />
                                    </div>

                                    {!todayBridge && (todaySupportMemory || todayFallbackSupport) && (
                                        <div className={`grid gap-3 ${todaySupportMemory && todayFallbackSupport ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                                            {todaySupportMemory && (
                                                <SupportMemoryCallout
                                                    memory={todaySupportMemory}
                                                    title="Why This Person Is Showing Up Today"
                                                    className="border-white/10 bg-[linear-gradient(135deg,rgba(16,64,56,0.28),rgba(8,12,22,0.78))]"
                                                />
                                            )}

                                            {todayFallbackSupport && (
                                                <FallbackSupportCallout
                                                    fallback={todayFallbackSupport}
                                                    title="If This Still Feels Heavy Today"
                                                    surface="dashboard"
                                                    className="border-white/10 bg-[linear-gradient(135deg,rgba(94,67,20,0.26),rgba(8,12,22,0.78))]"
                                                />
                                            )}
                                        </div>
                                    )}

                                    {(todayBrief?.whatHelpedBefore || todayAction.highlights.length > 0) && (
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
                                                            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-muted">{highlight.createdAt}</p>
                                                            <p className="mt-2 text-sm font-semibold text-white">{highlight.title || 'Untitled note'}</p>
                                                            <p className="mt-2 text-sm leading-6 text-ink-secondary">{highlight.excerpt}</p>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        <aside className="grid gap-4">
                            {todayBridge && (
                                <BridgeCard
                                    bridge={todayBridge}
                                    surface="dashboard"
                                    openEntryHref={openDashboardEntryHref}
                                    onCopyDraft={() => handleDashboardBridgeCopy(todayBridge.recommendedRecipient)}
                                />
                            )}

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
                                        <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">{todayBridge ? 'Action Console' : 'Next place to look'}</p>
                                        <h2 className="mt-2 text-lg font-semibold text-white">{todayBridge ? 'Keep one human move visible' : 'Memories for context, outputs for reuse'}</h2>
                                        <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                            {todayBridge
                                                ? 'Bridge Builder stays separate from journaling on purpose. You can copy the draft above, then come back here to reopen context or turn a note into a future-ready story.'
                                                : 'Search when you know what you need. Open Memories to browse the archive. Jump straight into Resume, Statement, or Interview when you already know the output you want.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Link
                                        href={timelineHref}
                                        className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.08]"
                                    >
                                        Reopen timeline
                                    </Link>
                                    <Link
                                        href={recommendedHref}
                                        className="rounded-full border border-primary/30 bg-primary/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/20"
                                    >
                                        Use starter prompt
                                    </Link>
                                    <Link
                                        href={resumeHref}
                                        className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.08]"
                                    >
                                        Open resume
                                    </Link>
                                    <Link
                                        href={statementHref}
                                        className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.08]"
                                    >
                                        Open statement
                                    </Link>
                                    <Link
                                        href={interviewHref}
                                        className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink-secondary transition-colors hover:text-white hover:bg-white/[0.08]"
                                    >
                                        Open interview
                                    </Link>
                                </div>
                            </div>
                        </aside>
                    </div>

                    {(resurfacedMoments.length > 0 || themeClusters.length > 0) && (
                        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-8">
                            {resurfacedMoments.length > 0 && (
                                <section className="bento-box p-8 space-y-4">
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
                                                <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-ink-muted">
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
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {moment.matchReasons.slice(0, 2).map((reason) => (
                                                        <span key={`${moment.sourceEntry.id}-${reason}`} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-ink-secondary">
                                                            {reason}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {themeClusters.length > 0 && (
                                <section className="bento-box p-8 space-y-4">
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
                                                    <span className="rounded-full border border-secondary/30 bg-secondary/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-secondary">
                                                        {cluster.label}
                                                    </span>
                                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-ink-secondary">
                                                        {cluster.entryCount} notes
                                                    </span>
                                                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-ink-secondary">
                                                        {Math.round(cluster.averageSimilarity * 100)}% cohesion
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-ink-secondary">{cluster.summary}</p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {cluster.topThemes.slice(0, 3).map((theme) => (
                                                        <span key={`${cluster.id}-${theme}`} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-ink-secondary">
                                                            #{theme}
                                                        </span>
                                                    ))}
                                                </div>
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

                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-2xl font-serif">Recent notes</h3>
                            <Link href={timelineHref} className="text-xs text-primary hover:text-white transition-colors tracking-widest font-bold uppercase">Open {NOTIVE_VOICE.surfaces.memoryAtlas}</Link>
                        </div>

                        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">Writing sparks</p>
                                    <p className="mt-2 text-sm leading-7 text-ink-secondary">
                                        Use a quick nudge if you want one fast writing direction without leaving home.
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
                                {entries.slice(0, 6).map((entry, index) => (
                                    <EntryCard key={entry.id} entry={entry} delay={index * 0.1} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}


