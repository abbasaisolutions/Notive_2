'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FiAlertTriangle, FiArrowLeft, FiCloud, FiEdit3, FiMic, FiRefreshCw, FiSave, FiZap } from 'react-icons/fi';

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
}: EntryTopBarProps) {
    const [isMilestone, setIsMilestone] = useState(false);
    const lastMilestoneRef = useRef(0);
    const [toolPhase, setToolPhase] = useState(0); // 0=mic, 1=pen, 2=both

    // Cycle through mic → pen → both for the creative studio pill
    useEffect(() => {
        const interval = setInterval(() => setToolPhase(p => (p + 1) % 3), 2400);
        return () => clearInterval(interval);
    }, []);

    // Detect word count milestones (50, 100, 200, 300, 500)
    const MILESTONES = [50, 100, 200, 300, 500];
    useEffect(() => {
        const crossed = MILESTONES.find(m => wordCount >= m && lastMilestoneRef.current < m);
        if (crossed) {
            lastMilestoneRef.current = crossed;
            setIsMilestone(true);
            const timer = setTimeout(() => setIsMilestone(false), 500);
            return () => clearTimeout(timer);
        }
    }, [wordCount]);

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
                            <p className="text-[10px] uppercase tracking-[0.16em] text-ink-muted font-semibold">{studioLabel}</p>
                            <h1 className="mt-0.5 text-xs font-medium text-ink-secondary leading-snug sm:text-sm">
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
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className={`workspace-pill px-3 py-1.5 rounded-full text-xs text-ink-secondary uppercase tracking-[0.08em] ${isMilestone ? 'milestone-celebrate' : ''}`}>
                        {wordCount} words
                    </span>
                    {onOpenFullStudio && (
                        <button
                            type="button"
                            onClick={onOpenFullStudio}
                            className="studio-tools-pill group relative flex items-center gap-1.5 overflow-hidden rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-primary transition-all hover:border-primary/40 hover:bg-primary/15 hover:shadow-md hover:shadow-primary/10"
                        >
                            {/* Mic icon — visible in phase 0 and 2 */}
                            <span className={`inline-flex transition-all duration-500 ${toolPhase === 1 ? 'w-0 scale-0 opacity-0' : 'w-4 scale-100 opacity-100'}`}>
                                <FiMic size={14} className="studio-tool-mic" aria-hidden="true" />
                            </span>
                            {/* Pen icon — visible in phase 1 and 2 */}
                            <span className={`inline-flex transition-all duration-500 ${toolPhase === 0 ? 'w-0 scale-0 opacity-0' : 'w-4 scale-100 opacity-100'}`}>
                                <FiEdit3 size={14} className="studio-tool-pen" aria-hidden="true" />
                            </span>
                            <span className="relative">
                                Studio
                                <span className="absolute -bottom-px left-0 h-px w-0 bg-primary/50 transition-all duration-300 group-hover:w-full" />
                            </span>
                        </button>
                    )}
                </div>
            )}

            {!isQuickMode && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className={`workspace-pill px-3 py-1.5 rounded-full text-xs text-ink-secondary uppercase tracking-[0.08em] ${isMilestone ? 'milestone-celebrate' : ''}`}>
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
