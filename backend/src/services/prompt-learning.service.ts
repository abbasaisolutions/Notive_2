import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

export type PromptLens = 'clarity' | 'memory' | 'growth' | 'productivity';

export type WeightedOutcomeCounter = {
    shown: number;
    accepted: number;
    dismissed: number;
};

export interface PromptBehaviorStat {
    shown: number;
    accepted: number;
    dismissed: number;
    ignored: number;
    acceptanceProbability: number;
    confidence: number;
    expectedUtility: number;
    explorationBonus: number;
}

export interface PromptBehaviorProfile {
    generatedAt: string;
    rangeDays: number;
    lensBoosts: Partial<Record<PromptLens, number>>;
    signalBoosts: Record<string, number>;
    metricBoosts: Record<string, number>;
    categoryBoosts: Record<string, number>;
    lensStats: Partial<Record<PromptLens, PromptBehaviorStat>>;
    signalStats: Record<string, PromptBehaviorStat>;
    metricStats: Record<string, PromptBehaviorStat>;
    categoryStats: Record<string, PromptBehaviorStat>;
}

export interface PromptEventDimensions {
    lens: string | null;
    signalKind: string | null;
    metric: string | null;
    category: string | null;
    promptInstanceId: string | null;
}

const DEFAULT_LOOKBACK_DAYS = 120;
const MAX_LOOKBACK_DAYS = 180;
const HALF_LIFE_DAYS = 21;
const ACCEPTANCE_PRIOR = 1.6;
const DISMISSAL_PRIOR = 1.2;
const IGNORE_PRIOR = 2.4;
const ACCEPTANCE_UTILITY_WEIGHT = 2.4;
const DISMISSAL_UTILITY_WEIGHT = 1.6;
const IGNORE_UTILITY_WEIGHT = 0.4;
const BEHAVIOR_SCORE_SCALE = 4;
const CONFIDENCE_CURVE = 4;
const EXPLORATION_SCALE = 5;
const MAX_EXPLORATION_BONUS = 2.5;
const SMART_PROMPT_EVENT_TYPES = [
    'SMART_PROMPT_SHOWN',
    'SMART_PROMPT_ACCEPTED',
    'SMART_PROMPT_DISMISSED',
] as const;

const clampLookbackDays = (value: number): number => {
    if (!Number.isFinite(value)) {
        return DEFAULT_LOOKBACK_DAYS;
    }

    return Math.max(14, Math.min(MAX_LOOKBACK_DAYS, Math.floor(value)));
};

export const normalizePromptLearningKey = (value: string | null | undefined, maxLength = 80): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized ? normalized.slice(0, maxLength) : null;
};

const roundScore = (value: number): number => Math.round(value * 10) / 10;
const roundMetric = (value: number): number => Math.round(value * 1000) / 1000;

const isPromptLens = (value: string): value is PromptLens =>
    value === 'clarity' || value === 'memory' || value === 'growth' || value === 'productivity';

const asRecord = (value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, Prisma.JsonValue>)
        : null;

export const extractPromptEventDimensions = (input: {
    field?: string | null;
    value?: string | null;
    metadata?: Prisma.JsonValue | null;
}): PromptEventDimensions => {
    const metadata = asRecord(input.metadata);

    return {
        lens: normalizePromptLearningKey(
            typeof metadata?.lens === 'string'
                ? metadata.lens
                : input.field
        ),
        signalKind: normalizePromptLearningKey(
            typeof metadata?.signalKind === 'string'
                ? metadata.signalKind
                : input.value
        ),
        metric: normalizePromptLearningKey(
            typeof metadata?.metric === 'string'
                ? metadata.metric
                : null
        ),
        category: normalizePromptLearningKey(
            typeof metadata?.category === 'string'
                ? metadata.category
                : null
        ),
        promptInstanceId: normalizePromptLearningKey(
            typeof metadata?.promptInstanceId === 'string'
                ? metadata.promptInstanceId
                : null,
            120
        ),
    };
};

export const createPromptOutcomeCounter = (): WeightedOutcomeCounter => ({
    shown: 0,
    accepted: 0,
    dismissed: 0,
});

export const updatePromptOutcomeCounter = (
    counters: Record<string, WeightedOutcomeCounter>,
    key: string | null,
    eventType: typeof SMART_PROMPT_EVENT_TYPES[number],
    weight: number
): void => {
    if (!key) {
        return;
    }

    const counter = counters[key] || createPromptOutcomeCounter();
    if (eventType === 'SMART_PROMPT_SHOWN') {
        counter.shown += weight;
    } else if (eventType === 'SMART_PROMPT_ACCEPTED') {
        counter.accepted += weight;
    } else if (eventType === 'SMART_PROMPT_DISMISSED') {
        counter.dismissed += weight;
    }

    counters[key] = counter;
};

export const getPromptLearningDecayWeight = (occurredAt: Date, now: Date): number => {
    const ageMs = Math.max(0, now.getTime() - occurredAt.getTime());
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
};

const getShownCount = (counter: WeightedOutcomeCounter | undefined): number =>
    counter ? Math.max(counter.shown, counter.accepted + counter.dismissed) : 0;

const getIgnoredCount = (counter: WeightedOutcomeCounter | undefined): number =>
    Math.max(0, getShownCount(counter) - (counter?.accepted || 0) - (counter?.dismissed || 0));

const getBehaviorConfidence = (shown: number): number =>
    shown <= 0 ? 0 : 1 - Math.exp(-shown / CONFIDENCE_CURVE);

const getExpectedUtility = (counter: WeightedOutcomeCounter | undefined): number => {
    if (!counter) {
        return 0;
    }

    const shown = getShownCount(counter);
    if (shown <= 0) {
        return 0;
    }

    const ignored = getIgnoredCount(counter);
    const posteriorAccept = counter.accepted + ACCEPTANCE_PRIOR;
    const posteriorDismiss = counter.dismissed + DISMISSAL_PRIOR;
    const posteriorIgnore = ignored + IGNORE_PRIOR;
    const posteriorTotal = posteriorAccept + posteriorDismiss + posteriorIgnore;

    const pAccept = posteriorAccept / posteriorTotal;
    const pDismiss = posteriorDismiss / posteriorTotal;
    const pIgnore = posteriorIgnore / posteriorTotal;
    return (
        (pAccept * ACCEPTANCE_UTILITY_WEIGHT) -
        (pDismiss * DISMISSAL_UTILITY_WEIGHT) -
        (pIgnore * IGNORE_UTILITY_WEIGHT)
    );
};

const getAcceptanceDistribution = (counter: WeightedOutcomeCounter | undefined): {
    acceptanceProbability: number;
    standardDeviation: number;
} => {
    const accepted = counter?.accepted || 0;
    const dismissed = counter?.dismissed || 0;
    const ignored = getIgnoredCount(counter);
    const alpha = accepted + ACCEPTANCE_PRIOR;
    const beta = dismissed + ignored + DISMISSAL_PRIOR + IGNORE_PRIOR;
    const total = alpha + beta;
    const mean = total > 0 ? alpha / total : 0;
    const variance = total > 1
        ? (alpha * beta) / ((total * total) * (total + 1))
        : 0;

    return {
        acceptanceProbability: mean,
        standardDeviation: Math.sqrt(Math.max(0, variance)),
    };
};

export const computePromptBehaviorBoost = (counter: WeightedOutcomeCounter | undefined): number => {
    const shown = getShownCount(counter);
    if (shown <= 0) {
        return 0;
    }

    const confidence = getBehaviorConfidence(shown);
    const expectedUtility = getExpectedUtility(counter);
    return roundScore(expectedUtility * BEHAVIOR_SCORE_SCALE * confidence);
};

export const summarizePromptBehaviorCounter = (
    counter: WeightedOutcomeCounter | undefined
): PromptBehaviorStat | null => {
    const shown = getShownCount(counter);
    if (shown <= 0) {
        return null;
    }

    const accepted = counter?.accepted || 0;
    const dismissed = counter?.dismissed || 0;
    const ignored = getIgnoredCount(counter);
    const confidence = getBehaviorConfidence(shown);
    const expectedUtility = getExpectedUtility(counter);
    const { acceptanceProbability, standardDeviation } = getAcceptanceDistribution(counter);
    const explorationBonus = Math.min(
        MAX_EXPLORATION_BONUS,
        standardDeviation * EXPLORATION_SCALE * (1.2 + ((1 - confidence) * 1.8))
    );

    return {
        shown: roundMetric(shown),
        accepted: roundMetric(accepted),
        dismissed: roundMetric(dismissed),
        ignored: roundMetric(ignored),
        acceptanceProbability: roundMetric(acceptanceProbability),
        confidence: roundMetric(confidence),
        expectedUtility: roundMetric(expectedUtility),
        explorationBonus: roundMetric(explorationBonus),
    };
};

const toBoostMap = (counters: Record<string, WeightedOutcomeCounter>): Record<string, number> =>
    Object.entries(counters).reduce<Record<string, number>>((acc, [key, counter]) => {
        const boost = computePromptBehaviorBoost(counter);
        if (boost !== 0) {
            acc[key] = boost;
        }
        return acc;
    }, {});

const toStatsMap = <TKey extends string>(
    counters: Record<string, WeightedOutcomeCounter>,
    allowKey?: (key: string) => key is TKey
): Record<string, PromptBehaviorStat> | Partial<Record<TKey, PromptBehaviorStat>> =>
    Object.entries(counters).reduce<Record<string, PromptBehaviorStat>>((acc, [key, counter]) => {
        if (allowKey && !allowKey(key)) {
            return acc;
        }

        const summary = summarizePromptBehaviorCounter(counter);
        if (summary) {
            acc[key] = summary;
        }
        return acc;
    }, {});

export const buildPromptBehaviorProfile = async (
    userId: string,
    days: number = DEFAULT_LOOKBACK_DAYS
): Promise<PromptBehaviorProfile> => {
    const rangeDays = clampLookbackDays(days);
    const since = new Date();
    since.setDate(since.getDate() - rangeDays);

    const events = await prisma.personalizationEvent.findMany({
        where: {
            userId,
            eventType: { in: [...SMART_PROMPT_EVENT_TYPES] },
            occurredAt: { gte: since },
        },
        select: {
            eventType: true,
            field: true,
            value: true,
            metadata: true,
            occurredAt: true,
        },
        orderBy: { occurredAt: 'asc' },
    });

    const now = new Date();
    const lensCounters: Record<string, WeightedOutcomeCounter> = {};
    const signalCounters: Record<string, WeightedOutcomeCounter> = {};
    const metricCounters: Record<string, WeightedOutcomeCounter> = {};
    const categoryCounters: Record<string, WeightedOutcomeCounter> = {};

    for (const event of events) {
        const { lens, signalKind, metric, category } = extractPromptEventDimensions(event);
        const weight = getPromptLearningDecayWeight(event.occurredAt, now);
        const typedEvent = event.eventType as typeof SMART_PROMPT_EVENT_TYPES[number];

        updatePromptOutcomeCounter(lensCounters, lens, typedEvent, weight);
        updatePromptOutcomeCounter(signalCounters, signalKind, typedEvent, weight);
        updatePromptOutcomeCounter(metricCounters, metric, typedEvent, weight);
        updatePromptOutcomeCounter(categoryCounters, category, typedEvent, weight);
    }

    const lensBoostCandidates = toBoostMap(lensCounters);
    const lensBoosts = Object.entries(lensBoostCandidates).reduce<Partial<Record<PromptLens, number>>>((acc, [key, boost]) => {
        if (isPromptLens(key)) {
            acc[key] = boost;
        }
        return acc;
    }, {});
    const lensStats = toStatsMap<PromptLens>(lensCounters, isPromptLens) as Partial<Record<PromptLens, PromptBehaviorStat>>;

    return {
        generatedAt: now.toISOString(),
        rangeDays,
        lensBoosts,
        signalBoosts: toBoostMap(signalCounters),
        metricBoosts: toBoostMap(metricCounters),
        categoryBoosts: toBoostMap(categoryCounters),
        lensStats,
        signalStats: toStatsMap(signalCounters) as Record<string, PromptBehaviorStat>,
        metricStats: toStatsMap(metricCounters) as Record<string, PromptBehaviorStat>,
        categoryStats: toStatsMap(categoryCounters) as Record<string, PromptBehaviorStat>,
    };
};

export default buildPromptBehaviorProfile;
