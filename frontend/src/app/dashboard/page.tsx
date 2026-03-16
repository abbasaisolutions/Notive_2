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
import { FiCompass, FiCpu, FiEdit3, FiLayers, FiPlus, FiRepeat, FiTrendingUp } from 'react-icons/fi';
import { appendReturnTo, buildCurrentReturnTo } from '@/utils/navigation';


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
    const [entries, setEntries] = useState<Entry[]>([]);
    const [resurfacedMoments, setResurfacedMoments] = useState<ResurfacedMoment[]>([]);
    const [themeClusters, setThemeClusters] = useState<ThemeCluster[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);

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
                const [entriesResponse, resurfacedResponse, clustersResponse] = await Promise.all([
                    apiFetch(`${API_URL}/entries`, {
                        signal: controller.signal,
                    }),
                    apiFetch(`${API_URL}/entries/resurfaced?limit=3`, {
                        signal: controller.signal,
                    }).catch(() => null),
                    apiFetch(`${API_URL}/entries/theme-clusters?limit=4`, {
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
    const recommendedPrompt = onboarding?.starterPrompt?.trim() || profileRecommendedPrompt || getRecommendedPrompt(onboarding);
    const dashboardReturnTo = buildCurrentReturnTo('/dashboard', '');
    const newEntryHref = appendReturnTo('/entry/new', dashboardReturnTo);
    const recommendedHref = appendReturnTo(`/entry/new?prompt=${encodeURIComponent(recommendedPrompt)}&source=dashboard_reco`, dashboardReturnTo);
    const portfolioHref = appendReturnTo('/portfolio', dashboardReturnTo);
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

                    {/* Header Bento Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Welcome Card */}
                        <div className="lg:col-span-2 bento-box p-10 flex flex-col justify-between group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-all duration-700" />

                            <div className="relative z-10">
                                <div className="flex items-center gap-4 mb-4">
                                    <span className="section-kicker">{NOTIVE_VOICE.surfaces.homeBase}</span>
                                    <StreakCounter />
                                </div>
                                <h1 className="text-4xl md:text-5xl font-serif mb-4 leading-tight">
                                    Save today so you can use it later, <br />
                                    {firstName}.
                                </h1>
                                <p className="zen-text text-lg max-w-lg">
                                    Write what happened, come back to what matters, and turn strong moments into useful stories.
                                </p>
                            </div>

                            <div className="mt-12 flex items-center gap-4 relative z-10">
                                <Link
                                    href={newEntryHref}
                                    className="primary-cta px-8 py-4 rounded-[1.5rem] font-semibold transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                                >
                                    <FiPlus size={22} aria-hidden="true" />
                                    Write
                                </Link>
                                <Link
                                    href={portfolioHref}
                                    className="ghost-cta px-6 py-4 rounded-[1.5rem] transition-all inline-flex items-center gap-3 text-sm font-semibold"
                                >
                                    <FiEdit3 size={22} aria-hidden="true" />
                                    <span>Open {NOTIVE_VOICE.surfaces.outcomeStudio}</span>
                                </Link>
                            </div>
                        </div>

                        {/* Search & Actions Sidebar Bento */}
                        <div className="space-y-8">
                            {/* Search Box */}
                            <div className="bento-box p-8 group">
                                <h3 className="text-xl mb-4 font-serif">Search your notes</h3>
                                <SmartSearch />
                            </div>

                            {/* Stats Bento */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bento-box p-6 text-center">
                                    <div className="text-3xl font-bold text-white mb-2">{entries.length}</div>
                                    <div className="text-xs text-ink-muted uppercase tracking-widest font-bold">Notes</div>
                                </div>
                                <div className="bento-box p-6 text-center">
                                    <div className="text-3xl font-bold text-secondary mb-2">{statusValue}</div>
                                    <div className="text-xs text-ink-muted uppercase tracking-widest font-bold">{statusLabel}</div>
                                </div>
                            </div>
                        </div>
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

                    {/* Simulation & Experience Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Simulation Bento */}
                        <div className="bento-box p-8 lg:col-span-1">
                                <h3 className="text-lg mb-4 font-serif flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                    Signal sparks
                                </h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => simulateEvent('A fresh workout finished. Reflect on the energy.')}
                                        className="w-full p-4 rounded-2xl bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/25 text-xs transition-all text-left group"
                                    >
                                        <span className="flex items-center gap-2">
                                            <FiTrendingUp size={16} aria-hidden="true" />
                                            <span>Energy signal</span>
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => simulateEvent('Travel detected. What captured your eye?')}
                                        className="w-full p-4 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs transition-all text-left group"
                                    >
                                        <span className="flex items-center gap-2">
                                            <FiCompass size={16} aria-hidden="true" />
                                            <span>Fresh place</span>
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => simulateEvent('4 hours of deep work detected. How is your focus?')}
                                        className="w-full p-4 rounded-2xl bg-accent/10 hover:bg-accent/20 text-accent border border-accent/25 text-xs transition-all text-left group"
                                    >
                                        <span className="flex items-center gap-2">
                                            <FiCpu size={16} aria-hidden="true" />
                                            <span>Focus checkpoint</span>
                                        </span>
                                    </button>
                                </div>
                            </div>

                        {/* Recent Chronicles List Bento */}
                        <div className="lg:col-span-3 space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-2xl font-serif">Recent notes</h3>
                                <Link href={timelineHref} className="text-xs text-primary hover:text-white transition-colors tracking-widest font-bold uppercase">Open {NOTIVE_VOICE.surfaces.memoryAtlas}</Link>
                            </div>

                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="bento-box p-8 h-64 flex flex-col gap-4">
                                            <div className="h-8 w-3/4 rounded-lg bg-surface-2 animate-pulse" />
                                            <div className="h-4 w-full rounded-lg bg-surface-2 animate-pulse" />
                                            <div className="h-4 w-full rounded-lg bg-surface-2 animate-pulse" />
                                            <div className="h-10 w-32 mt-auto rounded-xl bg-surface-2 animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {entries.slice(0, 6).map((entry, index) => (
                                        <EntryCard key={entry.id} entry={entry} delay={index * 0.1} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}


