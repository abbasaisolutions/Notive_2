export type PromptLens = 'clarity' | 'memory' | 'growth' | 'productivity';
export type PromptLearningAction = 'shown' | 'accepted' | 'dismissed';

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

export interface PromptPolicyWeights {
    signal: number;
    metric: number;
    lens: number;
    category: number;
}

export interface PromptLearningPolicy {
    generatedAt?: string;
    rangeDays?: number;
    recommendedModel?: 'prior_only' | 'empirical_blend' | 'bayesian_decay_blend' | null;
    impressions?: number;
    calibrationGain?: number;
    sampleScarcity?: number;
    explorationScale?: number;
    behaviorScale?: number;
    explorationWeights: PromptPolicyWeights;
    behaviorWeights: PromptPolicyWeights;
}

type PromptLearningCounter = {
    shown: number;
    accepted: number;
    dismissed: number;
    lastOccurredAt?: string;
};

type PromptLearningState = {
    version: 1;
    updatedAt?: string;
    lenses: Record<string, PromptLearningCounter>;
    signals: Record<string, PromptLearningCounter>;
    metrics: Record<string, PromptLearningCounter>;
    categories: Record<string, PromptLearningCounter>;
};

export interface PromptBehaviorProfile {
    generatedAt?: string;
    rangeDays?: number;
    lensBoosts: Partial<Record<PromptLens, number>>;
    signalBoosts: Record<string, number>;
    metricBoosts: Record<string, number>;
    categoryBoosts: Record<string, number>;
    lensStats: Partial<Record<PromptLens, PromptBehaviorStat>>;
    signalStats: Record<string, PromptBehaviorStat>;
    metricStats: Record<string, PromptBehaviorStat>;
    categoryStats: Record<string, PromptBehaviorStat>;
    policy?: PromptLearningPolicy;
}

type RecordPromptLearningInput = {
    userId: string;
    action: PromptLearningAction;
    lens?: string | null;
    signalKind?: string | null;
    metric?: string | null;
    category?: string | null;
};

const STORAGE_KEY_PREFIX = 'notive_prompt_learning_v1';
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
const DEFAULT_POLICY_WEIGHTS: PromptPolicyWeights = {
    signal: 0.8,
    metric: 0.45,
    lens: 0.55,
    category: 0.7,
};
const DEFAULT_BEHAVIOR_WEIGHTS: PromptPolicyWeights = {
    signal: 1,
    metric: 1,
    lens: 1,
    category: 0.45,
};

const isBrowser = () => typeof window !== 'undefined';
const storageKey = (userId: string) => `${STORAGE_KEY_PREFIX}_${userId}`;

const clampCounter = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : 0;

const normalizeKey = (value: string | null | undefined, maxLength = 80): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized ? normalized.slice(0, maxLength) : null;
};

const createEmptyCounter = (): PromptLearningCounter => ({
    shown: 0,
    accepted: 0,
    dismissed: 0,
});

const normalizeCounter = (value: unknown): PromptLearningCounter => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return createEmptyCounter();
    }

    const source = value as Record<string, unknown>;
    return {
        shown: clampCounter(source.shown),
        accepted: clampCounter(source.accepted),
        dismissed: clampCounter(source.dismissed),
        lastOccurredAt: typeof source.lastOccurredAt === 'string' ? source.lastOccurredAt : undefined,
    };
};

const normalizeCounterMap = (value: unknown): Record<string, PromptLearningCounter> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, PromptLearningCounter>>((acc, [key, counter]) => {
        const normalizedKey = normalizeKey(key);
        if (!normalizedKey) {
            return acc;
        }

        const normalizedCounter = normalizeCounter(counter);
        if (normalizedCounter.shown === 0 && normalizedCounter.accepted === 0 && normalizedCounter.dismissed === 0) {
            return acc;
        }

        acc[normalizedKey] = normalizedCounter;
        return acc;
    }, {});
};

const defaultState = (): PromptLearningState => ({
    version: 1,
    lenses: {},
    signals: {},
    metrics: {},
    categories: {},
});

const parseState = (raw: string | null): PromptLearningState => {
    if (!raw) {
        return defaultState();
    }

    try {
        const parsed = JSON.parse(raw) as Partial<PromptLearningState>;
        if (!parsed || typeof parsed !== 'object') {
            return defaultState();
        }

        return {
            version: 1,
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
            lenses: normalizeCounterMap(parsed.lenses),
            signals: normalizeCounterMap(parsed.signals),
            metrics: normalizeCounterMap(parsed.metrics),
            categories: normalizeCounterMap(parsed.categories),
        };
    } catch {
        return defaultState();
    }
};

const updateCounter = (
    counters: Record<string, PromptLearningCounter>,
    key: string | null,
    action: PromptLearningAction,
    occurredAt: string
): Record<string, PromptLearningCounter> => {
    if (!key) {
        return counters;
    }

    const current = counters[key] || createEmptyCounter();
    const next: PromptLearningCounter = {
        ...current,
        shown: action === 'shown' ? current.shown + 1 : current.shown,
        accepted: action === 'accepted' ? current.accepted + 1 : current.accepted,
        dismissed: action === 'dismissed' ? current.dismissed + 1 : current.dismissed,
        lastOccurredAt: occurredAt,
    };

    return {
        ...counters,
        [key]: next,
    };
};

const roundScore = (value: number): number => Math.round(value * 10) / 10;
const roundMetric = (value: number): number => Math.round(value * 1000) / 1000;

const clampBoostMap = (value: unknown): Record<string, number> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, score]) => {
        const normalizedKey = normalizeKey(key);
        if (!normalizedKey) {
            return acc;
        }

        const numericScore = typeof score === 'number' && Number.isFinite(score)
            ? roundScore(score)
            : 0;
        if (numericScore !== 0) {
            acc[normalizedKey] = numericScore;
        }
        return acc;
    }, {});
};

const normalizePolicyWeights = (value: unknown, fallback: PromptPolicyWeights): PromptPolicyWeights => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return fallback;
    }

    const source = value as Record<string, unknown>;
    const readWeight = (key: keyof PromptPolicyWeights): number => {
        const weight = source[key];
        return typeof weight === 'number' && Number.isFinite(weight)
            ? roundMetric(weight)
            : fallback[key];
    };

    return {
        signal: readWeight('signal'),
        metric: readWeight('metric'),
        lens: readWeight('lens'),
        category: readWeight('category'),
    };
};

const normalizePolicy = (value: unknown): PromptLearningPolicy | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }

    const source = value as Record<string, unknown>;

    return {
        generatedAt: typeof source.generatedAt === 'string' ? source.generatedAt : undefined,
        rangeDays: typeof source.rangeDays === 'number' && Number.isFinite(source.rangeDays)
            ? Math.max(0, Math.floor(source.rangeDays))
            : undefined,
        recommendedModel:
            source.recommendedModel === 'prior_only' ||
            source.recommendedModel === 'empirical_blend' ||
            source.recommendedModel === 'bayesian_decay_blend' ||
            source.recommendedModel === null
                ? source.recommendedModel
                : undefined,
        impressions: typeof source.impressions === 'number' && Number.isFinite(source.impressions)
            ? Math.max(0, Math.floor(source.impressions))
            : undefined,
        calibrationGain: typeof source.calibrationGain === 'number' && Number.isFinite(source.calibrationGain)
            ? roundMetric(source.calibrationGain)
            : undefined,
        sampleScarcity: typeof source.sampleScarcity === 'number' && Number.isFinite(source.sampleScarcity)
            ? roundMetric(source.sampleScarcity)
            : undefined,
        explorationScale: typeof source.explorationScale === 'number' && Number.isFinite(source.explorationScale)
            ? roundMetric(source.explorationScale)
            : undefined,
        behaviorScale: typeof source.behaviorScale === 'number' && Number.isFinite(source.behaviorScale)
            ? roundMetric(source.behaviorScale)
            : undefined,
        explorationWeights: normalizePolicyWeights(source.explorationWeights, DEFAULT_POLICY_WEIGHTS),
        behaviorWeights: normalizePolicyWeights(source.behaviorWeights, DEFAULT_BEHAVIOR_WEIGHTS),
    };
};

const normalizeStat = (value: unknown): PromptBehaviorStat | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const source = value as Record<string, unknown>;
    const readMetric = (key: keyof PromptBehaviorStat): number => {
        const metric = source[key];
        return typeof metric === 'number' && Number.isFinite(metric)
            ? roundMetric(metric)
            : 0;
    };

    const shown = readMetric('shown');
    if (shown <= 0) {
        return null;
    }

    return {
        shown,
        accepted: readMetric('accepted'),
        dismissed: readMetric('dismissed'),
        ignored: readMetric('ignored'),
        acceptanceProbability: readMetric('acceptanceProbability'),
        confidence: readMetric('confidence'),
        expectedUtility: readMetric('expectedUtility'),
        explorationBonus: readMetric('explorationBonus'),
    };
};

const clampStatMap = (value: unknown): Record<string, PromptBehaviorStat> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, PromptBehaviorStat>>((acc, [key, stat]) => {
        const normalizedKey = normalizeKey(key);
        const normalizedStat = normalizeStat(stat);
        if (!normalizedKey || !normalizedStat) {
            return acc;
        }

        acc[normalizedKey] = normalizedStat;
        return acc;
    }, {});
};

const isPromptLens = (value: string): value is PromptLens =>
    value === 'clarity' || value === 'memory' || value === 'growth' || value === 'productivity';

export const EMPTY_PROMPT_BEHAVIOR_PROFILE: PromptBehaviorProfile = {
    lensBoosts: {},
    signalBoosts: {},
    metricBoosts: {},
    categoryBoosts: {},
    lensStats: {},
    signalStats: {},
    metricStats: {},
    categoryStats: {},
    policy: {
        explorationWeights: DEFAULT_POLICY_WEIGHTS,
        behaviorWeights: DEFAULT_BEHAVIOR_WEIGHTS,
    },
};

export const normalizePromptBehaviorProfile = (value: unknown): PromptBehaviorProfile => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return EMPTY_PROMPT_BEHAVIOR_PROFILE;
    }

    const source = value as Record<string, unknown>;
    const lensBoostCandidates = clampBoostMap(source.lensBoosts);
    const lensBoosts = Object.entries(lensBoostCandidates).reduce<Partial<Record<PromptLens, number>>>((acc, [key, score]) => {
        if (isPromptLens(key)) {
            acc[key] = score;
        }
        return acc;
    }, {});
    const lensStatCandidates = clampStatMap(source.lensStats);
    const lensStats = Object.entries(lensStatCandidates).reduce<Partial<Record<PromptLens, PromptBehaviorStat>>>((acc, [key, stat]) => {
        if (isPromptLens(key)) {
            acc[key] = stat;
        }
        return acc;
    }, {});

    return {
        generatedAt: typeof source.generatedAt === 'string' ? source.generatedAt : undefined,
        rangeDays: typeof source.rangeDays === 'number' && Number.isFinite(source.rangeDays)
            ? Math.max(0, Math.floor(source.rangeDays))
            : undefined,
        lensBoosts,
        signalBoosts: clampBoostMap(source.signalBoosts),
        metricBoosts: clampBoostMap(source.metricBoosts),
        categoryBoosts: clampBoostMap(source.categoryBoosts),
        lensStats,
        signalStats: clampStatMap(source.signalStats),
        metricStats: clampStatMap(source.metricStats),
        categoryStats: clampStatMap(source.categoryStats),
        policy: normalizePolicy(source.policy) || EMPTY_PROMPT_BEHAVIOR_PROFILE.policy,
    };
};

const getShownCount = (counter: PromptLearningCounter | undefined): number =>
    counter ? Math.max(counter.shown, counter.accepted + counter.dismissed) : 0;

const getIgnoredCount = (counter: PromptLearningCounter | undefined): number =>
    Math.max(0, getShownCount(counter) - (counter?.accepted || 0) - (counter?.dismissed || 0));

const getConfidence = (shown: number): number =>
    shown <= 0 ? 0 : 1 - Math.exp(-shown / CONFIDENCE_CURVE);

const getExpectedUtility = (counter: PromptLearningCounter | undefined): number => {
    const shown = getShownCount(counter);
    if (shown <= 0) {
        return 0;
    }

    const accepted = counter?.accepted || 0;
    const dismissed = counter?.dismissed || 0;
    const ignored = getIgnoredCount(counter);
    const posteriorAccept = accepted + ACCEPTANCE_PRIOR;
    const posteriorDismiss = dismissed + DISMISSAL_PRIOR;
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

const getAcceptanceDistribution = (counter: PromptLearningCounter | undefined): {
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

const computeBoost = (counter: PromptLearningCounter | undefined): number => {
    const shown = getShownCount(counter);
    if (shown <= 0) {
        return 0;
    }

    const confidence = getConfidence(shown);
    const expectedUtility = getExpectedUtility(counter);
    return roundScore(expectedUtility * BEHAVIOR_SCORE_SCALE * confidence);
};

const summarizeCounter = (counter: PromptLearningCounter | undefined): PromptBehaviorStat | null => {
    const shown = getShownCount(counter);
    if (shown <= 0) {
        return null;
    }

    const accepted = counter?.accepted || 0;
    const dismissed = counter?.dismissed || 0;
    const ignored = getIgnoredCount(counter);
    const confidence = getConfidence(shown);
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

const summarizeStatMap = (stats: Record<string, PromptBehaviorStat> | Partial<Record<PromptLens, PromptBehaviorStat>>) => {
    const values = Object.values(stats).filter((value): value is PromptBehaviorStat => Boolean(value));
    if (values.length === 0) {
        return {
            averageConfidence: 0,
            averageExplorationPressure: 0.5,
            averageEvidence: 0,
            coverage: 0,
        };
    }

    const total = values.length;
    const confidentCount = values.filter((value) => value.shown >= 3).length;

    return {
        averageConfidence: values.reduce((sum, value) => sum + value.confidence, 0) / total,
        averageExplorationPressure: values.reduce(
            (sum, value) => sum + Math.min(1, value.explorationBonus / MAX_EXPLORATION_BONUS),
            0
        ) / total,
        averageEvidence: values.reduce((sum, value) => sum + Math.min(1, value.shown / 8), 0) / total,
        coverage: confidentCount / total,
    };
};

const deriveLocalPolicy = (
    lensStats: Partial<Record<PromptLens, PromptBehaviorStat>>,
    signalStats: Record<string, PromptBehaviorStat>,
    metricStats: Record<string, PromptBehaviorStat>,
    categoryStats: Record<string, PromptBehaviorStat>
): PromptLearningPolicy => {
    const summaries = {
        signal: summarizeStatMap(signalStats),
        metric: summarizeStatMap(metricStats),
        lens: summarizeStatMap(lensStats),
        category: summarizeStatMap(categoryStats),
    };
    const overallCoverage =
        (summaries.signal.coverage + summaries.metric.coverage + summaries.lens.coverage + summaries.category.coverage) / 4;
    const overallConfidence =
        (summaries.signal.averageConfidence + summaries.metric.averageConfidence + summaries.lens.averageConfidence + summaries.category.averageConfidence) / 4;
    const sampleScarcity = roundMetric(1 - overallCoverage);
    const explorationScale = roundMetric(Math.max(0.2, Math.min(0.95, 0.32 + (sampleScarcity * 0.45) + ((1 - overallConfidence) * 0.18))));
    const behaviorScale = roundMetric(Math.max(0.72, Math.min(1.1, 0.76 + (overallConfidence * 0.2) + ((1 - sampleScarcity) * 0.12))));
    const calibrateExplorationWeight = (baseWeight: number, summary: ReturnType<typeof summarizeStatMap>): number =>
        roundMetric(Math.max(
            0.12,
            Math.min(
                1.4,
                baseWeight * (
                    0.7 +
                    (explorationScale * 0.5) +
                    (summary.averageExplorationPressure * 0.35) +
                    ((1 - summary.coverage) * 0.2) -
                    (summary.averageConfidence * 0.15)
                )
            )
        ));
    const calibrateBehaviorWeight = (baseWeight: number, summary: ReturnType<typeof summarizeStatMap>): number =>
        roundMetric(Math.max(
            0.45,
            Math.min(
                1.45,
                baseWeight * (
                    0.78 +
                    (behaviorScale * 0.24) +
                    (summary.averageConfidence * 0.18) +
                    (summary.averageEvidence * 0.12) -
                    (summary.averageExplorationPressure * 0.12)
                )
            )
        ));

    return {
        sampleScarcity,
        explorationScale,
        behaviorScale,
        explorationWeights: {
            signal: calibrateExplorationWeight(DEFAULT_POLICY_WEIGHTS.signal, summaries.signal),
            metric: calibrateExplorationWeight(DEFAULT_POLICY_WEIGHTS.metric, summaries.metric),
            lens: calibrateExplorationWeight(DEFAULT_POLICY_WEIGHTS.lens, summaries.lens),
            category: calibrateExplorationWeight(DEFAULT_POLICY_WEIGHTS.category, summaries.category),
        },
        behaviorWeights: {
            signal: calibrateBehaviorWeight(DEFAULT_BEHAVIOR_WEIGHTS.signal, summaries.signal),
            metric: calibrateBehaviorWeight(DEFAULT_BEHAVIOR_WEIGHTS.metric, summaries.metric),
            lens: calibrateBehaviorWeight(DEFAULT_BEHAVIOR_WEIGHTS.lens, summaries.lens),
            category: calibrateBehaviorWeight(DEFAULT_BEHAVIOR_WEIGHTS.category, summaries.category),
        },
    };
};

class PromptLearningService {
    getState(userId: string): PromptLearningState {
        if (!isBrowser() || !userId) {
            return defaultState();
        }

        return parseState(localStorage.getItem(storageKey(userId)));
    }

    private saveState(userId: string, state: PromptLearningState): void {
        if (!isBrowser() || !userId) {
            return;
        }

        localStorage.setItem(storageKey(userId), JSON.stringify(state));
    }

    recordEvent(input: RecordPromptLearningInput): PromptLearningState {
        const { userId, action } = input;
        if (!isBrowser() || !userId) {
            return defaultState();
        }

        const occurredAt = new Date().toISOString();
        const state = this.getState(userId);

        const nextState: PromptLearningState = {
            ...state,
            updatedAt: occurredAt,
            lenses: updateCounter(state.lenses, normalizeKey(input.lens), action, occurredAt),
            signals: updateCounter(state.signals, normalizeKey(input.signalKind), action, occurredAt),
            metrics: updateCounter(state.metrics, normalizeKey(input.metric), action, occurredAt),
            categories: updateCounter(state.categories, normalizeKey(input.category), action, occurredAt),
        };

        this.saveState(userId, nextState);
        return nextState;
    }

    getBehaviorProfile(userId: string): PromptBehaviorProfile {
        const state = this.getState(userId);

        const lensBoosts = Object.entries(state.lenses).reduce<Partial<Record<PromptLens, number>>>((acc, [key, counter]) => {
            if (key === 'clarity' || key === 'memory' || key === 'growth' || key === 'productivity') {
                acc[key] = computeBoost(counter);
            }
            return acc;
        }, {});
        const lensStats = Object.entries(state.lenses).reduce<Partial<Record<PromptLens, PromptBehaviorStat>>>((acc, [key, counter]) => {
            if (key === 'clarity' || key === 'memory' || key === 'growth' || key === 'productivity') {
                const summary = summarizeCounter(counter);
                if (summary) {
                    acc[key] = summary;
                }
            }
            return acc;
        }, {});

        const signalBoosts = Object.entries(state.signals).reduce<Record<string, number>>((acc, [key, counter]) => {
            acc[key] = computeBoost(counter);
            return acc;
        }, {});
        const signalStats = Object.entries(state.signals).reduce<Record<string, PromptBehaviorStat>>((acc, [key, counter]) => {
            const summary = summarizeCounter(counter);
            if (summary) {
                acc[key] = summary;
            }
            return acc;
        }, {});

        const metricBoosts = Object.entries(state.metrics).reduce<Record<string, number>>((acc, [key, counter]) => {
            acc[key] = computeBoost(counter);
            return acc;
        }, {});
        const metricStats = Object.entries(state.metrics).reduce<Record<string, PromptBehaviorStat>>((acc, [key, counter]) => {
            const summary = summarizeCounter(counter);
            if (summary) {
                acc[key] = summary;
            }
            return acc;
        }, {});

        const categoryBoosts = Object.entries(state.categories).reduce<Record<string, number>>((acc, [key, counter]) => {
            acc[key] = computeBoost(counter);
            return acc;
        }, {});
        const categoryStats = Object.entries(state.categories).reduce<Record<string, PromptBehaviorStat>>((acc, [key, counter]) => {
            const summary = summarizeCounter(counter);
            if (summary) {
                acc[key] = summary;
            }
            return acc;
        }, {});

        return {
            generatedAt: state.updatedAt,
            lensBoosts,
            signalBoosts,
            metricBoosts,
            categoryBoosts,
            lensStats,
            signalStats,
            metricStats,
            categoryStats,
            policy: deriveLocalPolicy(lensStats, signalStats, metricStats, categoryStats),
        };
    }

    getBehaviorProfileOrEmpty(userId: string): PromptBehaviorProfile {
        return userId ? this.getBehaviorProfile(userId) : EMPTY_PROMPT_BEHAVIOR_PROFILE;
    }
}

export const promptLearningService = new PromptLearningService();
export default promptLearningService;
