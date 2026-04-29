'use client';

import { FiClock, FiRotateCcw, FiTrash2 } from 'react-icons/fi';
import type { DraftHistorySnapshot } from '@/hooks/use-entry-draft';

const formatSnapshotAge = (savedAt: number): string => {
    const deltaMinutes = Math.max(Math.round((Date.now() - savedAt) / 60000), 0);
    if (deltaMinutes < 1) return 'just now';
    if (deltaMinutes < 60) return `${deltaMinutes}m ago`;

    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) return `${deltaHours}h ago`;

    const deltaDays = Math.round(deltaHours / 24);
    if (deltaDays < 7) return `${deltaDays}d ago`;

    return new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function DraftRecoveryPanel({
    snapshots,
    onRestore,
    onDelete,
}: {
    snapshots: DraftHistorySnapshot[];
    onRestore: (snapshot: DraftHistorySnapshot) => void;
    onDelete: (snapshotId: string) => void;
}) {
    if (snapshots.length === 0) return null;

    return (
        <details className="group mb-4 rounded-2xl border border-[rgba(var(--paper-border),0.82)] bg-[rgba(255,255,255,0.22)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <FiClock size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                            Draft history
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-ink-secondary">
                            Restore an earlier version if this draft changed the wrong way.
                        </span>
                    </span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted group-open:hidden">
                    Open
                </span>
                <span className="hidden text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted group-open:inline">
                    Hide
                </span>
            </summary>

            <div className="space-y-2 border-t border-[rgba(var(--paper-border),0.72)] px-3 pb-3 pt-3">
                {snapshots.slice(0, 5).map((snapshot) => (
                    <article
                        key={snapshot.snapshotId}
                        className="rounded-xl border border-[rgba(var(--paper-border),0.72)] bg-[rgba(255,255,255,0.28)] px-3 py-3"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
                                    {formatSnapshotAge(snapshot.savedAt)} · {snapshot.wordCount} words
                                    {snapshot.audioUrl ? ' · voice' : ''}
                                </p>
                                <p className="mt-1 line-clamp-2 text-sm leading-6 text-[rgb(var(--text-primary))]">
                                    {snapshot.preview || snapshot.title || 'Untitled draft'}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => onRestore(snapshot)}
                                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/20"
                                >
                                    <FiRotateCcw size={13} aria-hidden="true" />
                                    Restore
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(snapshot.snapshotId)}
                                    aria-label="Remove draft snapshot"
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-white/20 hover:text-[rgb(var(--danger))]"
                                >
                                    <FiTrash2 size={14} aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </details>
    );
}
