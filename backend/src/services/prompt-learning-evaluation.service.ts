import prisma from '../config/prisma';
import {
    createPromptOutcomeCounter,
    extractPromptEventDimensions,
    getPromptLearningDecayWeight,
    type PromptEventDimensions,
    type WeightedOutcomeCounter,
} from './prompt-learning.service';

type PromptOutcome = 'accepted' | 'dismissed' | 'ignored';
export type PromptModelName = 'prior_only' | 'empirical_blend' | 'bayesian_decay_blend';
type PromptTelemetryEventType = 'SMART_PROMPT_SHOWN' | 'SMART_PROMPT_ACCEPTED' | 'SMART_PROMPT_DISMISSED';

interface PromptCounterState {
    lastUpdatedAt: Date | null;
    global: WeightedOutcomeCounter;
    lenses: Record<string, WeightedOutcomeCounter>;
    signals: Record<string, WeightedOutcomeCounter>;
    metrics: Record<string, WeightedOutcomeCounter>;
    categories: Record<string, WeightedOutcomeCounter>;
}

interface PendingPromptImpression extends PromptEventDimensions {
    shownAt: Date;
    predictedAcceptByModel: Record<PromptModelName, number>;
}

export interface PromptModelEvaluation {
    model: PromptModelName;
    impressions: number;
    accepted: number;
    dismissed: number;
    ignored: number;
    acceptanceRate: number;
    averagePredictedAcceptance: number;
    brierScore: number;
    logLoss: number;
}

export interface PromptLearningEvaluationReport {
    generatedAt: string;
    rangeDays: number;
    impressions: number;
    recommendedModel: PromptModelName | null;
    models: PromptModelEvaluation[];
}

const DEFAULT_LOOKBACK_DAYS = 120;
const MAX_LOOKBACK_DAYS = 180;
const ACCEPTANCE_PRIOR = 1.6;
const DISMISSAL_PRIOR = 1.2;
const IGNORE_PRIOR = 2.4;
const MIN_PROBABILITY = 0.0001;
const GLOBAL_ACCEPTANCE_PRIOR = ACCEPTANCE_PRIOR / (ACCEPTANCE_PRIOR + DISMISSAL_PRIOR + IGNORE_PRIOR);
const FEATURE_WEIGHTS = {
    category: 0.34,
    signal: 0.24,
    lens: 0.18,
    metric: 0.12,
    global: 0.12,
};

const clampLookbackDays = (value: number): number => {
    if (!Number.isFinite(value)) {
        return DEFAULT_LOOKBACK_DAYS;
    }

    return Math.max(14, Math.min(MAX_LOOKBACK_DAYS, Math.floor(value)));
};

const createCounterState = (): PromptCounterState => ({
    lastUpdatedAt: null,
    global: createPromptOutcomeCounter(),
    lenses: {},
    signals: {},
    metrics: {},
    categories: {},
});

const getShownCount = (counter: WeightedOutcomeCounter | undefined): number =>
    counter ? Math.max(counter.shown, counter.accepted + counter.dismissed) : 0;

const getPosteriorAcceptProbability = (counter: WeightedOutcomeCounter | undefined): number => {
    const shown = getShownCount(counter);
    const accepted = counter?.accepted || 0;
    const dismissed = counter?.dismissed || 0;
    const ignored = Math.max(0, shown - accepted - dismissed);
    const posteriorAccept = accepted + ACCEPTANCE_PRIOR;
    const posteriorDismiss = dismissed + DISMISSAL_PRIOR;
    const posteriorIgnore = ignored + IGNORE_PRIOR;
    return posteriorAccept / (posteriorAccept + posteriorDismiss + posteriorIgnore);
};

const getEmpiricalAcceptProbability = (counter: WeightedOutcomeCounter | undefined): number | null => {
    const shown = getShownCount(counter);
    if (shown <= 0) {
        return null;
    }

    return (counter?.accepted || 0) / shown;
};

const getConfidence = (shown: number): number =>
    shown <= 0 ? 0 : 1 - Math.exp(-shown / 4);

const decayCounter = (counter: WeightedOutcomeCounter, factor: number): WeightedOutcomeCounter => ({
    shown: counter.shown * factor,
    accepted: counter.accepted * factor,
    dismissed: counter.dismissed * factor,
});

const applyDecayToCounterMap = (counters: Record<string, WeightedOutcomeCounter>, factor: number): void => {
    Object.entries(counters).forEach(([key, counter]) => {
        const next = decayCounter(counter, factor);
        if (next.shown < 0.001 && next.accepted < 0.001 && next.dismissed < 0.001) {
            delete counters[key];
            return;
        }

        counters[key] = next;
    });
};

const applyDecay = (state: PromptCounterState, currentTime: Date): void => {
    if (!state.lastUpdatedAt) {
        state.lastUpdatedAt = currentTime;
        return;
    }

    const factor = getPromptLearningDecayWeight(state.lastUpdatedAt, currentTime);
    state.global = decayCounter(state.global, factor);
    applyDecayToCounterMap(state.lenses, factor);
    applyDecayToCounterMap(state.signals, factor);
    applyDecayToCounterMap(state.metrics, factor);
    applyDecayToCounterMap(state.categories, factor);
    state.lastUpdatedAt = currentTime;
};

const ensureCounter = (counters: Record<string, WeightedOutcomeCounter>, key: string | null): WeightedOutcomeCounter | null => {
    if (!key) {
        return null;
    }

    if (!counters[key]) {
        counters[key] = createPromptOutcomeCounter();
    }

    return counters[key];
};

const applyOutcome = (
    state: PromptCounterState,
    eventType: PromptTelemetryEventType,
    dimensions: PromptEventDimensions,
    occurredAt: Date,
    useDecay: boolean
): void => {
    if (useDecay) {
        applyDecay(state, occurredAt);
    }

    const targets = [
        state.global,
        ensureCounter(state.lenses, dimensions.lens),
        ensureCounter(state.signals, dimensions.signalKind),
        ensureCounter(state.metrics, dimensions.metric),
        ensureCounter(state.categories, dimensions.category),
    ].filter((counter): counter is WeightedOutcomeCounter => counter !== null);

    for (const counter of targets) {
        if (eventType === 'SMART_PROMPT_SHOWN') {
            counter.shown += 1;
        } else if (eventType === 'SMART_PROMPT_ACCEPTED') {
            counter.accepted += 1;
        } else if (eventType === 'SMART_PROMPT_DISMISSED') {
            counter.dismissed += 1;
        }
    }

    if (!useDecay && !state.lastUpdatedAt) {
        state.lastUpdatedAt = occurredAt;
    }
}

const blendFeatureProbability = (
    state: PromptCounterState,
    dimensions: PromptEventDimensions,
    model: Exclude<PromptModelName, 'prior_only'>
): number => {
    const features = [
        { counter: state.categories[dimensions.category || ''], baseWeight: FEATURE_WEIGHTS.category },
        { counter: state.signals[dimensions.signalKind || ''], baseWeight: FEATURE_WEIGHTS.signal },
        { counter: state.lenses[dimensions.lens || ''], baseWeight: FEATURE_WEIGHTS.lens },
        { counter: state.metrics[dimensions.metric || ''], baseWeight: FEATURE_WEIGHTS.metric },
        { counter: state.global, baseWeight: FEATURE_WEIGHTS.global },
    ];

    let weightedProbability = 0;
    let totalWeight = 0;

    for (const feature of features) {
        const shown = getShownCount(feature.counter);
        const confidence = feature === features[features.length - 1] ? 1 : getConfidence(shown);
        const probability = model === 'empirical_blend'
            ? (getEmpiricalAcceptProbability(feature.counter) ?? GLOBAL_ACCEPTANCE_PRIOR)
            : getPosteriorAcceptProbability(feature.counter);
        const weight = feature.baseWeight * (0.35 + (0.65 * confidence));
        weightedProbability += probability * weight;
        totalWeight += weight;
    }

    if (totalWeight <= 0) {
        return GLOBAL_ACCEPTANCE_PRIOR;
    }

    return weightedProbability / totalWeight;
};

const evaluatePrediction = (
    metrics: PromptModelEvaluation,
    predictedAcceptance: number,
    outcome: PromptOutcome
): PromptModelEvaluation => {
    const accepted = outcome === 'accepted' ? 1 : 0;
    const boundedProbability = Math.min(1 - MIN_PROBABILITY, Math.max(MIN_PROBABILITY, predictedAcceptance));

    return {
        ...metrics,
        impressions: metrics.impressions + 1,
        accepted: metrics.accepted + (outcome === 'accepted' ? 1 : 0),
        dismissed: metrics.dismissed + (outcome === 'dismissed' ? 1 : 0),
        ignored: metrics.ignored + (outcome === 'ignored' ? 1 : 0),
        averagePredictedAcceptance: metrics.averagePredictedAcceptance + boundedProbability,
        brierScore: metrics.brierScore + Math.pow(boundedProbability - accepted, 2),
        logLoss: metrics.logLoss - (
            (accepted * Math.log(boundedProbability)) +
            ((1 - accepted) * Math.log(1 - boundedProbability))
        ),
    };
};

const finalizeMetrics = (metrics: PromptModelEvaluation): PromptModelEvaluation => {
    if (metrics.impressions === 0) {
        return metrics;
    }

    return {
        ...metrics,
        acceptanceRate: Math.round((metrics.accepted / metrics.impressions) * 1000) / 1000,
        averagePredictedAcceptance: Math.round((metrics.averagePredictedAcceptance / metrics.impressions) * 1000) / 1000,
        brierScore: Math.round((metrics.brierScore / metrics.impressions) * 10000) / 10000,
        logLoss: Math.round((metrics.logLoss / metrics.impressions) * 10000) / 10000,
    };
};

const createModelMetrics = (model: PromptModelName): PromptModelEvaluation => ({
    model,
    impressions: 0,
    accepted: 0,
    dismissed: 0,
    ignored: 0,
    acceptanceRate: 0,
    averagePredictedAcceptance: 0,
    brierScore: 0,
    logLoss: 0,
});

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

export const evaluatePromptLearningModels = async (
    userId: string,
    days: number = DEFAULT_LOOKBACK_DAYS
): Promise<PromptLearningEvaluationReport> => {
    const rangeDays = clampLookbackDays(days);
    const since = new Date();
    since.setDate(since.getDate() - rangeDays);

    const events = await prisma.personalizationEvent.findMany({
        where: {
            userId,
            eventType: {
                in: ['SMART_PROMPT_SHOWN', 'SMART_PROMPT_ACCEPTED', 'SMART_PROMPT_DISMISSED'],
            },
            occurredAt: { gte: since },
        },
        select: {
            eventType: true,
            field: true,
            value: true,
            metadata: true,
            occurredAt: true,
        },
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });

    const empiricalState = createCounterState();
    const bayesianDecayState = createCounterState();
    const pendingByInstanceId = new Map<string, PendingPromptImpression>();
    const pendingWithoutInstanceId: PendingPromptImpression[] = [];
    const evaluations = new Map<PromptModelName, PromptModelEvaluation>([
        ['prior_only', createModelMetrics('prior_only')],
        ['empirical_blend', createModelMetrics('empirical_blend')],
        ['bayesian_decay_blend', createModelMetrics('bayesian_decay_blend')],
    ]);

    const resolvePending = (dimensions: PromptEventDimensions): PendingPromptImpression | null => {
        if (dimensions.promptInstanceId) {
            const match = pendingByInstanceId.get(dimensions.promptInstanceId) || null;
            if (match) {
                pendingByInstanceId.delete(dimensions.promptInstanceId);
            }
            return match;
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

    for (const event of events) {
        const typedEvent = event.eventType as PromptTelemetryEventType;
        const dimensions = extractPromptEventDimensions(event);

        if (typedEvent === 'SMART_PROMPT_SHOWN') {
            const pending: PendingPromptImpression = {
                ...dimensions,
                shownAt: event.occurredAt,
                predictedAcceptByModel: {
                    prior_only: GLOBAL_ACCEPTANCE_PRIOR,
                    empirical_blend: blendFeatureProbability(empiricalState, dimensions, 'empirical_blend'),
                    bayesian_decay_blend: blendFeatureProbability(bayesianDecayState, dimensions, 'bayesian_decay_blend'),
                },
            };

            if (dimensions.promptInstanceId) {
                pendingByInstanceId.set(dimensions.promptInstanceId, pending);
            } else {
                pendingWithoutInstanceId.push(pending);
            }

            applyOutcome(empiricalState, typedEvent, dimensions, event.occurredAt, false);
            applyOutcome(bayesianDecayState, typedEvent, dimensions, event.occurredAt, true);
            continue;
        }

        const pending = resolvePending(dimensions);
        if (!pending) {
            continue;
        }

        const outcome: PromptOutcome = typedEvent === 'SMART_PROMPT_ACCEPTED' ? 'accepted' : 'dismissed';

        evaluations.set(
            'prior_only',
            evaluatePrediction(evaluations.get('prior_only')!, pending.predictedAcceptByModel.prior_only, outcome)
        );
        evaluations.set(
            'empirical_blend',
            evaluatePrediction(evaluations.get('empirical_blend')!, pending.predictedAcceptByModel.empirical_blend, outcome)
        );
        evaluations.set(
            'bayesian_decay_blend',
            evaluatePrediction(evaluations.get('bayesian_decay_blend')!, pending.predictedAcceptByModel.bayesian_decay_blend, outcome)
        );

        applyOutcome(empiricalState, typedEvent, pending, event.occurredAt, false);
        applyOutcome(bayesianDecayState, typedEvent, pending, event.occurredAt, true);
    }

    const unresolvedPending = [
        ...pendingWithoutInstanceId,
        ...Array.from(pendingByInstanceId.values()),
    ];

    for (const pending of unresolvedPending) {
        const outcome: PromptOutcome = 'ignored';
        evaluations.set(
            'prior_only',
            evaluatePrediction(evaluations.get('prior_only')!, pending.predictedAcceptByModel.prior_only, outcome)
        );
        evaluations.set(
            'empirical_blend',
            evaluatePrediction(evaluations.get('empirical_blend')!, pending.predictedAcceptByModel.empirical_blend, outcome)
        );
        evaluations.set(
            'bayesian_decay_blend',
            evaluatePrediction(evaluations.get('bayesian_decay_blend')!, pending.predictedAcceptByModel.bayesian_decay_blend, outcome)
        );
    }

    const models = Array.from(evaluations.values())
        .map(finalizeMetrics)
        .sort((left, right) => {
            if (left.logLoss !== right.logLoss) {
                return left.logLoss - right.logLoss;
            }

            return left.brierScore - right.brierScore;
        });

    return {
        generatedAt: new Date().toISOString(),
        rangeDays,
        impressions: models[0]?.impressions || 0,
        recommendedModel: models[0]?.model || null,
        models,
    };
};

export default evaluatePromptLearningModels;
