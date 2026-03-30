'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { StructuredEntryData, structuredDataService } from '@/services/structured-data.service';
import { getMoodEmoji, normalizeMood } from '@/constants/moods';
import type { ReactNode } from 'react';
import {
    FiActivity,
    FiChevronDown,
    FiCpu,
    FiMapPin,
    FiMessageCircle,
    FiTag,
    FiTarget,
    FiTrendingUp,
    FiZap,
} from 'react-icons/fi';

interface StructuredDataPreviewProps {
    content: string;
    onDataExtracted?: (data: StructuredEntryData) => void;
}

const formatMoodLabel = (mood: string) => {
    const normalized = normalizeMood(mood) || mood;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const sentimentStyles: Record<StructuredEntryData['overallSentiment'], string> = {
    positive: 'workspace-pill text-[rgb(var(--text-primary))]',
    negative: 'workspace-pill text-ink-secondary',
    mixed: 'workspace-pill-muted text-ink-secondary',
    neutral: 'workspace-pill-muted text-ink-secondary',
};

const sentimentLabels: Record<StructuredEntryData['overallSentiment'], string> = {
    positive: 'Positive',
    negative: 'Reflective',
    mixed: 'Mixed',
    neutral: 'Neutral',
};

const goalStatusStyles: Record<StructuredEntryData['goals'][number]['status'], string> = {
    achieved: 'workspace-pill text-[rgb(var(--text-primary))]',
    struggling: 'workspace-soft-panel text-ink-secondary',
    'in-progress': 'workspace-pill text-ink-secondary',
    new: 'border-primary/30 bg-primary/12 text-primary',
};

export default function StructuredDataPreview({ content, onDataExtracted }: StructuredDataPreviewProps) {
    const [data, setData] = useState<StructuredEntryData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const normalizedPrimaryMood = data?.primaryEmotion?.emotion
        ? (normalizeMood(data.primaryEmotion.emotion) || data.primaryEmotion.emotion)
        : null;
    const summaryCards = useMemo(() => {
        if (!data) return [];
        const signalCount = data.people.length + data.activities.length + data.places.length;
        return [
            {
                id: 'sentiment',
                icon: <FiZap size={12} aria-hidden="true" />,
                label: 'Tone',
                value: sentimentLabels[data.overallSentiment],
                className: sentimentStyles[data.overallSentiment],
            },
            {
                id: 'mood',
                icon: <FiActivity size={12} aria-hidden="true" />,
                label: 'Main feeling',
                value: normalizedPrimaryMood
                    ? `${formatMoodLabel(normalizedPrimaryMood)} ${data.primaryEmotion.intensity}/10`
                    : 'Not set',
                className: 'border-primary/30 bg-primary/12 text-primary',
            },
            {
                id: 'signals',
                icon: <FiCpu size={12} aria-hidden="true" />,
                label: 'Found',
                value: `${signalCount} items`,
                className: 'workspace-pill text-[rgb(var(--text-primary))]',
            },
            {
                id: 'volume',
                icon: <FiTrendingUp size={12} aria-hidden="true" />,
                label: 'Size',
                value: `${data.wordCount} words · ${data.readingTime}m`,
                className: 'workspace-pill-muted text-ink-secondary',
            },
        ] as Array<{ id: string; icon: ReactNode; label: string; value: string; className: string }>;
    }, [data, normalizedPrimaryMood]);

    useEffect(() => {
        if (content.length < 20) {
            setData(null);
            return;
        }

        const analyzeContent = async () => {
            setIsLoading(true);
            try {
                const extracted = await structuredDataService.extractStructuredData(content);
                setData(extracted);
                onDataExtracted?.(extracted);
            } catch (error) {
                console.error('Failed to extract structured data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce analysis
        const timer = setTimeout(analyzeContent, 1500);
        return () => clearTimeout(timer);
    }, [content, onDataExtracted]);

    if (!data && !isLoading) return null;

    return (
        <section className="workspace-panel mb-6 overflow-hidden rounded-2xl">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex w-full items-center justify-between p-4 transition-colors hover:bg-primary/[0.04] md:p-5"
            >
                <div className="flex items-center gap-2.5">
                    <FiCpu size={20} aria-hidden="true" />
                    <div className="text-left">
                        <p className="workspace-heading font-semibold">Quick Read</p>
                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">What Notive found</p>
                    </div>
                    {isLoading && (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className={`hidden sm:inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${isLoading ? 'border-primary/35 bg-primary/15 text-primary' : 'workspace-pill text-[rgb(var(--text-primary))]'
                        }`}>
                        {isLoading ? 'Reading' : 'Ready'}
                    </span>
                    <FiChevronDown size={20} className={`text-ink-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                </div>
            </button>

            {data && (
                <div className="px-4 pb-4 md:px-5 md:pb-5">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
                        {summaryCards.map((card) => (
                            <div
                                key={card.id}
                                className={`rounded-xl border px-3 py-2 ${card.className}`}
                            >
                                <p className="text-xs uppercase tracking-[0.12em] opacity-75 mb-1">
                                    {card.icon} {card.label}
                                </p>
                                <p className="text-sm font-semibold leading-tight">{card.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isExpanded && data && (
                <div className="space-y-4 border-t border-[rgba(var(--paper-border),0.92)] px-4 pb-4 pt-4 md:px-5 md:pb-5 md:pt-5">
                    {data.title !== 'Untitled Entry' && data.title !== 'Untitled Note' && (
                        <div className="workspace-soft-panel rounded-xl p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-1">Title idea</p>
                            <p className="workspace-heading line-clamp-2 font-semibold">{data.title}</p>
                        </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                        {data.people.length > 0 && (
                            <div className="workspace-soft-panel rounded-xl p-3">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-2 inline-flex items-center gap-1.5"><FiMessageCircle size={12} aria-hidden="true" />People</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {data.people.slice(0, 6).map((person, i) => (
                                        <span
                                            key={`${person.name}-${i}`}
                                            className={`rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${person.sentiment > 0.3
                                                ? 'workspace-pill text-[rgb(var(--text-primary))]'
                                                : person.sentiment < -0.3
                                                    ? 'workspace-pill text-ink-secondary'
                                                    : 'workspace-pill-muted text-ink-secondary'
                                                }`}
                                        >
                                            {person.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.activities.length > 0 && (
                            <div className="workspace-soft-panel rounded-xl p-3">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-2 inline-flex items-center gap-1.5"><FiActivity size={12} aria-hidden="true" />Activities</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {data.activities.slice(0, 6).map((activity, i) => (
                                        <span
                                            key={`${activity.name}-${i}`}
                                            className="rounded-full border border-primary/30 bg-primary/12 px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary"
                                        >
                                            {activity.name}
                                            {activity.duration ? ` · ${activity.duration}` : ''}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.places.length > 0 && (
                            <div className="workspace-soft-panel rounded-xl p-3">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-2 inline-flex items-center gap-1.5"><FiMapPin size={12} aria-hidden="true" />Places</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {data.places.slice(0, 6).map((place, i) => (
                                        <span
                                            key={`${place.name}-${i}`}
                                            className="rounded-full border border-secondary/30 bg-secondary/12 px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-secondary"
                                        >
                                            {place.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.suggestedTags.length > 0 && (
                            <div className="workspace-soft-panel rounded-xl p-3">
                                <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-2 inline-flex items-center gap-1.5"><FiTag size={12} aria-hidden="true" />Tags</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {data.suggestedTags.slice(0, 8).map((tag, i) => (
                                        <span
                                            key={`${tag}-${i}`}
                                            className="workspace-pill-muted rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {data.goals.length > 0 && (
                        <div className="workspace-soft-panel rounded-xl p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-2 inline-flex items-center gap-1.5"><FiTarget size={12} aria-hidden="true" />Goals</p>
                            <div className="space-y-2">
                                {data.goals.map((goal, i) => (
                                    <div key={`${goal.goal}-${i}`} className="workspace-muted-panel rounded-lg px-3 py-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em] ${goalStatusStyles[goal.status]}`}>
                                                {goal.status.replace('-', ' ')}
                                            </span>
                                            <span className="workspace-pill-muted rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-[0.12em] text-ink-secondary">
                                                {goal.category}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm leading-snug text-[rgb(var(--text-primary))]">{goal.goal}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.insights.length > 0 && (
                        <div className="workspace-soft-panel rounded-xl p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-2 inline-flex items-center gap-1.5"><FiTrendingUp size={12} aria-hidden="true" />Main ideas</p>
                            <div className="grid gap-2 md:grid-cols-2">
                                {data.insights.slice(0, 6).map((insight, i) => (
                                    <div
                                        key={`${insight.type}-${i}`}
                                        className="workspace-muted-panel rounded-lg px-3 py-2"
                                    >
                                        <p className="text-xs uppercase tracking-[0.12em] text-ink-muted mb-1">{insight.type}</p>
                                        <p className="line-clamp-2 text-sm text-[rgb(var(--text-primary))]">{insight.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

