// Smart Search Component with Full-Text Search
// File: frontend/src/components/search/SmartSearch.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { API_URL, DEBOUNCE_DELAY } from '@/constants/config';
import { getMoodEmoji } from '@/constants/moods';
import useApi from '@/hooks/use-api';
import { FiSearch, FiX, FiXCircle } from 'react-icons/fi';

interface SearchResult {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    createdAt: string;
    relevance: number;
    strategy?: 'lexical' | 'semantic' | 'hybrid' | 'fallback';
    lexicalScore?: number;
    semanticScore?: number;
    rerankScore?: number;
    matchReasons?: string[];
}

export function SmartSearch() {
    const { accessToken } = useAuth();
    const { apiFetch } = useApi();
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
            const response = await apiFetch(`${API_URL}/entries/search?q=${encodeURIComponent(searchQuery)}`);

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
    }, [accessToken, apiFetch]);

    const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const extractQueryTerms = (value: string): string[] => {
        const uniqueTerms = new Set<string>();
        value.split(/\s+/).forEach((term) => {
            const normalized = term.trim();
            if (normalized.length > 2) {
                uniqueTerms.add(normalized);
            }
        });
        return Array.from(uniqueTerms);
    };

    const highlightText = (text: string, currentQuery: string): React.ReactNode => {
        if (!currentQuery) return text;

        const terms = extractQueryTerms(currentQuery);
        if (terms.length === 0) return text;

        const escapedTerms = terms.map(escapeRegExp);
        const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
        const termLookup = new Set(terms.map((term) => term.toLowerCase()));
        const parts = text.split(regex);

        return parts.map((part, index) => {
            if (!part) return null;
            if (!termLookup.has(part.toLowerCase())) {
                return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
            }
            return (
                <mark key={`mark-${index}`} className="bg-primary/25 text-white">
                    {part}
                </mark>
            );
        });
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
                    placeholder="Search your memory base semantically... (e.g., 'new city', 'team conflict')"
                    className="w-full px-5 py-4 pl-14 pr-14 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />

                {/* Search Icon */}
                <FiSearch
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-ink-secondary"
                    size={20}
                    aria-hidden="true"
                />

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
                            className="text-ink-secondary hover:text-white transition-colors"
                        >
                            <FiXCircle size={20} aria-hidden="true" />
                        </button>
                    ) : null}
                </div>
            </div>

            {/* Search Results Dropdown */}
            {showResults && results.length > 0 && (
                <div className="absolute top-full mt-2 w-full glass-card rounded-2xl p-4 z-50 max-h-[500px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <span className="text-sm text-ink-secondary">
                            Found {results.length} {results.length === 1 ? 'entry' : 'entries'}
                        </span>
                        <button
                            onClick={() => setShowResults(false)}
                            className="text-ink-secondary hover:text-white transition-colors"
                        >
                            <FiX size={16} aria-hidden="true" />
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
                                            >
                                                {highlightText(result.title, query)}
                                            </h4>
                                        )}

                                        {/* Content Preview */}
                                        <p
                                            className="text-sm text-ink-secondary line-clamp-2"
                                        >
                                            {highlightText(
                                                result.content.substring(0, 150) + '...',
                                                query
                                            )}
                                        </p>

                                        {/* Metadata */}
                                        <div className="flex items-center gap-3 mt-2 text-xs text-ink-muted">
                                            <span>{new Date(result.createdAt).toLocaleDateString()}</span>
                                            {result.relevance && (
                                                <>
                                                    <span>•</span>
                                                    <span>{Math.round(result.relevance * 100)}% relevant</span>
                                                </>
                                            )}
                                        </div>

                                        {((result.matchReasons && result.matchReasons.length > 0) || result.strategy) && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {result.strategy && (
                                                    <span className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-xs uppercase tracking-[0.12em] text-ink-muted">
                                                        {result.strategy === 'hybrid'
                                                            ? 'Hybrid'
                                                            : result.strategy === 'semantic'
                                                                ? 'Semantic'
                                                                : result.strategy === 'fallback'
                                                                    ? 'Fallback'
                                                                    : 'Keyword'}
                                                    </span>
                                                )}
                                                {(result.matchReasons || []).slice(0, 2).map((reason) => (
                                                    <span
                                                        key={`${result.id}-${reason}`}
                                                        className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs uppercase tracking-[0.1em] text-primary"
                                                    >
                                                        {reason}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* View All Link */}
                    {results.length >= 20 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <Link
                                href={`/timeline?q=${encodeURIComponent(query)}`}
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
                    <div className="mb-3 inline-flex items-center justify-center rounded-full bg-white/5 p-3 text-ink-secondary">
                        <FiSearch size={24} aria-hidden="true" />
                    </div>
                    <h4 className="text-white font-bold mb-2">No matching moments yet</h4>
                    <p className="text-ink-secondary text-sm">
                        Try different keywords, people, themes, or a broader phrase
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
