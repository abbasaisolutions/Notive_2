'use client';

import type { ReactNode } from 'react';
import { FiAlertTriangle, FiArrowLeft, FiCloud, FiRefreshCw, FiSave, FiZap } from 'react-icons/fi';

type EntryTopBarProps = {
    onBack: () => void;
    backLabel: string;
    isSaving: boolean;
    lastSaved: Date | null;
    canSave: boolean;
    onSave: () => void;
    error: string;
    draftRestored: boolean;
    pendingSync: boolean;
    wordCount: number;
    readingTimeMinutes: number;
    showAdvancedTools: boolean;
    onToggleAdvancedTools: () => void;
    polishNotice: string | null;
    isQuickMode?: boolean;
    isWhisperMode?: boolean;
    onFinishLater?: () => void;
    onOpenFullStudio?: () => void;
};

export default function EntryTopBar({
    onBack,
    backLabel,
    isSaving,
    lastSaved,
    canSave,
    onSave,
    error,
    draftRestored,
    pendingSync,
    wordCount,
    readingTimeMinutes,
    showAdvancedTools,
    onToggleAdvancedTools,
    polishNotice,
    isQuickMode = false,
    isWhisperMode = false,
    onFinishLater,
    onOpenFullStudio,
}: EntryTopBarProps) {
    const saveStatus = isSaving
        ? 'Saving'
            : lastSaved
                ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Draft';
    const studioLabel = isWhisperMode ? 'Whisper mode' : isQuickMode ? 'New note' : 'Writing page';
    const studioPrompt = isWhisperMode
        ? 'Keep it gentle. The first honest line is enough.'
        : isQuickMode
            ? 'Get the real version down. Details can wait.'
            : 'Write first. Organize and polish only if they help later.';

    const statusSignals = [
        error
            ? {
                key: 'error',
                icon: <FiAlertTriangle size={14} aria-hidden="true" />,
                message: error,
                className: 'workspace-soft-panel text-[rgb(var(--text-primary))]',
            }
            : null,
        draftRestored
            ? {
                key: 'draft',
                icon: <FiRefreshCw size={14} aria-hidden="true" />,
                message: 'Draft restored',
                className: 'workspace-soft-panel text-ink-secondary',
            }
            : null,
        pendingSync
            ? {
                key: 'sync',
                icon: <FiCloud size={14} aria-hidden="true" />,
                message: 'Offline sync pending',
                className: 'workspace-soft-panel text-ink-secondary',
            }
            : null,
        polishNotice
            ? {
                key: 'polish',
                icon: <FiZap size={14} aria-hidden="true" />,
                message: polishNotice,
                className: 'workspace-soft-panel text-ink-secondary',
            }
            : null,
    ].filter(Boolean) as Array<{ key: string; icon: ReactNode; message: string; className: string }>;

    return (
        <>
            <div className="sticky top-3 z-20 mb-6 rounded-2xl workspace-soft-panel backdrop-blur-xl px-3 py-3 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label={backLabel}
                            title={backLabel}
                            className="p-3 -ml-1 rounded-2xl text-ink-secondary hover:text-[rgb(var(--text-primary))] hover:bg-white/10 transition-all"
                        >
                            <FiArrowLeft size={24} aria-hidden="true" />
                        </button>
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">{studioLabel}</p>
                            <h1 className="mt-1 truncate text-sm font-semibold workspace-heading sm:text-base">
                                {studioPrompt}
                            </h1>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2 workspace-pill rounded-xl px-3 py-2 text-xs uppercase tracking-[0.1em] text-ink-secondary">
                            <span className={`h-2 w-2 rounded-full ${isSaving ? 'bg-ink-secondary/60 animate-pulse' : lastSaved ? 'bg-ink-secondary' : 'bg-ink-muted/50'}`} />
                            <span>{saveStatus}</span>
                        </div>

                        <button
                            onClick={onSave}
                            disabled={!canSave}
                            className="hidden md:flex px-5 py-3 rounded-2xl primary-cta text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/25 transition-all items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <FiSave size={20} aria-hidden="true" />
                                    Save Note
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {statusSignals.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    {statusSignals.map((signal) => (
                        <div
                            key={signal.key}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${signal.className}`}
                        >
                            <span aria-hidden="true">{signal.icon}</span>
                            <span>{signal.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {isQuickMode && (
                <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-primary/80">One calm draft</p>
                            <p className="mt-1 text-sm text-[rgb(var(--text-primary))]">Start simple. Open more details only if they help this note go further.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {onOpenFullStudio && (
                                <button
                                    type="button"
                                    onClick={onOpenFullStudio}
                                    className="workspace-button-outline rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary hover:text-[rgb(var(--text-primary))] transition-colors"
                                >
                                    More details
                                </button>
                            )}
                            {onFinishLater && (
                                <button
                                    type="button"
                                    onClick={onFinishLater}
                                    className="rounded-xl border border-primary/30 bg-primary/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary hover:bg-primary/25 transition-colors"
                                >
                                    Save for later
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {!isQuickMode && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="workspace-pill px-3 py-1.5 rounded-full text-xs text-ink-secondary uppercase tracking-[0.08em]">
                        {wordCount} words
                    </span>
                    <span className="workspace-pill px-3 py-1.5 rounded-full text-xs text-ink-secondary uppercase tracking-[0.08em]">
                        {readingTimeMinutes} min read
                    </span>
                    <button
                        onClick={onToggleAdvancedTools}
                        className="px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-xs text-primary uppercase tracking-[0.08em] hover:bg-primary/25 transition-colors"
                    >
                        {showAdvancedTools ? 'Hide details' : 'More details'}
                    </button>
                </div>
            )}
        </>
    );
}
