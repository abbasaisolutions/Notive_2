import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import {
    extractPromptEventDimensions,
    type PromptEventDimensions,
} from './prompt-learning.service';
import type {
    PromptLearningPolicy,
    PromptBehaviorProfileWithPolicy,
} from './prompt-learning-policy.service';
import type { PromptModelName } from './prompt-learning-evaluation.service';

const SNAPSHOT_EVENT_TYPE = 'PROMPT_POLICY_SNAPSHOT';
const SMART_PROMPT_EVENT_TYPES = [
    'SMART_PROMPT_SHOWN',
    'SMART_PROMPT_ACCEPTED',
    'SMART_PROMPT_DISMISSED',
] as const;
const DEFAULT_RANGE_DAYS = 60;
const MAX_RANGE_DAYS = 180;
const TREND_WINDOW_DAYS = 7;

type PromptOutcome = 'accepted' | 'dismissed' | 'ignored';
type PromptTelemetryEventType = typeof SMART_PROMPT_EVENT_TYPES[number];

interface PromptPolicySnapshotMetadata {
    profileGeneratedAt: string;
    rangeDays: number;
    recommendedModel: PromptModelName | null;
    policy: PromptLearningPolicy;
    behaviorCoverage: {
        lensCount: number;
        signalCount: number;
        metricCount: number;
        categoryCount: number;
    };
}

interface PromptPolicySnapshotRecord {
    id: string;
    snapshotDate: string;
    occurredAt: Date;
    recommendedModel: PromptModelName | null;
    policy: PromptLearningPolicy;
}

interface PendingPromptImpression extends PromptEventDimensions {
    snapshotId: string;
    shownAt: Date;
}

export interface PromptPolicySnapshotPerformance {
    snapshotDate: string;
    occurredAt: string;
    recommendedModel: PromptModelName | null;
    explorationScale: number | null;
    behaviorScale: number | null;
    calibrationGain: number | null;
    impressions: number;
    accepted: number;
    dismissed: number;
    ignored: number;
    acceptanceRate: number;
    dismissalRate: number;
    ignoreRate: number;
}

export interface PromptPolicyModelSummary {
    model: PromptModelName | 'unknown';
    snapshots: number;
    impressions: number;
    acceptanceRate: number;
    averageExplorationScale: number;
    averageBehaviorScale: number;
}

export interface PromptPolicyTrendSummary {
    windowDays: number;
    currentImpressions: number;
    previousImpressions: number;
    currentAcceptanceRate: number;
    previousAcceptanceRate: number;
    deltaAcceptanceRate: number;
    trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
}

export interface PromptLearningPolicyPerformanceReport {
    generatedAt: string;
    rangeDays: number;
    totalSnapshots: number;
    snapshots: PromptPolicySnapshotPerformance[];
    modelSummaries: PromptPolicyModelSummary[];
    trend: PromptPolicyTrendSummary;
}

const clampRangeDays = (value: number): number => {
    if (!Number.isFinite(value)) {
        return DEFAULT_RANGE_DAYS;
    }

    return Math.max(14, Math.min(MAX_RANGE_DAYS, Math.floor(value)));
};

const roundMetric = (value: number): number => Math.round(value * 1000) / 1000;

const createFingerprint = (userId: string, snapshotDate: string): string =>
    createHash('sha256')
        .update(JSON.stringify({ userId, eventType: SNAPSHOT_EVENT_TYPE, snapshotDate }))
        .digest('hex');

const asRecord = (value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, Prisma.JsonValue>)
        : null;

const toNumeric = (value: Prisma.JsonValue | undefined): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

const parsePolicy = (value: Prisma.JsonValue | undefined): PromptLearningPolicy | null => {
    const source = asRecord(value);
    if (!source) {
        return null;
    }

    const explorationWeights = asRecord(source.explorationWeights);
    const behaviorWeights = asRecord(source.behaviorWeights);

    return {
        generatedAt: typeof source.generatedAt === 'string' ? source.generatedAt : new Date().toISOString(),
        rangeDays: typeof source.rangeDays === 'number' && Number.isFinite(source.rangeDays)
            ? Math.max(0, Math.floor(source.rangeDays))
            : DEFAULT_RANGE_DAYS,
        recommendedModel:
            source.recommendedModel === 'prior_only' ||
            source.recommendedModel === 'empirical_blend' ||
            source.recommendedModel === 'bayesian_decay_blend' ||
            source.recommendedModel === null
                ? source.recommendedModel
                : null,
        impressions: typeof source.impressions === 'number' && Number.isFinite(source.impressions)
            ? Math.max(0, Math.floor(source.impressions))
            : 0,
        calibrationGain: toNumeric(source.calibrationGain) ?? 0,
        sampleScarcity: toNumeric(source.sampleScarcity) ?? 0,
        explorationScale: toNumeric(source.explorationScale) ?? 0.4,
        behaviorScale: toNumeric(source.behaviorScale) ?? 0.85,
        explorationWeights: {
            signal: toNumeric(explorationWeights?.signal) ?? 0.8,
            metric: toNumeric(explorationWeights?.metric) ?? 0.45,
            lens: toNumeric(explorationWeights?.lens) ?? 0.55,
            category: toNumeric(explorationWeights?.category) ?? 0.7,
        },
        behaviorWeights: {
            signal: toNumeric(behaviorWeights?.signal) ?? 1,
            metric: toNumeric(behaviorWeights?.metric) ?? 1,
            lens: toNumeric(behaviorWeights?.lens) ?? 1,
            category: toNumeric(behaviorWeights?.category) ?? 0.45,
        },
    };
};

const getFallbackMatchScore = (
    pending: PendingPromptImpression,
    dimensions: PromptEventDimensions
): number => {
    let score = 0;

    if (pending.category && dimensions.category && pending.category === dimensions.category) {
        score += 4;
    }
    if (pending.signalKind && dimensions.signalKind && pending.signalKind === dimensions.signalKind) {
        score += 3;
    }
    if (pending.metric && dimensions.metric && pending.metric === dimensions.metric) {
        score += 2;
    }
    if (pending.lens && dimensions.lens && pending.lens === dimensions.lens) {
        score += 1;
    }

    return score;
};

const createSnapshotMetadata = (profile: PromptBehaviorProfileWithPolicy): PromptPolicySnapshotMetadata => ({
    profileGeneratedAt: profile.generatedAt || profile.policy.generatedAt || new Date().toISOString(),
    rangeDays: profile.rangeDays || profile.policy.rangeDays || DEFAULT_RANGE_DAYS,
    recommendedModel: profile.policy.recommendedModel || null,
    policy: profile.policy,
    behaviorCoverage: {
        lensCount: Object.keys(profile.lensStats).length,
        signalCount: Object.keys(profile.signalStats).length,
        metricCount: Object.keys(profile.metricStats).length,
        categoryCount: Object.keys(profile.categoryStats).length,
    },
});

export const persistPromptLearningPolicySnapshot = async (
    userId: string,
    profile: PromptBehaviorProfileWithPolicy
): Promise<void> => {
    const snapshotTime = new Date(profile.policy.generatedAt || profile.generatedAt || new Date().toISOString());
    const snapshotDate = snapshotTime.toISOString().slice(0, 10);
    const metadata = createSnapshotMetadata(profile);
    const fingerprint = createFingerprint(userId, snapshotDate);

    const existing = await prisma.personalizationEvent.findFirst({
        where: {
            userId,
            eventType: SNAPSHOT_EVENT_TYPE,
            value: snapshotDate,
        },
        select: {
            id: true,
        },
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    if (existing) {
        await prisma.personalizationEvent.update({
            where: { id: existing.id },
            data: {
                field: profile.policy.recommendedModel || 'unknown',
                pathname: '/analytics/prompt-learning',
                metadata: metadata as unknown as Prisma.JsonObject,
            },
        });
        return;
    }

    try {
        await prisma.personalizationEvent.create({
            data: {
                userId,
                eventType: SNAPSHOT_EVENT_TYPE,
                field: profile.policy.recommendedModel || 'unknown',
                value: snapshotDate,
                pathname: '/analytics/prompt-learning',
                metadata: metadata as unknown as Prisma.JsonObject,
                occurredAt: snapshotTime,
                fingerprint,
            },
        });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return;
        }

        throw error;
    }
};

const parseSnapshotRecord = (event: {
    id: string;
    value: string | null;
    field: string | null;
    metadata: Prisma.JsonValue | null;
    occurredAt: Date;
}): PromptPolicySnapshotRecord | null => {
    const metadata = asRecord(event.metadata);
    const policy = parsePolicy(metadata?.policy);
    if (!policy) {
        return null;
    }

    const fallbackModel = event.field === 'prior_only' || event.field === 'empirical_blend' || event.field === 'bayesian_decay_blend'
        ? event.field
        : null;

    return {
        id: event.id,
        snapshotDate: event.value || event.occurredAt.toISOString().slice(0, 10),
        occurredAt: event.occurredAt,
        recommendedModel: policy.recommendedModel || fallbackModel,
        policy,
    };
};

const finalizeSnapshotPerformance = (snapshot: PromptPolicySnapshotPerformance): PromptPolicySnapshotPerformance => {
    if (snapshot.impressions <= 0) {
        return snapshot;
    }

    return {
        ...snapshot,
        acceptanceRate: roundMetric(snapshot.accepted / snapshot.impressions),
        dismissalRate: roundMetric(snapshot.dismissed / snapshot.impressions),
        ignoreRate: roundMetric(snapshot.ignored / snapshot.impressions),
    };
};

const resolvePendingPrompt = (
    pendingByInstanceId: Map<string, PendingPromptImpression>,
    pendingWithoutInstanceId: PendingPromptImpression[],
    dimensions: PromptEventDimensions
): PendingPromptImpression | null => {
    if (dimensions.promptInstanceId) {
        const exactMatch = pendingByInstanceId.get(dimensions.promptInstanceId) || null;
        if (exactMatch) {
            pendingByInstanceId.delete(dimensions.promptInstanceId);
        }
        return exactMatch;
    }

    let bestIndex = -1;
    let bestScore = 0;
    for (let index = pendingWithoutInstanceId.length - 1; index >= 0; index -= 1) {
        const score = getFallbackMatchScore(pendingWithoutInstanceId[index], dimensions);
        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
            if (score >= 10) {
                break;
            }
        }
    }

    if (bestIndex >= 0) {
        const [match] = pendingWithoutInstanceId.splice(bestIndex, 1);
        return match || null;
    }

    return pendingWithoutInstanceId.pop() || null;
};

const buildTrendSummary = (
    snapshots: PromptPolicySnapshotPerformance[],
    now: Date
): PromptPolicyTrendSummary => {
    const currentThreshold = new Date(now);
    currentThreshold.setDate(currentThreshold.getDate() - TREND_WINDOW_DAYS);
    const previousThreshold = new Date(now);
    previousThreshold.setDate(previousThreshold.getDate() - (TREND_WINDOW_DAYS * 2));

    const aggregate = (items: PromptPolicySnapshotPerformance[]) => {
        const impressions = items.reduce((sum, item) => sum + item.impressions, 0);
        const accepted = items.reduce((sum, item) => sum + item.accepted, 0);
        return {
            impressions,
            acceptanceRate: impressions > 0 ? accepted / impressions : 0,
        };
    };

    const current = aggregate(snapshots.filter((snapshot) => new Date(snapshot.occurredAt) >= currentThreshold));
    const previous = aggregate(
        snapshots.filter((snapshot) => {
            const occurredAt = new Date(snapshot.occurredAt);
            return occurredAt >= previousThreshold && occurredAt < currentThreshold;
        })
    );
    const delta = current.acceptanceRate - previous.acceptanceRate;

    return {
        windowDays: TREND_WINDOW_DAYS,
        currentImpressions: current.impressions,
        previousImpressions: previous.impressions,
        currentAcceptanceRate: roundMetric(current.acceptanceRate),
        previousAcceptanceRate: roundMetric(previous.acceptanceRate),
        deltaAcceptanceRate: roundMetric(delta),
        trend:
            current.impressions === 0 || previous.impressions === 0
                ? 'insufficient_data'
                : delta >= 0.03
                    ? 'improving'
                    : delta <= -0.03
                        ? 'declining'
                        : 'stable',
    };
};

export const buildPromptLearningPolicyPerformanceReport = async (
    userId: string,
    days: number = DEFAULT_RANGE_DAYS
): Promise<PromptLearningPolicyPerformanceReport> => {
    const rangeDays = clampRangeDays(days);
    const since = new Date();
    since.setDate(since.getDate() - rangeDays);

    const snapshotEvents = await prisma.personalizationEvent.findMany({
        where: {
            userId,
            eventType: SNAPSHOT_EVENT_TYPE,
            occurredAt: { gte: since },
        },
        select: {
            id: true,
            field: true,
            value: true,
            metadata: true,
            occurredAt: true,
            createdAt: true,
        },
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    const snapshots = snapshotEvents
        .map(parseSnapshotRecord)
        .filter((snapshot): snapshot is PromptPolicySnapshotRecord => snapshot !== null);

    if (snapshots.length === 0) {
        return {
            generatedAt: new Date().toISOString(),
            rangeDays,
            totalSnapshots: 0,
            snapshots: [],
            modelSummaries: [],
            trend: {
                windowDays: TREND_WINDOW_DAYS,
                currentImpressions: 0,
                previousImpressions: 0,
                currentAcceptanceRate: 0,
                previousAcceptanceRate: 0,
                deltaAcceptanceRate: 0,
                trend: 'insufficient_data',
            },
        };
    }

    const promptEvents = await prisma.personalizationEvent.findMany({
        where: {
            userId,
            eventType: { in: [...SMART_PROMPT_EVENT_TYPES] },
            occurredAt: { gte: snapshots[0].occurredAt },
        },
        select: {
            eventType: true,
            field: true,
            value: true,
            metadata: true,
            occurredAt: true,
            createdAt: true,
        },
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    const performanceMap = new Map<string, PromptPolicySnapshotPerformance>(
        snapshots.map((snapshot) => [
            snapshot.id,
            {
                snapshotDate: snapshot.snapshotDate,
                occurredAt: snapshot.occurredAt.toISOString(),
                recommendedModel: snapshot.recommendedModel,
                explorationScale: snapshot.policy.explorationScale ?? null,
                behaviorScale: snapshot.policy.behaviorScale ?? null,
                calibrationGain: snapshot.policy.calibrationGain ?? null,
                impressions: 0,
                accepted: 0,
                dismissed: 0,
                ignored: 0,
                acceptanceRate: 0,
                dismissalRate: 0,
                ignoreRate: 0,
            },
        ])
    );

    let snapshotIndex = -1;
    const pendingByInstanceId = new Map<string, PendingPromptImpression>();
    const pendingWithoutInstanceId: PendingPromptImpression[] = [];

    for (const event of promptEvents) {
        const eventType = event.eventType as PromptTelemetryEventType;
        const dimensions = extractPromptEventDimensions(event);

        if (eventType === 'SMART_PROMPT_SHOWN') {
            while (
                snapshotIndex + 1 < snapshots.length &&
                snapshots[snapshotIndex + 1].occurredAt <= event.occurredAt
            ) {
                snapshotIndex += 1;
            }

            if (snapshotIndex < 0) {
                continue;
            }

            const snapshot = snapshots[snapshotIndex];
            const performance = performanceMap.get(snapshot.id);
            if (!performance) {
                continue;
            }

            const pending: PendingPromptImpression = {
                ...dimensions,
                snapshotId: snapshot.id,
                shownAt: event.occurredAt,
            };

            performance.impressions += 1;
            if (dimensions.promptInstanceId) {
                pendingByInstanceId.set(dimensions.promptInstanceId, pending);
            } else {
                pendingWithoutInstanceId.push(pending);
            }
            continue;
        }

        const pending = resolvePendingPrompt(pendingByInstanceId, pendingWithoutInstanceId, dimensions);
        if (!pending) {
            continue;
        }

        const performance = performanceMap.get(pending.snapshotId);
        if (!performance) {
            continue;
        }

        if (eventType === 'SMART_PROMPT_ACCEPTED') {
            performance.accepted += 1;
        } else if (eventType === 'SMART_PROMPT_DISMISSED') {
            performance.dismissed += 1;
        }
    }

    for (const pending of pendingWithoutInstanceId) {
        const performance = performanceMap.get(pending.snapshotId);
        if (performance) {
            performance.ignored += 1;
        }
    }
    for (const pending of pendingByInstanceId.values()) {
        const performance = performanceMap.get(pending.snapshotId);
        if (performance) {
            performance.ignored += 1;
        }
    }

    const performance = snapshots
        .map((snapshot) => finalizeSnapshotPerformance(performanceMap.get(snapshot.id)!))
        .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

    const modelSummaryMap = new Map<PromptModelName | 'unknown', PromptPolicyModelSummary>();
    for (const snapshot of performance) {
        const model = snapshot.recommendedModel || 'unknown';
        const current = modelSummaryMap.get(model) || {
            model,
            snapshots: 0,
            impressions: 0,
            acceptanceRate: 0,
            averageExplorationScale: 0,
            averageBehaviorScale: 0,
        };

        current.snapshots += 1;
        current.impressions += snapshot.impressions;
        current.acceptanceRate += snapshot.accepted;
        current.averageExplorationScale += snapshot.explorationScale || 0;
        current.averageBehaviorScale += snapshot.behaviorScale || 0;
        modelSummaryMap.set(model, current);
    }

    const modelSummaries = Array.from(modelSummaryMap.values())
        .map((summary) => ({
            ...summary,
            acceptanceRate: summary.impressions > 0 ? roundMetric(summary.acceptanceRate / summary.impressions) : 0,
            averageExplorationScale: roundMetric(summary.averageExplorationScale / summary.snapshots),
            averageBehaviorScale: roundMetric(summary.averageBehaviorScale / summary.snapshots),
        }))
        .sort((left, right) => {
            if (right.acceptanceRate !== left.acceptanceRate) {
                return right.acceptanceRate - left.acceptanceRate;
            }

            return right.impressions - left.impressions;
        });

    return {
        generatedAt: new Date().toISOString(),
        rangeDays,
        totalSnapshots: performance.length,
        snapshots: performance,
        modelSummaries,
        trend: buildTrendSummary(performance, new Date()),
    };
};

export default buildPromptLearningPolicyPerformanceReport;
