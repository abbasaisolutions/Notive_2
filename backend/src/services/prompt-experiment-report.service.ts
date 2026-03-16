import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

const DEFAULT_LOOKBACK_DAYS = 60;
const MAX_LOOKBACK_DAYS = 180;
const PROMPT_EXPERIMENT_EVENT_TYPES = [
    'SMART_PROMPT_SHOWN',
    'SMART_PROMPT_ACCEPTED',
    'SMART_PROMPT_DISMISSED',
    'PROGRESSIVE_PROMPT_SHOWN',
    'PROGRESSIVE_PROMPT_ACCEPTED',
    'PROGRESSIVE_PROMPT_DISMISSED',
] as const;

type PromptExperimentEventType = typeof PROMPT_EXPERIMENT_EVENT_TYPES[number];
type PromptExperimentSurface = 'smart_prompt' | 'progressive_prompt';
type PromptOutcome = 'accepted' | 'dismissed' | 'ignored';

interface PromptExperimentMetadata {
    experimentId: string | null;
    variant: string | null;
    promptInstanceId: string | null;
}

interface PendingExperimentImpression extends PromptExperimentMetadata {
    surface: PromptExperimentSurface;
}

interface PromptExperimentVariantTotals {
    variant: string;
    impressions: number;
    accepted: number;
    dismissed: number;
    ignored: number;
    acceptanceRate: number;
    dismissalRate: number;
    ignoreRate: number;
}

interface PromptExperimentAggregate {
    experimentId: string;
    surface: PromptExperimentSurface;
    impressions: number;
    accepted: number;
    dismissed: number;
    ignored: number;
    variants: Map<string, PromptExperimentVariantTotals>;
}

export interface PromptExperimentReportEntry {
    experimentId: string;
    surface: PromptExperimentSurface;
    impressions: number;
    accepted: number;
    dismissed: number;
    ignored: number;
    acceptanceRate: number;
    dismissalRate: number;
    ignoreRate: number;
    winningVariant: string | null;
    variants: PromptExperimentVariantTotals[];
}

export interface PromptExperimentReport {
    generatedAt: string;
    rangeDays: number;
    totalExperiments: number;
    experiments: PromptExperimentReportEntry[];
}

const clampLookbackDays = (value: number): number => {
    if (!Number.isFinite(value)) {
        return DEFAULT_LOOKBACK_DAYS;
    }

    return Math.max(14, Math.min(MAX_LOOKBACK_DAYS, Math.floor(value)));
};

const roundMetric = (value: number): number => Math.round(value * 1000) / 1000;

const asRecord = (value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, Prisma.JsonValue>)
        : null;

const normalizeValue = (value: string | null | undefined, maxLength = 120): string | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    return normalized ? normalized.slice(0, maxLength) : null;
};

const getSurface = (eventType: PromptExperimentEventType): PromptExperimentSurface =>
    eventType.startsWith('PROGRESSIVE_') ? 'progressive_prompt' : 'smart_prompt';

const getOutcome = (eventType: PromptExperimentEventType): PromptOutcome | 'shown' => {
    if (eventType.endsWith('_SHOWN')) {
        return 'shown';
    }

    if (eventType.endsWith('_ACCEPTED')) {
        return 'accepted';
    }

    return 'dismissed';
};

const extractPromptExperimentMetadata = (metadata: Prisma.JsonValue | null | undefined): PromptExperimentMetadata => {
    const source = asRecord(metadata);

    return {
        experimentId: normalizeValue(typeof source?.promptExperimentId === 'string' ? source.promptExperimentId : null),
        variant: normalizeValue(typeof source?.promptFramingVariant === 'string' ? source.promptFramingVariant : null),
        promptInstanceId: normalizeValue(typeof source?.promptInstanceId === 'string' ? source.promptInstanceId : null, 160),
    };
};

const getExperimentKey = (surface: PromptExperimentSurface, experimentId: string): string =>
    `${surface}:${experimentId}`;

const createVariantTotals = (variant: string): PromptExperimentVariantTotals => ({
    variant,
    impressions: 0,
    accepted: 0,
    dismissed: 0,
    ignored: 0,
    acceptanceRate: 0,
    dismissalRate: 0,
    ignoreRate: 0,
});

const ensureExperimentAggregate = (
    aggregates: Map<string, PromptExperimentAggregate>,
    experimentId: string,
    surface: PromptExperimentSurface
): PromptExperimentAggregate => {
    const key = getExperimentKey(surface, experimentId);
    const existing = aggregates.get(key);
    if (existing) {
        return existing;
    }

    const next: PromptExperimentAggregate = {
        experimentId,
        surface,
        impressions: 0,
        accepted: 0,
        dismissed: 0,
        ignored: 0,
        variants: new Map<string, PromptExperimentVariantTotals>(),
    };
    aggregates.set(key, next);
    return next;
};

const ensureVariantTotals = (
    aggregate: PromptExperimentAggregate,
    variant: string
): PromptExperimentVariantTotals => {
    const existing = aggregate.variants.get(variant);
    if (existing) {
        return existing;
    }

    const next = createVariantTotals(variant);
    aggregate.variants.set(variant, next);
    return next;
};

const resolvePendingImpression = (
    pendingByInstanceId: Map<string, PendingExperimentImpression>,
    pendingWithoutInstanceId: PendingExperimentImpression[],
    match: PromptExperimentMetadata,
    surface: PromptExperimentSurface
): PendingExperimentImpression | null => {
    if (match.promptInstanceId) {
        const exactMatch = pendingByInstanceId.get(match.promptInstanceId) || null;
        if (exactMatch) {
            pendingByInstanceId.delete(match.promptInstanceId);
        }
        return exactMatch;
    }

    for (let index = pendingWithoutInstanceId.length - 1; index >= 0; index -= 1) {
        const pending = pendingWithoutInstanceId[index];
        if (
            pending.surface === surface &&
            pending.experimentId === match.experimentId &&
            pending.variant === match.variant
        ) {
            const [resolved] = pendingWithoutInstanceId.splice(index, 1);
            return resolved || null;
        }
    }

    return null;
};

const finalizeVariantTotals = (variant: PromptExperimentVariantTotals): PromptExperimentVariantTotals => {
    if (variant.impressions <= 0) {
        return variant;
    }

    return {
        ...variant,
        acceptanceRate: roundMetric(variant.accepted / variant.impressions),
        dismissalRate: roundMetric(variant.dismissed / variant.impressions),
        ignoreRate: roundMetric(variant.ignored / variant.impressions),
    };
};

const finalizeExperimentAggregate = (aggregate: PromptExperimentAggregate): PromptExperimentReportEntry => {
    const variants = Array.from(aggregate.variants.values())
        .map(finalizeVariantTotals)
        .sort((left, right) => {
            if (right.acceptanceRate !== left.acceptanceRate) {
                return right.acceptanceRate - left.acceptanceRate;
            }

            return right.impressions - left.impressions;
        });

    return {
        experimentId: aggregate.experimentId,
        surface: aggregate.surface,
        impressions: aggregate.impressions,
        accepted: aggregate.accepted,
        dismissed: aggregate.dismissed,
        ignored: aggregate.ignored,
        acceptanceRate: aggregate.impressions > 0 ? roundMetric(aggregate.accepted / aggregate.impressions) : 0,
        dismissalRate: aggregate.impressions > 0 ? roundMetric(aggregate.dismissed / aggregate.impressions) : 0,
        ignoreRate: aggregate.impressions > 0 ? roundMetric(aggregate.ignored / aggregate.impressions) : 0,
        winningVariant: variants[0]?.variant || null,
        variants,
    };
};

export const buildPromptExperimentReport = async (
    userId: string,
    days: number = DEFAULT_LOOKBACK_DAYS
): Promise<PromptExperimentReport> => {
    const rangeDays = clampLookbackDays(days);
    const since = new Date();
    since.setDate(since.getDate() - rangeDays);

    const events = await prisma.personalizationEvent.findMany({
        where: {
            userId,
            eventType: { in: [...PROMPT_EXPERIMENT_EVENT_TYPES] },
            occurredAt: { gte: since },
        },
        select: {
            eventType: true,
            metadata: true,
            occurredAt: true,
            createdAt: true,
        },
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    const aggregates = new Map<string, PromptExperimentAggregate>();
    const pendingByInstanceId = new Map<string, PendingExperimentImpression>();
    const pendingWithoutInstanceId: PendingExperimentImpression[] = [];

    for (const event of events) {
        const typedEvent = event.eventType as PromptExperimentEventType;
        const surface = getSurface(typedEvent);
        const metadata = extractPromptExperimentMetadata(event.metadata);
        if (!metadata.experimentId || !metadata.variant) {
            continue;
        }

        const aggregate = ensureExperimentAggregate(aggregates, metadata.experimentId, surface);
        const variantTotals = ensureVariantTotals(aggregate, metadata.variant);
        const outcome = getOutcome(typedEvent);

        if (outcome === 'shown') {
            aggregate.impressions += 1;
            variantTotals.impressions += 1;

            const pending: PendingExperimentImpression = {
                ...metadata,
                surface,
            };

            if (metadata.promptInstanceId) {
                pendingByInstanceId.set(metadata.promptInstanceId, pending);
            } else {
                pendingWithoutInstanceId.push(pending);
            }
            continue;
        }

        const resolved = resolvePendingImpression(pendingByInstanceId, pendingWithoutInstanceId, metadata, surface);
        if (!resolved?.experimentId || !resolved.variant) {
            continue;
        }

        const resolvedAggregate = ensureExperimentAggregate(aggregates, resolved.experimentId, resolved.surface);
        const resolvedVariant = ensureVariantTotals(resolvedAggregate, resolved.variant);
        if (outcome === 'accepted') {
            resolvedAggregate.accepted += 1;
            resolvedVariant.accepted += 1;
        } else {
            resolvedAggregate.dismissed += 1;
            resolvedVariant.dismissed += 1;
        }
    }

    for (const pending of pendingWithoutInstanceId) {
        if (!pending.experimentId || !pending.variant) {
            continue;
        }

        const aggregate = ensureExperimentAggregate(aggregates, pending.experimentId, pending.surface);
        const variant = ensureVariantTotals(aggregate, pending.variant);
        aggregate.ignored += 1;
        variant.ignored += 1;
    }

    for (const pending of pendingByInstanceId.values()) {
        if (!pending.experimentId || !pending.variant) {
            continue;
        }

        const aggregate = ensureExperimentAggregate(aggregates, pending.experimentId, pending.surface);
        const variant = ensureVariantTotals(aggregate, pending.variant);
        aggregate.ignored += 1;
        variant.ignored += 1;
    }

    const experiments = Array.from(aggregates.values())
        .map(finalizeExperimentAggregate)
        .sort((left, right) => {
            if (right.acceptanceRate !== left.acceptanceRate) {
                return right.acceptanceRate - left.acceptanceRate;
            }

            return right.impressions - left.impressions;
        });

    return {
        generatedAt: new Date().toISOString(),
        rangeDays,
        totalExperiments: experiments.length,
        experiments,
    };
};

export default buildPromptExperimentReport;
