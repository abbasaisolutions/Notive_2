'use client';

import React from 'react';
import { StructuredEntryData } from '@/services/structured-data.service';
import { FiChevronDown, FiZap } from 'react-icons/fi';
import type { IconType } from 'react-icons';

type MoodOption = {
    icon: IconType;
    label: string;
    value: string;
};

type EntryInsightsPanelProps = {
    showDetails: boolean;
    setShowDetails: (value: boolean) => void;
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
    showDetails,
    setShowDetails,
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
    if (!(showDetails || extractedData || isAnalyzing || aiInsights || isAiLoading || content.trim())) {
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

    return (
        <div className="relative group transition-all duration-300">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 to-zinc-500/20 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity" />
            <div className="relative glass-card rounded-2xl overflow-hidden border border-white/10 backdrop-blur-xl">
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-zinc-600 flex items-center justify-center shadow-lg ${isAnalyzing ? 'animate-pulse' : ''}`}>
                            <FiZap size={18} aria-hidden="true" className="text-white" />
                        </div>
                        <div>
                            <div className="text-white font-semibold flex items-center gap-2">
                                Quick Read
                                {isAnalyzing && (
                                    <span className="text-xs font-normal text-ink-secondary animate-pulse bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/15">
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
                                            <span className="text-white bg-white/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                                {SelectedMoodIcon && <SelectedMoodIcon size={12} aria-hidden="true" />}
                                                {displayMood}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                            {!extractedData && content.trim() && (
                                <div className="text-ink-secondary text-xs mt-1">
                                    Add a title, feeling, and tags. Use AI only if you want more help.
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center transition-transform duration-300 ${showDetails ? 'rotate-180 bg-white/10' : ''}`}>
                        <FiChevronDown size={20} className="text-ink-secondary" aria-hidden="true" />
                    </div>
                </button>

                <div className={`transition-all duration-300 ease-in-out ${showDetails ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    <div className="p-5 space-y-5 border-t border-white/5 bg-black/20">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <div>
                                <div className="text-sm font-semibold text-white">More AI Help</div>
                                <p className="text-xs uppercase tracking-[0.1em] text-ink-muted">On demand only</p>
                            </div>
                            <button
                                onClick={onDeepInsight}
                                disabled={isAiLoading || !content.trim()}
                                className="px-4 py-2 rounded-xl bg-white/[0.07] text-white border border-white/15 hover:bg-white/[0.1] transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isAiLoading ? 'Reading…' : 'Use AI'}
                            </button>
                        </div>

                        {aiError && (
                            <p className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-white">
                                {aiError}
                            </p>
                        )}

                        {(isCheckingDuplicates || duplicateCandidates.length > 0 || duplicateError) && (
                            <div className="grid gap-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-ink-secondary uppercase tracking-[0.12em]">Written Before</label>
                                        <p className="mt-1 text-sm text-white">
                                            Local retrieval checks whether this draft is close to an older note.
                                        </p>
                                    </div>
                                    {isCheckingDuplicates && (
                                        <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.08em] text-ink-secondary">
                                            Checking...
                                        </span>
                                    )}
                                </div>

                                {duplicateError && (
                                    <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white">
                                        {duplicateError}
                                    </p>
                                )}

                                {duplicateCandidates.length > 0 ? (
                                    <div className="grid gap-2">
                                        {duplicateCandidates.map((candidate) => (
                                            <div key={candidate.id} className="rounded-lg border border-white/10 bg-black/25 px-3 py-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                                                        candidate.duplicateKind === 'near_duplicate'
                                                            ? 'border-primary/35 bg-primary/12 text-primary'
                                                            : 'border-white/15 bg-white/[0.04] text-white'
                                                    }`}>
                                                        {candidate.duplicateKind === 'near_duplicate' ? 'Near duplicate' : 'Written before'}
                                                    </span>
                                                    <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-1 text-xs uppercase tracking-[0.12em] text-ink-secondary">
                                                        {Math.round(candidate.relevance * 100)}% match
                                                    </span>
                                                    <span className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                                                        {new Date(candidate.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm font-semibold text-white">{candidate.title || 'Untitled note'}</p>
                                                <p className="mt-1 text-xs leading-6 text-ink-secondary">{candidate.contentPreview}</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {candidate.matchReasons.slice(0, 2).map((reason) => (
                                                        <span key={`${candidate.id}-${reason}`} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-xs uppercase tracking-[0.08em] text-ink-secondary">
                                                            {reason}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : !isCheckingDuplicates && !duplicateError ? (
                                    <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-ink-secondary">
                                        No strong duplicate signal yet. Keep writing if this note is still taking shape.
                                    </p>
                                ) : null}
                            </div>
                        )}

                        {aiInsights && (
                            <div className="grid gap-3 rounded-xl border border-white/15 bg-gradient-to-br from-primary/10 to-zinc-500/10 p-4">
                                <label className="text-xs font-semibold text-ink-secondary uppercase tracking-[0.12em]">AI Summary</label>
                                {aiSentimentSummary && <p className="text-sm text-white line-clamp-3">{aiSentimentSummary}</p>}
                                <div className="flex flex-wrap gap-2">
                                    {aiSuggestedMood && (
                                        <span className="text-xs px-2 py-1 rounded-full border border-white/15 bg-white/10 text-white uppercase tracking-[0.1em]">
                                            Mood: {aiSuggestedMood}
                                        </span>
                                    )}
                                    {aiTopics.map((topic: string, i: number) => (
                                        <span key={i} className="text-xs px-2 py-1 rounded-full border border-white/15 bg-white/10 text-white uppercase tracking-[0.1em]">
                                            #{topic}
                                        </span>
                                    ))}
                                </div>

                                {aiEmotionEntries.length > 0 && (
                                    <div className="mt-1 grid gap-2">
                                        <label className="text-xs font-semibold text-ink-secondary uppercase tracking-[0.12em]">Feelings Mix</label>
                                        {aiEmotionEntries.map(([emotion, score]) => (
                                            <div key={emotion} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                                <div className="min-w-0">
                                                    <div className="flex justify-between text-xs text-ink-secondary mb-1">
                                                        <span className="capitalize">{emotion}</span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
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
                                        <label className="text-xs font-semibold text-ink-secondary uppercase tracking-[0.12em]">Story Check</label>
                                        <div className="grid gap-2">
                                            {evidenceRows.map((row) => (
                                                <div key={row.label} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                                                    <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-1">{row.label}</p>
                                                    <p className="text-xs text-white line-clamp-2">{row.value}</p>
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
                                            className="w-full bg-white/5 hover:bg-white/10 transition-colors rounded-xl px-4 py-3 text-white placeholder-ink-muted border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-ink-muted mb-2 block uppercase tracking-[0.12em]">Mood</label>
                                        <div className="flex flex-wrap gap-2">
                                            {moods.map((m) => (
                                                <button
                                                    key={m.value}
                                                    onClick={() => setMoodOverride(moodOverride === m.value ? null : m.value)}
                                                    className={`px-2.5 py-2 rounded-xl text-sm flex items-center gap-1.5 transition-all border ${displayMood === m.value
                                                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/25'
                                                        : 'bg-white/5 border-white/5 text-ink-secondary hover:bg-white/10 hover:border-white/10'
                                                        }`}
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
                                                <span key={tag} className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-ink-secondary border border-white/5 text-sm transition-colors">
                                                    #{tag}
                                                    <button onClick={() => removeTag(tag)} className="text-ink-muted hover:text-ink-secondary ml-1">×</button>
                                                </span>
                                            ))}
                                            <input
                                                type="text"
                                                placeholder="Add"
                                                className="px-3 py-1.5 rounded-lg bg-transparent text-sm text-white placeholder-ink-muted border border-white/10 focus:border-primary/50 focus:outline-none w-24 hover:bg-white/5 focus:bg-white/5 transition-colors"
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
                </div>
            </div>
        </div>
    );
}

