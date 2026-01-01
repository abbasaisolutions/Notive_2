// Smart Search Component with Full-Text Search
// File: frontend/src/components/search/SmartSearch.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { API_URL, DEBOUNCE_DELAY } from '@/constants/config';
import { getMoodEmoji } from '@/constants/moods';

interface SearchResult {
    id: string;
    title: string;
    content: string;
    mood: string | null;
    createdAt: string;
    relevance: number;
}

export function SmartSearch() {
    const { accessToken } = useAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setShowResults(false);
            return;
        }

        const timer = setTimeout(async () => {
            await performSearch(query);
        }, DEBOUNCE_DELAY);

        return () => clearTimeout(timer);
    }, [query]);

    const performSearch = useCallback(async (searchQuery: string) => {
        if (!accessToken || !searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const response = await fetch(`${API_URL}/entries/search?q=${encodeURIComponent(searchQuery)}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.ok) {
                const data = await response.json();
                setResults(data.results || []);
                setShowResults(true);
            }
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    }, [accessToken]);

    const highlightText = (text: string, query: string): string => {
        if (!query) return text;

        const words = query.split(/\s+/).filter(w => w.length > 2);
        let highlighted = text;

        words.forEach(word => {
            const regex = new RegExp(`(${word})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark class="bg-yellow-300 text-black">$1</mark>');
        });

        return highlighted;
    };

    return (
        <div className="relative w-full max-w-2xl">
            {/* Search Input */}
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query && setShowResults(true)}
                    placeholder="Search your journal... (e.g., 'happy memories', 'work stress')"
                    className="w-full px-5 py-4 pl-14 pr-14 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />

                {/* Search Icon */}
                <svg
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                </svg>

                {/* Loading / Clear */}
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    {isSearching ? (
                        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                    ) : query ? (
                        <button
                            onClick={() => {
                                setQuery('');
                                setShowResults(false);
                            }}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="m15 9-6 6" />
                                <path d="m9 9 6 6" />
                            </svg>
                        </button>
                    ) : null}
                </div>
            </div>

            {/* Search Results Dropdown */}
            {showResults && results.length > 0 && (
                <div className="absolute top-full mt-2 w-full glass-card rounded-2xl p-4 z-50 max-h-[500px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <span className="text-sm text-slate-400">
                            Found {results.length} {results.length === 1 ? 'entry' : 'entries'}
                        </span>
                        <button
                            onClick={() => setShowResults(false)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {results.map((result) => (
                            <Link
                                key={result.id}
                                href={`/entry/view?id=${result.id}`}
                                onClick={() => setShowResults(false)}
                                className="block p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Mood Indicator */}
                                    {result.mood && (
                                        <span className="text-2xl flex-shrink-0">
                                            {getMoodEmoji(result.mood)}
                                        </span>
                                    )}

                                    <div className="flex-1 min-w-0">
                                        {/* Title */}
                                        {result.title && (
                                            <h4
                                                className="font-bold text-white mb-1 group-hover:text-primary transition-colors"
                                                dangerouslySetInnerHTML={{
                                                    __html: highlightText(result.title, query)
                                                }}
                                            />
                                        )}

                                        {/* Content Preview */}
                                        <p
                                            className="text-sm text-slate-400 line-clamp-2"
                                            dangerouslySetInnerHTML={{
                                                __html: highlightText(
                                                    result.content.substring(0, 150) + '...',
                                                    query
                                                )
                                            }}
                                        />

                                        {/* Metadata */}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                            <span>{new Date(result.createdAt).toLocaleDateString()}</span>
                                            {result.relevance && (
                                                <>
                                                    <span>•</span>
                                                    <span>{Math.round(result.relevance * 100)}% relevant</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* View All Link */}
                    {results.length >= 20 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <Link
                                href={`/search?q=${encodeURIComponent(query)}`}
                                className="block text-center text-primary hover:text-primary/80 transition-colors text-sm font-medium"
                                onClick={() => setShowResults(false)}
                            >
                                View all results →
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* No Results */}
            {showResults && query && !isSearching && results.length === 0 && (
                <div className="absolute top-full mt-2 w-full glass-card rounded-2xl p-8 z-50 text-center">
                    <div className="text-4xl mb-3">🔍</div>
                    <h4 className="text-white font-bold mb-2">No entries found</h4>
                    <p className="text-slate-400 text-sm">
                        Try different keywords or check your spelling
                    </p>
                </div>
            )}

            {/* Click outside to close */}
            {showResults && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowResults(false)}
                />
            )}
        </div>
    );
}

export default SmartSearch;
