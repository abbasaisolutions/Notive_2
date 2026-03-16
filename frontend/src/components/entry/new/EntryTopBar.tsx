'use client';

import type { ReactNode } from 'react';
import { FiAlertTriangle, FiArrowLeft, FiCloud, FiLogOut, FiRefreshCw, FiSave, FiZap } from 'react-icons/fi';

type EntryTopBarProps = {
    onBack: () => void;
    backLabel: string;
    isSaving: boolean;
    lastSaved: Date | null;
    canSave: boolean;
    onSave: () => void;
    onSignOut: () => void;
    isSigningOut: boolean;
    error: string;
    draftRestored: boolean;
    pendingSync: boolean;
    wordCount: number;
    readingTimeMinutes: number;
    showAdvancedTools: boolean;
    onToggleAdvancedTools: () => void;
    polishNotice: string | null;
    isQuickMode?: boolean;
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
    onSignOut,
    isSigningOut,
    error,
    draftRestored,
    pendingSync,
    wordCount,
    readingTimeMinutes,
    showAdvancedTools,
    onToggleAdvancedTools,
    polishNotice,
    isQuickMode = false,
    onFinishLater,
    onOpenFullStudio,
}: EntryTopBarProps) {
    const saveStatus = isSaving
        ? 'Saving'
        : lastSaved
            ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Draft';

    const statusSignals = [
        error
            ? {
                key: 'error',
                icon: <FiAlertTriangle size={14} aria-hidden="true" />,
                message: error,
                className: 'border-white/15 bg-white/[0.03] text-white',
            }
            : null,
        draftRestored
            ? {
                key: 'draft',
                icon: <FiRefreshCw size={14} aria-hidden="true" />,
                message: 'Draft restored',
                className: 'border-neutral-400/25 bg-neutral-500/10 text-neutral-200',
            }
            : null,
        pendingSync
            ? {
                key: 'sync',
                icon: <FiCloud size={14} aria-hidden="true" />,
                message: 'Offline sync pending',
                className: 'border-zinc-400/25 bg-zinc-500/10 text-zinc-200',
            }
            : null,
        polishNotice
            ? {
                key: 'polish',
                icon: <FiZap size={14} aria-hidden="true" />,
                message: polishNotice,
                className: 'border-stone-400/25 bg-stone-500/10 text-stone-200',
            }
            : null,
    ].filter(Boolean) as Array<{ key: string; icon: ReactNode; message: string; className: string }>;

    return (
        <>
            <div className="sticky top-3 z-20 mb-6 rounded-2xl border border-white/12 bg-surface-1/80 backdrop-blur-xl px-3 py-3 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label={backLabel}
                            title={backLabel}
                            className="p-3 -ml-1 rounded-2xl text-ink-secondary hover:text-white hover:bg-white/10 transition-all"
                        >
                            <FiArrowLeft size={24} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={onSignOut}
                            disabled={isSigningOut}
                            className="p-3 rounded-2xl text-ink-secondary hover:text-ink-secondary hover:bg-white/[0.03] border border-transparent hover:border-white/15 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            {isSigningOut ? (
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <FiLogOut size={21} aria-hidden="true" />
                            )}
                        </button>

                        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.1em] text-ink-secondary">
                            <span className={`h-2 w-2 rounded-full ${isSaving ? 'bg-white/60 animate-pulse' : lastSaved ? 'bg-neutral-300' : 'bg-white/30'}`} />
                            <span>{saveStatus}</span>
                        </div>
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
                                {isQuickMode ? 'Save Quick Note' : 'Save Note'}
                            </>
                        )}
                    </button>
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
                            <p className="text-xs uppercase tracking-[0.12em] text-primary/80">Quick Note</p>
                            <p className="mt-1 text-sm text-white">Save the thought now. You can organize and polish it later.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {onOpenFullStudio && (
                                <button
                                    type="button"
                                    onClick={onOpenFullStudio}
                                    className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-white/[0.08] transition-colors"
                                >
                                    Full Editor
                                </button>
                            )}
                            {onFinishLater && (
                                <button
                                    type="button"
                                    onClick={onFinishLater}
                                    className="rounded-xl border border-primary/30 bg-primary/15 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary hover:bg-primary/25 transition-colors"
                                >
                                    Finish Later
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 rounded-full bg-surface-2/60 border border-white/12 text-xs text-ink-secondary uppercase tracking-[0.08em]">
                    {wordCount} words
                </span>
                <span className="px-3 py-1.5 rounded-full bg-surface-2/60 border border-white/12 text-xs text-ink-secondary uppercase tracking-[0.08em]">
                    {readingTimeMinutes} min read
                </span>
                {!isQuickMode && (
                    <button
                        onClick={onToggleAdvancedTools}
                        className="px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-xs text-primary uppercase tracking-[0.08em] hover:bg-primary/25 transition-colors"
                    >
                        {showAdvancedTools ? 'Hide Options' : 'More Options'}
                    </button>
                )}
            </div>
        </>
    );
}

