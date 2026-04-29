'use client';

import { type ReactNode } from 'react';
import { MIN_CHARACTERS_FOR_ENTRY_SAVE, MIN_WORDS_FOR_ENTRY_INSIGHTS } from '@/constants/entry-requirements';
import { FiAlertTriangle, FiArrowLeft, FiCloud, FiMic, FiRefreshCw, FiZap } from 'react-icons/fi';

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
    isBackgroundRefining?: boolean;
    onFinishLater?: () => void;
    onOpenFullStudio?: () => void;
    saveLabel?: string;
    /** Optional inline hint surfaced when the user can't yet save (e.g. below 60-char minimum). */
    saveHint?: string | null;
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
    isBackgroundRefining = false,
    onFinishLater,
    onOpenFullStudio,
    saveLabel = 'Save',
    saveHint = null,
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
    const saveRuleLabel = `${MIN_CHARACTERS_FOR_ENTRY_SAVE} chars to save`;
    const progressLabel = isQuickMode
        ? wordCount > 0
            ? `${wordCount} words`
            : studioPrompt.split('.')[0]
        : wordCount > 0
            ? wordCount >= MIN_WORDS_FOR_ENTRY_INSIGHTS
                ? `${wordCount} words · insights ready`
                : `${wordCount} words · ${saveRuleLabel}`
            : `${saveRuleLabel} · ${MIN_WORDS_FOR_ENTRY_INSIGHTS} words for insights`;

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
        isBackgroundRefining
            ? {
                key: 'refining',
                icon: <FiMic size={14} className="animate-pulse" aria-hidden="true" />,
                message: 'Refining voice transcript…',
                className: 'border-[rgba(138,154,111,0.3)] bg-[rgba(138,154,111,0.08)] text-[rgb(var(--paper-sage))]',
            }
            : null,
    ].filter(Boolean) as Array<{ key: string; icon: ReactNode; message: string; className: string }>;

    return (
        <>
            <div className="sticky top-3 z-20 mb-3 rounded-2xl workspace-soft-panel backdrop-blur-xl px-3 py-2.5 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={onBack}
                            aria-label={backLabel}
                            title={backLabel}
                            className="p-2 -ml-1 rounded-2xl text-ink-secondary hover:text-[rgb(var(--text-primary))] hover:bg-white/10 transition-all"
                        >
                            <FiArrowLeft size={20} aria-hidden="true" />
                        </button>
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-ink-muted font-semibold leading-none">{studioLabel}</p>
                            <p className={`mt-0.5 text-[0.65rem] leading-none ${
                                !isQuickMode && wordCount >= MIN_WORDS_FOR_ENTRY_INSIGHTS ? 'text-[rgb(var(--paper-sage))]' : 'text-ink-muted'
                            }`}>
                                {progressLabel}
                            </p>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <div className="flex items-center gap-1.5 workspace-pill rounded-full px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.1em] text-ink-secondary">
                            <span className={`h-1.5 w-1.5 rounded-full ${isSaving ? 'bg-ink-secondary/60 animate-pulse' : lastSaved ? 'bg-ink-secondary' : 'bg-ink-muted/50'}`} />
                            <span>{saveStatus}</span>
                        </div>

                        {onOpenFullStudio && isQuickMode && (
                            <button
                                type="button"
                                onClick={onOpenFullStudio}
                                className="rounded-full border border-primary/25 bg-primary/8 px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.08em] text-primary transition-all hover:border-primary/40 hover:bg-primary/15"
                            >
                                Studio
                            </button>
                        )}

                        <button
                            onClick={onSave}
                            disabled={!canSave}
                            title={saveHint || undefined}
                            aria-describedby={saveHint ? 'entry-top-bar-save-hint' : undefined}
                            className="hidden rounded-full primary-cta px-3 py-1.5 text-xs font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
                        >
                            {isSaving ? '...' : saveLabel}
                        </button>
                        {saveHint && (
                            <span
                                id="entry-top-bar-save-hint"
                                aria-live="polite"
                                className="ml-1 hidden text-[0.65rem] text-ink-muted md:inline"
                            >
                                {saveHint}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {statusSignals.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                    {statusSignals.map((signal) => (
                        <div
                            key={signal.key}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${signal.className}`}
                        >
                            <span aria-hidden="true">{signal.icon}</span>
                            <span>{signal.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}
