'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useApi from '@/hooks/use-api';
import { FiCheck } from 'react-icons/fi';
import { Spinner, EmptyState } from '@/components/ui';

interface ImportCandidate {
    id: string;
    provider: 'instagram' | 'facebook';
    text: string;
    imageUrl: string | null;
    createdAt: string;
    sourceLink: string | null;
    tags: string[];
}

interface LegacyCandidate {
    id: string;
    caption?: string;
    message?: string;
    media_url?: string;
    full_picture?: string;
    timestamp?: string;
    created_time?: string;
    permalink?: string;
    permalink_url?: string;
}

interface SocialSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    provider: 'instagram' | 'facebook';
    onImportComplete: (result: { imported: number; skipped: number }) => void;
}

const toSafeDate = (value: string | undefined): string => {
    if (!value) return new Date().toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const normalizeCandidate = (
    raw: ImportCandidate | LegacyCandidate,
    provider: 'instagram' | 'facebook'
): ImportCandidate => {
    const candidate = raw as Partial<ImportCandidate> & LegacyCandidate;
    const text = (candidate.text || candidate.caption || candidate.message || '').trim() || 'Untitled memory';
    const imageUrl = candidate.imageUrl || candidate.media_url || candidate.full_picture || null;
    const createdAt = toSafeDate(candidate.createdAt || candidate.timestamp || candidate.created_time);
    const sourceLink = candidate.sourceLink || candidate.permalink || candidate.permalink_url || null;
    const tags = Array.isArray(candidate.tags)
        ? candidate.tags.filter((tag): tag is string => typeof tag === 'string')
        : [];

    return {
        id: String(candidate.id),
        provider,
        text,
        imageUrl,
        createdAt,
        sourceLink,
        tags,
    };
};

const formatDate = (value: string): string =>
    new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

export function SocialSelectionModal({ isOpen, onClose, provider, onImportComplete }: SocialSelectionModalProps) {
    const { apiFetch } = useApi();
    const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const providerName = provider === 'instagram' ? 'Instagram' : 'Facebook';
    const providerGradient = provider === 'instagram'
        ? 'from-primary via-accent to-secondary'
        : 'from-primary/90 via-accent to-secondary';
    const providerAccent = 'workspace-pill-muted text-[rgb(var(--text-primary))]';

    const visibleCandidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return candidates;
        return candidates.filter((candidate) => {
            const textMatch = candidate.text.toLowerCase().includes(q);
            const tagMatch = candidate.tags.some((tag) => tag.toLowerCase().includes(q));
            return textMatch || tagMatch;
        });
    }, [candidates, search]);

    const fetchCandidates = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiFetch(`/import/candidates?provider=${provider}`);
            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.message || 'Couldn\u2019t load import candidates.');
            }

            const list = Array.isArray(data?.candidates)
                ? (data.candidates as Array<ImportCandidate | LegacyCandidate>)
                : [];
            const normalized = list.map((candidate) => normalizeCandidate(candidate, provider));
            setCandidates(normalized);
            setSelectedIds(new Set(normalized.map((candidate) => candidate.id)));
        } catch (err: any) {
            setError(err?.message || 'Couldn\u2019t load import candidates.');
        } finally {
            setIsLoading(false);
        }
    }, [apiFetch, provider]);

    useEffect(() => {
        if (!isOpen) {
            setCandidates([]);
            setSelectedIds(new Set());
            setSearch('');
            setError(null);
            return;
        }
        fetchCandidates();
    }, [fetchCandidates, isOpen]);

    const toggleSelection = (id: string) => {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(candidates.map((candidate) => candidate.id)));
    };

    const clearAll = () => {
        setSelectedIds(new Set());
    };

    const selectVisible = () => {
        setSelectedIds((previous) => {
            const next = new Set(previous);
            visibleCandidates.forEach((candidate) => next.add(candidate.id));
            return next;
        });
    };

    const handleImport = async () => {
        if (selectedIds.size === 0) return;

        setIsImporting(true);
        setError(null);
        try {
            const response = await apiFetch('/import/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider,
                    selectedIds: Array.from(selectedIds),
                }),
            });

            const result = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(result?.message || 'Import failed.');
            }

            onImportComplete({
                imported: Number(result?.imported) || 0,
                skipped: Number(result?.skipped) || 0,
            });
            onClose();
        } catch (err: any) {
            setError(err?.message || 'Import failed.');
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                onClick={onClose}
                onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 14 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 10 }}
                    transition={{ duration: 0.22 }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="social-selection-title"
                    className="workspace-panel flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl shadow-[0_28px_90px_rgba(90,72,52,0.18)]"
                    onClick={(event) => event.stopPropagation()}
                >
                    <header className={`bg-gradient-to-r ${providerGradient} p-6`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-[0.16em] text-[rgba(255,255,255,0.82)]">Step 2: Select Memories</p>
                                <h2 id="social-selection-title" className="text-2xl font-semibold text-[rgb(var(--paper-soft))]">{providerName} Import Queue</h2>
                                <p className="text-sm text-[rgba(255,255,255,0.88)]">Choose memories to map into your timeline entries.</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="workspace-button-outline rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
                            >
                                Close
                            </button>
                        </div>
                    </header>

                    <section className="border-b border-[rgba(var(--paper-border),0.92)] bg-[rgba(255,255,255,0.72)] p-4">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Filter by text or tag"
                                    className="workspace-input w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={selectAll}
                                    className="workspace-button-outline rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={selectVisible}
                                    className="workspace-button-outline rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
                                >
                                    Select Visible
                                </button>
                                <button
                                    onClick={clearAll}
                                    className="workspace-button-outline rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-ink-secondary">
                                Showing {visibleCandidates.length} of {candidates.length}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 ${providerAccent}`}>
                                {selectedIds.size} selected
                            </span>
                        </div>
                    </section>

                    <div className="flex-1 overflow-y-auto p-4 md:p-6">
                        {isLoading && (
                            <div className="flex h-52 items-center justify-center">
                                <Spinner size="lg" />
                            </div>
                        )}

                        {!isLoading && error && (
                            <div className="workspace-soft-panel rounded-2xl p-5 text-sm text-[rgb(var(--text-primary))]">
                                <p>{error}</p>
                                <button
                                    onClick={fetchCandidates}
                                    className="workspace-button-outline mt-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {!isLoading && !error && visibleCandidates.length === 0 && (
                            <EmptyState
                                doodle="knot"
                                doodleAccent="lilac"
                                title="No memories match this filter"
                                subtitle="Try selecting a different platform or adjusting your date range."
                            />
                        )}

                        {!isLoading && !error && visibleCandidates.length > 0 && (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {visibleCandidates.map((candidate) => {
                                    const selected = selectedIds.has(candidate.id);

                                    return (
                                        <motion.div
                                            key={candidate.id}
                                            onClick={() => toggleSelection(candidate.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    toggleSelection(candidate.id);
                                                }
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            whileHover={{ y: -2 }}
                                            whileTap={{ scale: 0.995 }}
                                            className={`relative overflow-hidden rounded-2xl border text-left transition ${
                                                selected
                                                    ? 'border-primary/70 bg-primary/[0.08] shadow-[0_0_0_1px_rgba(127,90,240,0.3)]'
                                                    : 'workspace-soft-panel'
                                            }`}
                                        >
                                            <div className="relative aspect-[4/3] overflow-hidden bg-[rgb(var(--paper-soft))]">
                                                {candidate.imageUrl ? (
                                                    <img
                                                        src={candidate.imageUrl}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.26),_transparent_58%),linear-gradient(130deg,rgba(15,23,42,0.95),rgba(2,6,23,1))]" />
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                                <div className="absolute right-3 top-3">
                                                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                                                        selected
                                                            ? 'border-primary bg-primary text-[rgb(var(--paper-soft))]'
                                                            : 'border-[rgba(var(--paper-border),0.96)] bg-[rgba(255,255,255,0.82)] text-ink-secondary'
                                                    }`}>
                                                        {selected && (
                                                            <FiCheck size={12} aria-hidden="true" />
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-3 p-3">
                                                <p className="line-clamp-3 text-sm text-[rgb(var(--text-primary))]">{candidate.text}</p>
                                                <div className="flex items-center justify-between gap-2 text-xs text-ink-secondary">
                                                    <span>{formatDate(candidate.createdAt)}</span>
                                                    {candidate.sourceLink && (
                                                        <a
                                                            href={candidate.sourceLink}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            onClick={(event) => event.stopPropagation()}
                                                            className="workspace-button-outline rounded-md px-2 py-1 uppercase tracking-[0.08em]"
                                                        >
                                                            Source
                                                        </a>
                                                    )}
                                                </div>
                                                {candidate.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {candidate.tags.slice(0, 3).map((tag) => (
                                                            <span
                                                                key={`${candidate.id}-${tag}`}
                                                                className="workspace-pill-muted rounded-full px-2 py-0.5 text-xs uppercase tracking-[0.08em] text-ink-secondary"
                                                            >
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(var(--paper-border),0.92)] bg-[rgba(255,255,255,0.72)] p-4">
                        <button
                            onClick={onClose}
                            className="workspace-button-outline rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={selectedIds.size === 0 || isImporting}
                            className={`rounded-xl px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.09em] transition ${
                                selectedIds.size === 0 || isImporting
                                    ? 'cursor-not-allowed bg-[rgba(var(--paper-border),0.72)] text-ink-muted opacity-60'
                                    : 'workspace-button-primary shadow-lg'
                            }`}
                        >
                            {isImporting
                                ? 'Importing...'
                                : `Import ${selectedIds.size} ${selectedIds.size === 1 ? 'memory' : 'memories'}`}
                        </button>
                    </footer>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default SocialSelectionModal;

