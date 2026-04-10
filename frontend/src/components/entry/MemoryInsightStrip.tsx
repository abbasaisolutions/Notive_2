'use client';

import { AppPanel, TagPill } from '@/components/ui/surface';
import { cn } from '@/utils/cn';
import { formatStoryConfidence, storyFieldLabel, storyStatusClassName, storyStatusLabel } from '@/utils/story-engine';
import type { MemoryInsightData } from '@/components/entry/memory-insight-types';

type MemoryInsightStripProps = MemoryInsightData & {
    className?: string;
    label?: string;
    description?: string;
};

const insightTypeLabel: Record<'thread' | 'lesson' | 'strength', string> = {
    thread: 'Pattern',
    lesson: 'Lesson',
    strength: 'Strength',
};

const formatEmotionLabel = (emotion: string) =>
    emotion
        .split(/[_-\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const buildNextStep = (storySignal: MemoryInsightData['storySignal']) => {
    if (!storySignal) return null;

    if (storySignal.status === 'verified') {
        return 'This memory is already structured well enough to reuse in stories or applications.';
    }

    if (storySignal.status === 'ready_to_export') {
        return 'The story structure is strong. Shape it now while the details are still fresh.';
    }

    if (storySignal.status === 'ready_to_verify') {
        return 'Give this one quick review before you reuse it as story evidence.';
    }

    if (storySignal.missingFields.length === 0) {
        return 'Add one more concrete detail so this memory is easier to reuse later.';
    }

    const missingSummary = storySignal.missingFields
        .slice(0, 2)
        .map((field) => storyFieldLabel[field].toLowerCase())
        .join(' and ');

    return `Add ${missingSummary} to turn this note into a stronger, reusable story.`;
};

export default function MemoryInsightStrip({
    analysisLine,
    takeawayLine,
    notiveInsights,
    topEmotions,
    depthLabel,
    growthRatio,
    storySignal,
    className,
    label = 'What stands out',
    description,
}: MemoryInsightStripProps) {
    const trimmedAnalysisLine = analysisLine?.trim();
    const trimmedTakeawayLine = takeawayLine?.trim();
    const visibleInsights = (notiveInsights || [])
        .filter((insight) => insight?.text?.trim())
        .slice(0, 2);
    const visibleTopEmotions = (topEmotions || [])
        .filter((emotion) => emotion?.emotion?.trim())
        .slice(0, 3);
    const nextStep = buildNextStep(storySignal);

    const hasContent = Boolean(
        trimmedAnalysisLine
        || trimmedTakeawayLine
        || visibleInsights.length > 0
        || visibleTopEmotions.length > 0
        || depthLabel
        || typeof growthRatio === 'number'
        || storySignal
    );

    if (!hasContent) return null;

    return (
        <AppPanel tone="soft" className={cn('space-y-4', className)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</p>
                    {description && (
                        <p className="text-sm text-ink-secondary">{description}</p>
                    )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {storySignal && (
                        <>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${storyStatusClassName[storySignal.status]}`}>
                                {storyStatusLabel[storySignal.status]}
                            </span>
                            <TagPill>{storySignal.completenessScore}% ready</TagPill>
                            <TagPill>{formatStoryConfidence(storySignal.confidence)} confidence</TagPill>
                        </>
                    )}
                    {depthLabel && <TagPill tone="muted">{depthLabel}</TagPill>}
                    {typeof growthRatio === 'number' && growthRatio > 0 && (
                        <TagPill tone="muted">{growthRatio}% growth language</TagPill>
                    )}
                </div>
            </div>

            {(trimmedAnalysisLine || trimmedTakeawayLine) && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {trimmedAnalysisLine && (
                        <div className="rounded-xl border border-[rgba(141,123,105,0.16)] bg-[rgba(255,255,255,0.02)] px-3.5 py-3">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary/70">Noticed</p>
                            <p className="mt-1 text-sm leading-6 text-[rgb(var(--text-primary))]">{trimmedAnalysisLine}</p>
                        </div>
                    )}
                    {trimmedTakeawayLine && (
                        <div className="rounded-xl border border-[rgba(141,123,105,0.16)] bg-[rgba(255,255,255,0.02)] px-3.5 py-3">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-accent/80">Carry forward</p>
                            <p className="mt-1 text-sm leading-6 text-[rgb(var(--text-primary))]">{trimmedTakeawayLine}</p>
                        </div>
                    )}
                </div>
            )}

            {visibleInsights.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Notive noticed</p>
                    <div className="space-y-2">
                        {visibleInsights.map((insight, index) => (
                            <div key={`${insight.type}-${index}`} className="flex items-start gap-2 rounded-xl border border-[rgba(141,123,105,0.12)] px-3 py-2.5">
                                <span className="mt-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                                    {insightTypeLabel[insight.type]}
                                </span>
                                <p className="text-sm leading-6 text-ink-secondary">{insight.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {visibleTopEmotions.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Emotion cues</p>
                    <div className="flex flex-wrap gap-2">
                        {visibleTopEmotions.map((emotion) => (
                            <TagPill key={emotion.emotion} tone="primary">
                                {formatEmotionLabel(emotion.emotion)}
                            </TagPill>
                        ))}
                    </div>
                </div>
            )}

            {nextStep && (
                <div className="rounded-xl border border-[rgba(141,123,105,0.16)] bg-[rgba(255,255,255,0.02)] px-3.5 py-3">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">Next step</p>
                    <p className="mt-1 text-sm leading-6 text-[rgb(var(--text-primary))]">{nextStep}</p>
                </div>
            )}
        </AppPanel>
    );
}
