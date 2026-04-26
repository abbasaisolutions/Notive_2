'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import useApi from '@/hooks/use-api';
import useAuthRedirect from '@/hooks/use-auth-redirect';
import { API_URL } from '@/constants/config';
import { Spinner, ErrorState } from '@/components/ui';
import { getMoodEmoji } from '@/constants/moods';
import { FiArrowLeft, FiTag } from 'react-icons/fi';

type EntrySummary = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    lifeArea: string | null;
    createdAt: string;
    tags: string[];
};

const PREVIEW_LENGTH = 180;

export default function EntriesByTagClient() {
    const searchParams = useSearchParams();
    const rawTag = searchParams.get('tag') || '';
    const tag = rawTag.trim();
    const { isAuthenticated } = useAuthRedirect();
    const { apiFetch } = useApi();
    const [entries, setEntries] = useState<EntrySummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated || !tag) {
            setEntries(tag ? null : []);
            setError(null);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const search = new URLSearchParams({ tag, limit: '50' });
                const res = await apiFetch(`${API_URL}/entries?${search.toString()}`);
                if (!res.ok) throw new Error('Failed to load entries');
                const data = await res.json();
                const list: EntrySummary[] = Array.isArray(data?.entries) ? data.entries : [];
                if (!cancelled) {
                    setEntries(list);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load entries');
                }
            }
        })();

        return () => { cancelled = true; };
    }, [apiFetch, isAuthenticated, tag]);

    const formattedTitle = useMemo(() => tag, [tag]);

    if (!isAuthenticated) return null;

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            <Link
                href="/tags"
                className="inline-flex items-center gap-1.5 text-sm text-ink-secondary transition-colors hover:text-[rgb(var(--text-primary))]"
            >
                <FiArrowLeft size={14} aria-hidden="true" />
                All tags
            </Link>

            <header className="mt-6 mb-8">
                <p className="type-overline text-muted flex items-center gap-1.5">
                    <FiTag size={12} aria-hidden="true" /> Tag
                </p>
                <h1 className="workspace-heading mt-2 break-all text-3xl font-semibold">
                    {formattedTitle ? `#${formattedTitle}` : 'Tag entries'}
                </h1>
                {entries && formattedTitle && (
                    <p className="mt-2 text-sm text-ink-secondary">
                        {entries.length} {entries.length === 1 ? 'entry' : 'entries'} tagged with this label.
                    </p>
                )}
            </header>

            {!formattedTitle ? (
                <div className="workspace-panel rounded-2xl p-10 text-center">
                    <h2 className="workspace-heading mb-2 text-lg font-semibold">Pick a tag to browse</h2>
                    <p className="text-sm text-ink-secondary">
                        Open this page from the tag cloud to see entries for a specific label.
                    </p>
                </div>
            ) : error ? (
                <ErrorState
                    title="Couldn’t load entries"
                    message={error}
                    action={{ label: 'Retry', onClick: () => window.location.reload() }}
                />
            ) : entries === null ? (
                <div className="flex items-center justify-center py-16">
                    <Spinner size="md" />
                </div>
            ) : entries.length === 0 ? (
                <div className="workspace-panel rounded-2xl p-10 text-center">
                    <h2 className="workspace-heading mb-2 text-lg font-semibold">No entries with this tag yet</h2>
                    <p className="text-sm text-ink-secondary">
                        Try a different tag or write a new entry.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {entries.map((entry) => (
                        <Link
                            key={entry.id}
                            href={`/entry/view?id=${entry.id}`}
                            className="block rounded-2xl border border-[rgba(var(--paper-border),0.65)] bg-[rgba(255,255,255,0.55)] p-4 transition-all hover:border-primary/30 hover:shadow-sm"
                        >
                            <div className="flex items-start gap-3">
                                {entry.mood && (
                                    <span className="text-xl flex-shrink-0" aria-hidden="true">
                                        {getMoodEmoji(entry.mood)}
                                    </span>
                                )}
                                <div className="flex-1 min-w-0">
                                    {entry.title && (
                                        <h3 className="workspace-heading mb-1 font-semibold leading-tight">
                                            {entry.title}
                                        </h3>
                                    )}
                                    <p className="text-sm leading-6 text-ink-secondary line-clamp-3">
                                        {(entry.content || '').slice(0, PREVIEW_LENGTH)}
                                        {(entry.content || '').length > PREVIEW_LENGTH ? '…' : ''}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                                        <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                                        {entry.lifeArea && (
                                            <>
                                                <span aria-hidden="true">•</span>
                                                <span>{entry.lifeArea}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
