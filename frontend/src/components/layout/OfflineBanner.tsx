'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
    FiAlertCircle,
    FiCheckCircle,
    FiChevronDown,
    FiChevronUp,
    FiClock,
    FiEdit3,
    FiRefreshCw,
    FiUploadCloud,
    FiWifiOff,
} from 'react-icons/fi';
import { useAuth } from '@/context/auth-context';
import { getSavedDraftSummary, type SavedDraftSummary } from '@/hooks/use-entry-draft';
import { getQueuedUploadSummary, type QueuedUploadSummary } from '@/hooks/use-upload-queue';
import {
    readLastSuccessfulSyncAt,
    readLastSyncIssue,
    SYNC_STATUS_EVENT,
    type SyncIssue,
} from '@/services/sync-status.service';

type SyncSnapshot = {
    draft: SavedDraftSummary | null;
    isOnline: boolean;
    lastSuccessfulSyncAt: number | null;
    lastSyncIssue: SyncIssue | null;
    uploads: QueuedUploadSummary;
};

const EMPTY_UPLOAD_SUMMARY: QueuedUploadSummary = {
    count: 0,
    fileNames: [],
    newestCreatedAt: null,
};

const formatRelativeTime = (timestamp: number | null) => {
    if (!timestamp) {
        return 'Not synced yet';
    }

    const deltaMs = Date.now() - timestamp;
    const deltaMinutes = Math.max(0, Math.round(deltaMs / 60000));

    if (deltaMinutes < 1) {
        return 'Just now';
    }

    if (deltaMinutes < 60) {
        return `${deltaMinutes}m ago`;
    }

    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) {
        return `${deltaHours}h ago`;
    }

    const deltaDays = Math.round(deltaHours / 24);
    if (deltaDays < 7) {
        return `${deltaDays}d ago`;
    }

    return new Date(timestamp).toLocaleString([], {
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
    });
};

const formatItemCount = (count: number, singular: string, plural: string) =>
    `${count} ${count === 1 ? singular : plural}`;

export default function OfflineBanner() {
    const { user } = useAuth();
    const [expanded, setExpanded] = useState(false);
    const [snapshot, setSnapshot] = useState<SyncSnapshot>({
        draft: null,
        isOnline: true,
        lastSuccessfulSyncAt: null,
        lastSyncIssue: null,
        uploads: EMPTY_UPLOAD_SUMMARY,
    });

    useEffect(() => {
        let cancelled = false;

        const refreshSnapshot = async () => {
            const nextUploads = await getQueuedUploadSummary();
            if (cancelled) {
                return;
            }

            setSnapshot({
                draft: getSavedDraftSummary(user?.id),
                isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
                lastSuccessfulSyncAt: readLastSuccessfulSyncAt(),
                lastSyncIssue: readLastSyncIssue(),
                uploads: nextUploads,
            });
        };

        const handleSyncUpdate = () => {
            void refreshSnapshot();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void refreshSnapshot();
            }
        };

        void refreshSnapshot();

        window.addEventListener('online', handleSyncUpdate);
        window.addEventListener('offline', handleSyncUpdate);
        window.addEventListener('storage', handleSyncUpdate);
        window.addEventListener(SYNC_STATUS_EVENT, handleSyncUpdate);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            window.removeEventListener('online', handleSyncUpdate);
            window.removeEventListener('offline', handleSyncUpdate);
            window.removeEventListener('storage', handleSyncUpdate);
            window.removeEventListener(SYNC_STATUS_EVENT, handleSyncUpdate);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user?.id]);

    const hasPendingDraft = Boolean(snapshot.draft?.pendingSync);
    const hasQueuedUploads = snapshot.uploads.count > 0;
    const hasPendingWork = hasPendingDraft || hasQueuedUploads;
    const shouldShowBanner = !snapshot.isOnline || hasPendingWork;
    const shouldShowTray = !snapshot.isOnline || hasPendingWork || Boolean(snapshot.lastSyncIssue);
    const pendingSummary = useMemo(() => {
        const parts: string[] = [];

        if (hasPendingDraft) {
            parts.push('draft waiting');
        }

        if (hasQueuedUploads) {
            parts.push(formatItemCount(snapshot.uploads.count, 'upload', 'uploads'));
        }

        return parts.join(' and ');
    }, [hasPendingDraft, hasQueuedUploads, snapshot.uploads.count]);

    useEffect(() => {
        if (shouldShowTray) {
            setExpanded(true);
        }
    }, [shouldShowTray]);

    if (!shouldShowBanner && !shouldShowTray) {
        return null;
    }

    return (
        <>
            {shouldShowBanner && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2 text-xs font-medium text-white shadow-md transition-colors ${
                        snapshot.isOnline ? 'bg-[rgb(var(--paper-sage))]' : 'bg-amber-600'
                    }`}
                >
                    {snapshot.isOnline ? (
                        <FiRefreshCw size={14} className={hasPendingWork ? 'animate-spin' : ''} aria-hidden="true" />
                    ) : (
                        <FiWifiOff size={14} aria-hidden="true" />
                    )}
                    <span>
                        {snapshot.isOnline
                            ? `Back online. ${pendingSummary || 'Sync is ready.'}`
                            : 'You are offline. Drafts and uploads will wait here until you reconnect.'}
                    </span>
                    {shouldShowTray && (
                        <button
                            type="button"
                            onClick={() => setExpanded((current) => !current)}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-white/15"
                        >
                            {expanded ? 'Hide sync details' : 'View sync details'}
                        </button>
                    )}
                </div>
            )}

            {shouldShowTray && (
                <div
                    className="fixed inset-x-0 z-50 px-4"
                    style={{ bottom: 'calc(var(--app-bottom-clearance, 1rem) + 0.5rem)' }}
                >
                    <div className="mx-auto max-w-xl">
                        <div className="workspace-panel overflow-hidden rounded-[1.6rem] shadow-2xl">
                            <button
                                type="button"
                                onClick={() => setExpanded((current) => !current)}
                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                            >
                                <div>
                                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink-muted">Sync status</p>
                                    <p className="mt-1 text-sm font-semibold text-[rgb(var(--text-primary))]">
                                        {!snapshot.isOnline
                                            ? 'Offline mode is holding your work safely'
                                            : snapshot.lastSyncIssue
                                                ? 'A recent sync needs attention'
                                                : hasPendingWork
                                                    ? `${pendingSummary || 'Pending work'} ready to sync`
                                                    : 'Everything is caught up'}
                                    </p>
                                </div>
                                <span className="workspace-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
                                    {expanded ? <FiChevronDown size={14} aria-hidden="true" /> : <FiChevronUp size={14} aria-hidden="true" />}
                                    {expanded ? 'Collapse' : 'Expand'}
                                </span>
                            </button>

                            {expanded && (
                                <div className="border-t border-[rgba(var(--paper-border),0.72)] px-4 pb-4 pt-3">
                                    <div className="space-y-3">
                                        {hasPendingDraft && snapshot.draft && (
                                            <div className="workspace-soft-panel rounded-[1.3rem] p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex min-w-0 items-start gap-3">
                                                        <div className="workspace-icon-badge mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl">
                                                            <FiEdit3 size={16} aria-hidden="true" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Draft waiting to sync</p>
                                                            <p className="mt-1 text-sm font-semibold text-[rgb(var(--text-primary))]">
                                                                {snapshot.draft.title || 'Untitled draft'}
                                                            </p>
                                                            <p className="mt-1 text-sm leading-6 text-ink-secondary">
                                                                {formatItemCount(snapshot.draft.wordCount, 'word', 'words')}
                                                                {snapshot.draft.hasAudio ? ' • includes voice audio' : ''}
                                                            </p>
                                                            <p className="mt-1 text-xs text-ink-muted">
                                                                Updated {formatRelativeTime(snapshot.draft.updatedAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Link href="/entry/new" className="workspace-button-primary rounded-xl px-3 py-2 text-xs font-semibold">
                                                        Open draft
                                                    </Link>
                                                </div>
                                            </div>
                                        )}

                                        {hasQueuedUploads && (
                                            <div className="workspace-soft-panel rounded-[1.3rem] p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="workspace-icon-badge mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl">
                                                        <FiUploadCloud size={16} aria-hidden="true" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Queued uploads</p>
                                                        <p className="mt-1 text-sm font-semibold text-[rgb(var(--text-primary))]">
                                                            {formatItemCount(snapshot.uploads.count, 'file is', 'files are')} waiting
                                                        </p>
                                                        {snapshot.uploads.fileNames.length > 0 && (
                                                            <p className="mt-1 text-sm leading-6 text-ink-secondary">
                                                                {snapshot.uploads.fileNames.join(', ')}
                                                                {snapshot.uploads.count > snapshot.uploads.fileNames.length ? ' …' : ''}
                                                            </p>
                                                        )}
                                                        <p className="mt-1 text-xs text-ink-muted">
                                                            Last queued {formatRelativeTime(snapshot.uploads.newestCreatedAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {snapshot.lastSyncIssue && (
                                            <div className="rounded-[1.3rem] border border-amber-500/30 bg-amber-500/10 p-4">
                                                <div className="flex items-start gap-3">
                                                    <FiAlertCircle size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                                                    <div>
                                                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Needs attention</p>
                                                        <p className="mt-1 text-sm font-semibold text-amber-800">
                                                            {snapshot.lastSyncIssue.message}
                                                        </p>
                                                        <p className="mt-1 text-xs text-amber-700/80">
                                                            Last retry {formatRelativeTime(snapshot.lastSyncIssue.at)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="workspace-soft-panel rounded-[1.3rem] p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="workspace-icon-badge mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl">
                                                    {snapshot.lastSuccessfulSyncAt ? (
                                                        <FiCheckCircle size={16} aria-hidden="true" />
                                                    ) : (
                                                        <FiClock size={16} aria-hidden="true" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Last successful sync</p>
                                                    <p className="mt-1 text-sm font-semibold text-[rgb(var(--text-primary))]">
                                                        {formatRelativeTime(snapshot.lastSuccessfulSyncAt)}
                                                    </p>
                                                    <p className="mt-1 text-xs text-ink-muted">
                                                        Notive updates this whenever a queued draft or upload finishes successfully.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
