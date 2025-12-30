'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useSmartContext } from '@/context/smart-context';
import Skeleton from '@/components/ui/SkeletonLoader';
import Image from 'next/image';
import StreakCounter from '@/components/gamification/StreakCounter';
import SmartSearch from '@/components/search/SmartSearch';
import EntryCard from '@/components/ui/EntryCard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface Entry {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    coverImage: string | null;
    createdAt: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const { simulateEvent } = useSmartContext();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        const fetchEntries = async () => {
            if (!accessToken) return;

            setIsLoading(true);
            try {
                const queryParams = new URLSearchParams();
                if (debouncedSearch) queryParams.append('search', debouncedSearch);

                const response = await fetch(`${API_URL}/entries?${queryParams.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setEntries(data.entries);
                }
            } catch (error) {
                console.error('Failed to fetch entries:', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            fetchEntries();
        }
    }, [user, accessToken, debouncedSearch]);


    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
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
                                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] uppercase tracking-[0.2em] font-bold border border-primary/20">
                                        Legacy Sanctuary
                                    </span>
                                    <StreakCounter />
                                </div>
                                <h1 className="text-4xl md:text-5xl font-serif mb-4 leading-tight">
                                    Your Living Legacy, <br />
                                    unfolding{user.name ? `, ${user.name.split(' ')[0]}` : ''}.
                                </h1>
                                <p className="zen-text text-lg max-w-lg">
                                    Witness your personal evolution, one echo at a time. Every thought is a thread in your eternal tapestry.
                                </p>
                            </div>

                            <div className="mt-12 flex items-center gap-4 relative z-10">
                                <Link
                                    href="/entry/new"
                                    className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-[1.5rem] font-semibold transition-all shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 flex items-center gap-3"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" x2="12" y1="5" y2="19" />
                                        <line x1="5" x2="19" y1="12" y2="12" />
                                    </svg>
                                    Capture Echo
                                </Link>
                                <button className="p-4 rounded-[1.5rem] border border-white/10 hover:bg-white/5 transition-all text-slate-400 hover:text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Search & Actions Sidebar Bento */}
                        <div className="space-y-8">
                            {/* Search Box */}
                            <div className="bento-box p-8 group">
                                <h3 className="text-xl mb-4 font-serif">Recall</h3>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Find an echo..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-serif"
                                    />
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors">
                                        <circle cx="11" cy="11" r="8" />
                                        <path d="m21 21-4.3-4.3" />
                                    </svg>
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
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Echoes</div>
                                </div>
                                <div className="bento-box p-6 text-center">
                                    <div className="text-3xl font-bold text-secondary mb-2">Active</div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Flow</div>
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
                                Neural Sparks
                            </h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => simulateEvent('A fresh workout finished. Reflect on the energy.')}
                                    className="w-full p-4 rounded-2xl bg-orange-500/5 hover:bg-orange-500/10 text-orange-400 border border-orange-500/10 text-xs transition-all text-left group"
                                >
                                    Reflect on Energy
                                    <span className="block text-[10px] opacity-50 group-hover:opacity-100 transition-opacity mt-1">Simulate Workout</span>
                                </button>
                                <button
                                    onClick={() => simulateEvent('Travel detected. What captured your eye?')}
                                    className="w-full p-4 rounded-2xl bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 border border-blue-500/10 text-xs transition-all text-left group"
                                >
                                    The Traveler's Lens
                                    <span className="block text-[10px] opacity-50 group-hover:opacity-100 transition-opacity mt-1">Simulate Location</span>
                                </button>
                                <button
                                    onClick={() => simulateEvent('4 hours of deep work detected. How is your focus?')}
                                    className="w-full p-4 rounded-2xl bg-purple-500/5 hover:bg-purple-500/10 text-purple-400 border border-purple-500/10 text-xs transition-all text-left group"
                                >
                                    Deep Focus Sync
                                    <span className="block text-[10px] opacity-50 group-hover:opacity-100 transition-opacity mt-1">Simulate Session</span>
                                </button>
                            </div>
                        </div>

                        {/* Recent Chronicles List Bento */}
                        <div className="lg:col-span-3 space-y-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-2xl font-serif">Recent Chronicles</h3>
                                <Link href="/timeline" className="text-xs text-primary hover:text-white transition-colors tracking-widest font-bold uppercase">View Journey</Link>
                            </div>

                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="bento-box p-8 h-64 flex flex-col gap-4">
                                            <div className="h-8 w-3/4 rounded-lg bg-slate-800 animate-pulse" />
                                            <div className="h-4 w-full rounded-lg bg-slate-800 animate-pulse" />
                                            <div className="h-4 w-full rounded-lg bg-slate-800 animate-pulse" />
                                            <div className="h-10 w-32 mt-auto rounded-xl bg-slate-800 animate-pulse" />
                                        </div>
                                    ))}
                                </div>
                            ) : entries.length === 0 ? (
                                <div className="bento-box p-12 md:p-20 text-center">
                                    {/* Animated icon */}
                                    <div className="w-24 h-24 mx-auto mb-8 rounded-[2rem] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary animate-float">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                        </svg>
                                    </div>

                                    <h3 className="text-3xl font-serif text-white mb-4">
                                        Ready to Begin? ✨
                                    </h3>

                                    <p className="zen-text max-w-md mx-auto mb-8 text-lg">
                                        Your journal is empty, but that's about to change!
                                        Start writing to track your mood, discover patterns, and grow.
                                    </p>

                                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                                        <Link
                                            href="/entry/new"
                                            className="bg-primary hover:bg-primary/90 text-white px-10 py-5 rounded-[2rem] font-bold shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="12" x2="12" y1="5" y2="19" />
                                                <line x1="5" x2="19" y1="12" y2="12" />
                                            </svg>
                                            Write Your First Entry
                                        </Link>

                                        <Link
                                            href="/chat"
                                            className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                                        >
                                            Need inspiration?
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="m9 18 6-6-6-6" />
                                            </svg>
                                        </Link>
                                    </div>

                                    {/* Quick tips for students */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
                                        <div className="p-5 rounded-2xl bg-white/5 hover:bg-white/10 transition-all">
                                            <div className="text-3xl mb-3">💡</div>
                                            <h4 className="text-sm font-bold text-white mb-2">Pro Tip</h4>
                                            <p className="text-xs text-slate-400">
                                                Write for just 5 minutes daily to build the habit
                                            </p>
                                        </div>
                                        <div className="p-5 rounded-2xl bg-white/5 hover:bg-white/10 transition-all">
                                            <div className="text-3xl mb-3">🎯</div>
                                            <h4 className="text-sm font-bold text-white mb-2">Track Anything</h4>
                                            <p className="text-xs text-slate-400">
                                                Studies, workouts, relationships - it all matters
                                            </p>
                                        </div>
                                        <div className="p-5 rounded-2xl bg-white/5 hover:bg-white/10 transition-all">
                                            <div className="text-3xl mb-3">📈</div>
                                            <h4 className="text-sm font-bold text-white mb-2">See Progress</h4>
                                            <p className="text-xs text-slate-400">
                                                Watch your insights grow with each entry
                                            </p>
                                        </div>
                                    </div>
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
