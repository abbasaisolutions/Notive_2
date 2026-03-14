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
import { FiCompass, FiCpu, FiEdit3, FiPlus, FiSearch, FiTrendingUp } from 'react-icons/fi';
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

export default function DashboardPage() {
    const { user, isLoading: authLoading, isAuthenticated } = useAuthRedirect();
    const { simulateEvent } = useSmartContext();
    const { apiFetch } = useApi();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

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
                const queryParams = new URLSearchParams();
                if (debouncedSearch) queryParams.append('search', debouncedSearch);

                const response = await apiFetch(`${API_URL}/entries?${queryParams.toString()}`, {
                    signal: controller.signal,
                });

                if (mounted && response.ok) {
                    const data = await response.json();
                    setEntries(data.entries);
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
    }, [user, debouncedSearch, apiFetch]);

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
                : 'Personal Journal';
    const isSearching = debouncedSearch.trim().length > 0;
    const statusValue = isSearching
        ? `${entries.length}`
        : onboarding?.completed
            ? 'Ready'
            : 'Setup';
    const statusLabel = isSearching ? 'Matches' : 'Status';


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
    const isEmptyDashboard = !isLoading && !isSearching && entries.length === 0;

    if (isEmptyDashboard) {
        return (
            <div className="min-h-screen flex relative page-transition">
                <main className="flex-1 overflow-y-auto p-6 md:p-12 relative z-10">
                    <div className="max-w-6xl mx-auto space-y-8">
                        <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_0.9fr] gap-8">
                            <section className="bento-box p-10 md:p-12 flex flex-col justify-between gap-8">
                                <div>
                                    <div className="flex items-center gap-4 mb-4">
                                        <span className="section-kicker">First Entry</span>
                                        <StreakCounter />
                                    </div>
                                    <h1 className="text-4xl md:text-5xl font-serif mb-4 leading-tight">
                                        Write your first entry, <br />
                                        {firstName}.
                                    </h1>
                                    <p className="zen-text text-lg max-w-xl">
                                        Start with one reflection. You can organize it, tag it, and explore insights after the entry is saved.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                    <Link
                                        href={recommendedHref}
                                        className="primary-cta px-8 py-4 rounded-[1.5rem] font-semibold transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                                    >
                                        <FiPlus size={22} aria-hidden="true" />
                                        Write Your First Entry
                                    </Link>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <div className="bento-box p-8">
                                    <p className="text-xs uppercase tracking-[0.18em] text-ink-muted mb-3">Recommended Start</p>
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
                                            <p className="text-sm text-white">2 to 5 minutes is enough.</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted mb-1">After Save</p>
                                            <p className="text-sm text-white">Add details, create collections, and review insights later.</p>
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
                                    <span className="section-kicker">Dashboard</span>
                                    <StreakCounter />
                                </div>
                                <h1 className="text-4xl md:text-5xl font-serif mb-4 leading-tight">
                                    Keep your entries moving, <br />
                                    {firstName}.
                                </h1>
                                <p className="zen-text text-lg max-w-lg">
                                    Capture new experiences, review recent entries, and turn them into usable insight.
                                </p>
                            </div>

                            <div className="mt-12 flex items-center gap-4 relative z-10">
                                <Link
                                    href={newEntryHref}
                                    className="primary-cta px-8 py-4 rounded-[1.5rem] font-semibold transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                                >
                                    <FiPlus size={22} aria-hidden="true" />
                                    Write Entry
                                </Link>
                                <Link
                                    href={portfolioHref}
                                    className="ghost-cta px-6 py-4 rounded-[1.5rem] transition-all inline-flex items-center gap-3 text-sm font-semibold"
                                >
                                    <FiEdit3 size={22} aria-hidden="true" />
                                    <span>Open Portfolio</span>
                                </Link>
                            </div>
                        </div>

                        {/* Search & Actions Sidebar Bento */}
                        <div className="space-y-8">
                            {/* Search Box */}
                            <div className="bento-box p-8 group">
                                <h3 className="text-xl mb-4 font-serif">Search Entries</h3>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Find an entry..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface-1/50 border border-white/15 text-white placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-serif"
                                    />
                                    <FiSearch size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-ink-muted group-focus-within:text-primary transition-colors" aria-hidden="true" />
                                    {searchQuery !== debouncedSearch && (
                                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats Bento */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bento-box p-6 text-center">
                                    <div className="text-3xl font-bold text-white mb-2">{entries.length}</div>
                                    <div className="text-xs text-ink-muted uppercase tracking-widest font-bold">Entries</div>
                                </div>
                                <div className="bento-box p-6 text-center">
                                    <div className="text-3xl font-bold text-secondary mb-2">{statusValue}</div>
                                    <div className="text-xs text-ink-muted uppercase tracking-widest font-bold">{statusLabel}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Simulation & Experience Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Simulation Bento */}
                        <div className="bento-box p-8 lg:col-span-1">
                                <h3 className="text-lg mb-4 font-serif flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                    Prompt Ideas
                                </h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => simulateEvent('A fresh workout finished. Reflect on the energy.')}
                                        className="w-full p-4 rounded-2xl bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/25 text-xs transition-all text-left group"
                                    >
                                        <span className="flex items-center gap-2">
                                            <FiTrendingUp size={16} aria-hidden="true" />
                                            <span>Energy Check</span>
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => simulateEvent('Travel detected. What captured your eye?')}
                                        className="w-full p-4 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-xs transition-all text-left group"
                                    >
                                        <span className="flex items-center gap-2">
                                            <FiCompass size={16} aria-hidden="true" />
                                            <span>Travel Lens</span>
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => simulateEvent('4 hours of deep work detected. How is your focus?')}
                                        className="w-full p-4 rounded-2xl bg-accent/10 hover:bg-accent/20 text-accent border border-accent/25 text-xs transition-all text-left group"
                                    >
                                        <span className="flex items-center gap-2">
                                            <FiCpu size={16} aria-hidden="true" />
                                            <span>Focus Sync</span>
                                        </span>
                                    </button>
                                </div>
                            </div>

                        {/* Recent Chronicles List Bento */}
                        <div className="lg:col-span-3 space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-2xl font-serif">Recent Entries</h3>
                                <Link href={timelineHref} className="text-xs text-primary hover:text-white transition-colors tracking-widest font-bold uppercase">View Timeline</Link>
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


