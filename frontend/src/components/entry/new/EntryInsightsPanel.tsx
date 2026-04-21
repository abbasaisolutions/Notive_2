'use client';

import React from 'react';
import { StructuredEntryData } from '@/services/structured-data.service';
import { FiChevronDown, FiZap } from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { hapticTap } from '@/services/haptics.service';

type MoodOption = {
    icon: IconType;
    label: string;
    value: string;
};

type EntryInsightsPanelProps = {
    showDetails?: boolean;
    setShowDetails?: (value: boolean) => void;
    embedded?: boolean;
    isAnalyzing: boolean;
    extractedData: StructuredEntryData | null;
    displayMood: string | null;
    moods: MoodOption[];
    content: string;
    isAiLoading: boolean;
    onDeepInsight: () => void;
    aiError: string;
    aiInsights: Record<string, unknown> | null;
    aiEmotionEntries: Array<readonly [string, number]>;
    aiEmotionMax: number;
    displayTitle: string;
    setTitleOverride: (value: string) => void;
    moodOverride: string | null;
    setMoodOverride: (value: string | null) => void;
    displayTags: string[];
    removeTag: (tag: string) => void;
    addTag: (tag: string) => void;
    duplicateCandidates: Array<{
        id: string;
        title: string | null;
        contentPreview: string;
        mood: string | null;
        createdAt: string;
        relevance: number;
        duplicateKind: 'near_duplicate' | 'written_before';
        matchReasons: string[];
    }>;
    isCheckingDuplicates: boolean;
    duplicateError: string;
};

export default function EntryInsightsPanel({
    showDetails = false,
    setShowDetails = () => {},
    embedded = false,
    isAnalyzing,
    extractedData,
    displayMood,
    moods,
    content,
    isAiLoading,
    onDeepInsight,
    aiError,
    aiInsights,
    aiEmotionEntries,
    aiEmotionMax,
    displayTitle,
    setTitleOverride,
    moodOverride,
    setMoodOverride,
    displayTags,
    removeTag,
    addTag,
    duplicateCandidates,
    isCheckingDuplicates,
    duplicateError,
}: EntryInsightsPanelProps) {
    const shouldRender = embedded || showDetails || extractedData || isAnalyzing || aiInsights || isAiLoading || content.trim();

    if (!shouldRender) {
        return null;
    }

    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

    const aiSentimentSummary = (() => {
        if (!aiInsights) return null;
        const sentiment = aiInsights.sentiment as { summary?: string } | undefined;
        return sentiment?.summary || null;
    })();

    const aiSuggestedMood = typeof aiInsights?.suggestedMood === 'string' ? aiInsights.suggestedMood : null;
    const aiTopics = Array.isArray(aiInsights?.topics)
        ? (aiInsights.topics as string[])
        : [];
    const aiEvidence = aiInsights && typeof aiInsights.evidence === 'object' && aiInsights.evidence !== null && !Array.isArray(aiInsights.evidence)
        ? (aiInsights.evidence as Record<string, unknown>)
        : null;
    const readEvidenceText = (value: unknown): string | null => {
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const point = value as { text?: unknown };
        return typeof point.text === 'string' && point.text.trim() ? point.text.trim() : null;
    };
    const evidenceRows = [
        { label: 'Situation', value: readEvidenceText(aiEvidence?.situation) },
        { label: 'Action', value: readEvidenceText(aiEvidence?.action) },
        { label: 'Lesson', value: readEvidenceText(aiEvidence?.lesson) },
        { label: 'Result', value: readEvidenceText(aiEvidence?.outcome) },
    ].filter((row) => !!row.value);
    const selectedMoodOption = displayMood ? moods.find((m) => m.value === displayMood) : null;
    const SelectedMoodIcon = selectedMoodOption?.icon;

    const detailBody = (
        <div className={`space-y-5 ${embedded ? '' : 'border-t border-[rgba(var(--paper-border),0.92)] bg-[rgba(255,255,255,0.52)] p-5'}`}>
            <div className="workspace-soft-panel flex flex-col justify-between gap-3 rounded-xl p-4 sm:flex-row sm:items-center">
                <div>
                    <div className="workspace-heading text-sm font-semibold">Optional Notive help</div>
                    <p className="text-xs uppercase tracking-[0.1em] text-ink-muted">Only when it helps</p>
                </div>
                <button
                    onClick={onDeepInsight}
                    disabled={isAiLoading || !content.trim()}
                    className="workspace-button-outline rounded-xl px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isAiLoading ? 'Reading...' : 'Ask Notive'}
                </button>
            </div>

            {aiError && (
                <p className="workspace-soft-panel rounded-xl px-3 py-2 text-xs text-[rgb(var(--text-primary))]">
                    {aiError}
                </p>
            )}

            {(isCheckingDuplicates || duplicateCandidates.length > 0 || duplicateError) && (
                <div className="workspace-soft-panel grid gap-3 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <label className="text-xs font-semibold text-ink-secondary uppercase tracking-[0.12em]">Looks familiar</label>
                            <p className="mt-1 text-sm text-[rgb(var(--text-primary))]">
                                A quick local check looks for older notes that sound close to this one.
                            </p>
                        </div>
                        {isCheckingDuplicates && (
                            <span className="workspace-pill-muted rounded-full px-2 py-1 text-xs uppercase tracking-[0.08em] text-ink-secondary">
                                Checking...
                            </span>
                        )}
                    </div>

                    {duplicateError && (
                        <p className="workspace-muted-panel rounded-lg px-3 py-2 text-xs text-[rgb(var(--text-primary))]">
                            {duplicateError}
                        </p>
                    )}

                    {duplicateCandidates.length > 0 ? (
                        <div className="grid gap-2">
                            {duplicateCandidates.map((candidate) => (
                                <div key={candidate.id} className="workspace-panel rounded-lg px-3 py-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                                            candidate.duplicateKind === 'near_duplicate'
                                                ? 'border-primary/35 bg-primary/12 text-primary'
                                                : 'workspace-pill-muted text-[rgb(var(--text-primary))]'
                                        }`}>
                                            {candidate.duplicateKind === 'near_duplicate' ? 'Very close note' : 'Written before'}
                                        </span>
                                        <span className="workspace-pill-muted rounded-full px-2 py-1 text-xs uppercase tracking-[0.12em] text-ink-secondary">
                                            {Math.round(candidate.relevance * 100)}% match
                                        </span>
                                        <span className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                            {new Date(candidate.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <p className="workspace-heading mt-2 text-sm font-semibold">{candidate.title || 'Untitled note'}</p>
                                    <p className="mt-1 text-xs leading-6 text-ink-secondary">{candidate.contentPreview}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {candidate.matchReasons.slice(0, 2).map((reason) => (
                                            <span key={`${candidate.id}-${reason}`} className="workspace-pill-muted rounded-full px-2 py-1 text-xs uppercase tracking-[0.08em] text-ink-secondary">
                                                {reason}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !isCheckingDuplicates && !duplicateError ? (
                        <p className="workspace-muted-panel rounded-lg px-3 py-2 text-xs text-ink-secondary">
                            No strong match yet. Keep writing if this still feels like a new page.
                        </p>
                    ) : null}
                </div>
            )}

            {aiInsights && (
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-gradient-to-br from-primary/10 to-zinc-500/10 p-4">
                    <label className="text-xs font-semibold text-ink-secondary uppercase tracking-[0.12em]">Notive read</label>
                    {aiSentimentSummary && <p className="line-clamp-3 text-sm text-[rgb(var(--text-primary))]">{aiSentimentSummary}</p>}
                    <div className="flex flex-wrap gap-2">
                        {aiSuggestedMood && (
                            <span className="workspace-pill-muted rounded-full px-2 py-1 text-xs uppercase tracking-[0.1em] text-[rgb(var(--text-primary))]">
                                Mood: {aiSuggestedMood}
                            </span>
                        )}
                        {aiTopics.map((topic: string, i: number) => (
                            <span key={i} className="workspace-pill-muted rounded-full px-2 py-1 text-xs uppercase tracking-[0.1em] text-[rgb(var(--text-primary))]">
                                #{topic}
                            </span>
                        ))}
                    </div>

                    {aiEmotionEntries.length > 0 && (
                        <div className="mt-1 grid gap-2">
                            <label className="text-xs font-semibold text-ink-secondary uppercase tracking-[0.12em]">Feelings mix</label>
                            {aiEmotionEntries.map(([emotion, score]) => (
                                <div key={emotion} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                    <div className="min-w-0">
                                        <div className="flex justify-between text-xs text-ink-secondary mb-1">
                                            <span className="capitalize">{emotion}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-ink-muted/20 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                                                style={{ width: `${Math.max(8, Math.round((score / aiEmotionMax) * 100))}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-xs text-ink-muted">{score.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {evidenceRows.length > 0 && (
                        <div className="mt-1 grid gap-2">
                            <label className="text-xs font-semibold text-ink-secondary uppercase tracking-[0.12em]">Story check</label>
                            <div className="grid gap-2">
                                {evidenceRows.map((row) => (
                                    <div key={row.label} className="workspace-panel rounded-lg px-3 py-2">
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-1">{row.label}</p>
                                        <p className="line-clamp-2 text-xs text-[rgb(var(--text-primary))]">{row.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {content.trim() && (
                <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-ink-muted mb-2 block uppercase tracking-[0.12em]">Title</label>
                            <input
                                type="text"
                                value={displayTitle}
                                onChange={(e) => setTitleOverride(e.target.value)}
                                className="workspace-input w-full rounded-xl px-4 py-3 transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-ink-muted mb-2 block uppercase tracking-[0.12em]">Mood</label>
                            <div
                                className="chip-scroller -mx-1 gap-2 px-1"
                                role="radiogroup"
                                aria-label="Mood"
                            >
                                {moods.map((m) => (
                                    <button
                                        key={m.value}
                                        onClick={() => { hapticTap(); setMoodOverride(moodOverride === m.value ? null : m.value); }}
                                        className={`shrink-0 snap-start px-2.5 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all border ${displayMood === m.value
                                            ? 'bg-primary border-primary text-[rgb(var(--paper-soft))] shadow-lg shadow-primary/25'
                                            : 'workspace-button-outline text-ink-secondary'
                                            }`}
                                        role="radio"
                                        aria-checked={displayMood === m.value}
                                        title={m.label}
                                    >
                                        <m.icon size={14} aria-hidden="true" />
                                        <span className="text-xs uppercase tracking-[0.08em]">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-ink-muted mb-2 block uppercase tracking-[0.12em]">Tags</label>
                            <div className="flex flex-wrap gap-2">
                                {displayTags.map((tag) => (
                                    <span key={tag} className="workspace-pill-muted group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-ink-secondary transition-colors">
                                        #{tag}
                                        <button onClick={() => removeTag(tag)} aria-label={`Remove tag ${tag}`} className="text-ink-muted hover:text-ink-secondary ml-1">×</button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    placeholder="Add"
                                    className="workspace-input min-w-[4rem] flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors focus:border-primary/50 focus:outline-none"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            addTag((e.target as HTMLInputElement).value.trim());
                                            (e.target as HTMLInputElement).value = '';
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    if (embedded) {
        return detailBody;
    }

    return (
        <div className="mb-6 transition-all duration-300">
            <div className="workspace-panel overflow-hidden rounded-2xl">
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-[rgba(255,255,255,0.36)]"
                >
                    <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 ${isAnalyzing ? 'animate-pulse' : ''}`}>
                            <FiZap size={18} aria-hidden="true" className="text-primary" />
                        </div>
                        <div>
                            <div className="workspace-heading flex items-center gap-2 font-semibold">
                                What the page notices
                                {isAnalyzing && (
                                    <span className="workspace-pill-muted animate-pulse rounded-full px-2 py-0.5 text-xs font-normal text-ink-secondary">
                                        Reading...
                                    </span>
                                )}
                            </div>
                            {extractedData && (
                                <div className="text-ink-secondary text-xs mt-1 flex items-center gap-2">
                                    <span>{extractedData.wordCount || wordCount} words</span>
                                    {displayMood && (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-primary/85" />
                                            <span className="workspace-pill-muted flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[rgb(var(--text-primary))]">
                                                {SelectedMoodIcon && <SelectedMoodIcon size={12} aria-hidden="true" />}
                                                {displayMood}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                            {!extractedData && content.trim() && (
                                <div className="text-ink-secondary text-xs mt-1">
                                    Title, mood, and tags are optional. Use them only if they help you find this note later.
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={`workspace-icon-badge flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}>
                        <FiChevronDown size={20} className="text-ink-secondary" aria-hidden="true" />
                    </div>
                </button>

                <div className={`transition-all duration-300 ease-in-out ${showDetails ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    {detailBody}
                </div>
            </div>
        </div>
    );
}
