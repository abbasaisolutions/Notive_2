'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { Spinner, ErrorState } from '@/components/ui';
import { EmptyState } from '@/components/ui/empty-state';
import { FiTag } from 'react-icons/fi';

type TagFrequency = { tag: string; count: number };

const tagSlug = (tag: string) => encodeURIComponent(tag.trim().toLowerCase());

export default function TagsIndexPage() {
    const { isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const [frequencies, setFrequencies] = useState<TagFrequency[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAllTags, setShowAllTags] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await apiFetch(`/entries/search/suggestions?limit=80`);
                if (!res.ok) throw new Error('Failed to load tags');
                const data = await res.json();
                const list: TagFrequency[] = Array.isArray(data?.suggestions?.tagFrequencies)
                    ? data.suggestions.tagFrequencies
                    : Array.isArray(data?.suggestions?.tags)
                        ? data.suggestions.tags.map((tag: string) => ({ tag, count: 1 }))
                        : [];
                if (!cancelled) setFrequencies(list);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tags');
            }
        })();
        return () => { cancelled = true; };
    }, [apiFetch, isAuthenticated]);

    const sortedFrequencies = useMemo(() => {
        if (!frequencies) return [];
        return [...frequencies].sort((a, b) => b.count - a.count);
    }, [frequencies]);

    const maxCount = sortedFrequencies[0]?.count || 1;
    const visibleFrequencies = showAllTags ? sortedFrequencies : sortedFrequencies.slice(0, 24);
    const hiddenTagCount = Math.max(0, sortedFrequencies.length - visibleFrequencies.length);

    if (!isAuthenticated) return null;

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            <header className="mb-8">
                <p className="type-overline text-muted">Browse</p>
                <h1 className="workspace-heading mt-2 text-3xl font-semibold">Your tags</h1>
                <p className="mt-2 text-sm text-ink-secondary">
                    Start with the tags you use most. Expand the full list when you need a smaller thread.
                </p>
            </header>

            {error ? (
                <ErrorState
                    title="Couldn’t load tags"
                    message={error}
                    action={{ label: 'Retry', onClick: () => window.location.reload() }}
                />
            ) : frequencies === null ? (
                <div className="flex items-center justify-center py-16">
                    <Spinner size="md" />
                </div>
            ) : sortedFrequencies.length === 0 ? (
                <EmptyState
                    icon={<FiTag aria-hidden="true" />}
                    title="No tags yet"
                    subtitle="Tags appear automatically as you write. Add a few entries and check back."
                />
            ) : (
                <div className="workspace-panel rounded-2xl p-6">
                    <div className="flex flex-wrap gap-2">
                        {visibleFrequencies.map(({ tag, count }) => {
                            const weight = count / maxCount;
                            const fontSize = 0.78 + weight * 0.6;
                            return (
                                <Link
                                    key={tag}
                                    href={`/entries/by-tag?tag=${tagSlug(tag)}`}
                                    className="rounded-full border border-[rgba(var(--paper-border),0.65)] bg-[rgba(255,255,255,0.55)] px-3 py-1.5 leading-none text-soft transition-all hover:border-primary/40 hover:bg-primary/8 hover:text-primary"
                                    style={{ fontSize: `${fontSize.toFixed(2)}rem` }}
                                    aria-label={`Browse ${count} entr${count === 1 ? 'y' : 'ies'} tagged ${tag}`}
                                >
                                    #{tag}
                                    <span className="ml-1 text-xs text-ink-muted">{count}</span>
                                </Link>
                            );
                        })}
                        {hiddenTagCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowAllTags(true)}
                                className="workspace-button-outline rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em]"
                            >
                                Show {hiddenTagCount} more
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
