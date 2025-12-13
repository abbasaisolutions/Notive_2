'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useSmartContext } from '@/context/smart-context';

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
    const { user, logout, accessToken, isLoading: authLoading } = useAuth();
    const { simulateEvent } = useSmartContext();
    const [entries, setEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Moved here

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

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

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

    // ... (existing code)

    return (
        <div className="min-h-screen flex relative">
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                w-64 glass flex-shrink-0 flex flex-col border-r border-white/5 
                fixed md:relative inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight">
                        Notive.
                    </h1>
                    {/* Close button for mobile */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden text-slate-400 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" /><path d="m6 6 18 18" />
                        </svg>
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <Link
                        href="/dashboard"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white bg-primary/10 border-r-2 border-primary"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="7" height="7" x="3" y="3" rx="1" />
                            <rect width="7" height="7" x="14" y="3" rx="1" />
                            <rect width="7" height="7" x="14" y="14" rx="1" />
                            <rect width="7" height="7" x="3" y="14" rx="1" />
                        </svg>
                        Dashboard
                    </Link>
                    <Link
                        href="/timeline"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Journey
                    </Link>
                    <Link
                        href="/chat"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Chat with Journal
                    </Link>
                    <Link
                        href="/chapters"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                        </svg>
                        Chapters
                    </Link>
                    <Link
                        href="/reflections"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38" />
                        </svg>
                        Reflect
                    </Link>
                    <Link
                        href="/analytics"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                            <polyline points="16 7 22 7 22 13" />
                        </svg>
                        Analytics
                    </Link>
                    <Link
                        href="/import"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                            <line x1="16" x2="22" y1="5" y2="5" />
                            <line x1="19" x2="19" y1="2" y2="8" />
                        </svg>
                        Import
                    </Link>
                </nav>

                <div className="p-4">
                    <div className="glass-card p-4 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                                {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white truncate">{user.name || 'User'}</div>
                                <div className="text-xs text-slate-400 truncate">{user.email}</div>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full mt-3 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" x2="9" y1="12" y2="12" />
                            </svg>
                            Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                {/* Background Glow */}
                <div className="absolute top-0 left-0 w-full h-96 bg-primary/10 blur-[100px] pointer-events-none rounded-full transform -translate-y-1/2"></div>

                <header className="mb-8 relative z-10 flex flex-col md:flex-row justify-between items-end gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button
                            className="md:hidden p-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
                            </svg>
                        </button>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">
                                Welcome back{user.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
                            </h2>
                            <p className="text-slate-400 text-sm md:text-base">Here's your journaling dashboard.</p>
                        </div>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <input
                                type="text"
                                placeholder="Search entries..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                        </div>
                        <Link
                            href="/entry/new"
                            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-primary/25 flex items-center gap-2 whitespace-nowrap"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" x2="12" y1="5" y2="19" />
                                <line x1="5" x2="19" y1="12" y2="12" />
                            </svg>
                            New Entry
                        </Link>
                    </div>
                </header>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 relative z-10">
                    <div className="glass-card p-6 rounded-2xl">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 w-fit mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                            </svg>
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">{entries.length}</div>
                        <div className="text-sm text-slate-400">Total Entries</div>
                    </div>
                    {/* ... other stats ... */}
                </div>

                {/* Context Simulation (Demo) */}
                <div className="mb-10 relative z-10">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <span className="text-sm font-normal text-slate-400 bg-white/5 px-2 py-1 rounded">Dev Demo</span>
                        Context Simulation
                    </h3>
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={() => simulateEvent('You just finished a workout! 💪 How do you feel?')}
                            className="px-4 py-2 rounded-xl bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all border border-orange-500/20"
                        >
                            Simulate "Workout Finished"
                        </button>
                        <button
                            onClick={() => simulateEvent('It looks like you traveled to a new city! ✈️ Want to write about it?')}
                            className="px-4 py-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20"
                        >
                            Simulate "Travel Detected"
                        </button>
                        <button
                            onClick={() => simulateEvent('You have been coding for 4 hours straight. 💻 Time for a break?')}
                            className="px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all border border-purple-500/20"
                        >
                            Simulate "Coding Session"
                        </button>
                    </div>
                </div>

                {/* Entries List */}
                <div className="relative z-10">
                    <h3 className="text-xl font-bold text-white mb-4">Recent Entries</h3>

                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="glass-card p-12 rounded-2xl text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">
                                {debouncedSearch ? 'No entries found' : 'Start Your Journey'}
                            </h3>
                            <p className="text-slate-400 mb-6 max-w-md mx-auto">
                                {debouncedSearch ? `No entries match "${debouncedSearch}". Try a different search term.` : "You haven't created any journal entries yet. Begin documenting your thoughts and experiences."}
                            </p>
                            {!debouncedSearch && (
                                <Link
                                    href="/entry/new"
                                    className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-primary/25 inline-flex items-center gap-2"
                                >
                                    Create Your First Entry
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {entries.map((entry) => (
                                <Link key={entry.id} href={`/entry/view?id=${entry.id}`} className="glass-card rounded-2xl hover:bg-white/5 transition-all group overflow-hidden flex flex-col h-full">
                                    {entry.coverImage && (
                                        <div className="h-48 w-full overflow-hidden">
                                            <img src={entry.coverImage} alt={entry.title || 'Entry'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        </div>
                                    )}
                                    <div className="p-6 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="text-sm text-slate-400">
                                                {new Date(entry.createdAt).toLocaleDateString(undefined, {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </div>
                                            {entry.mood && (
                                                <span className="px-2 py-1 rounded-lg bg-white/10 text-xs text-slate-300 capitalize">
                                                    {entry.mood}
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors line-clamp-1">
                                            {entry.title || 'Untitled Entry'}
                                        </h4>
                                        <p className="text-slate-400 text-sm line-clamp-3 mb-4 flex-1">
                                            {entry.content}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {entry.tags.map(tag => (
                                                <span key={tag} className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
