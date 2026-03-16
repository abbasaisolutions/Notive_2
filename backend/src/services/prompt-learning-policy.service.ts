import {
    buildPromptBehaviorProfile,
    type PromptBehaviorProfile,
    type PromptBehaviorStat,
} from './prompt-learning.service';
import {
    evaluatePromptLearningModels,
    type PromptLearningEvaluationReport,
    type PromptModelName,
} from './prompt-learning-evaluation.service';

type PromptPolicyWeights = {
    signal: number;
    metric: number;
    lens: number;
    category: number;
};

export interface PromptLearningPolicy {
    generatedAt: string;
    rangeDays: number;
    recommendedModel: PromptModelName | null;
    impressions: number;
    calibrationGain: number;
    sampleScarcity: number;
    explorationScale: number;
    behaviorScale: number;
    explorationWeights: PromptPolicyWeights;
    behaviorWeights: PromptPolicyWeights;
}

export interface PromptBehaviorProfileWithPolicy extends PromptBehaviorProfile {
    policy: PromptLearningPolicy;
}

type StatMap = Record<string, PromptBehaviorStat> | Partial<Record<string, PromptBehaviorStat>>;

interface AggregatedStatSummary {
    averageConfidence: number;
    averageExplorationPressure: number;
    averageEvidence: number;
    coverage: number;
}

const DEFAULT_EXPLORATION_WEIGHTS: PromptPolicyWeights = {
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

const MAX_EXPLORATION_BONUS = 2.5;

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const roundWeight = (value: number): number =>
    Math.round(value * 1000) / 1000;

const summarizeStats = (stats: StatMap): AggregatedStatSummary => {
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
    const averageConfidence = values.reduce((sum, value) => sum + value.confidence, 0) / total;
    const averageExplorationPressure = values.reduce(
        (sum, value) => sum + clamp(value.explorationBonus / MAX_EXPLORATION_BONUS, 0, 1),
        0
    ) / total;
    const averageEvidence = values.reduce(
        (sum, value) => sum + clamp(value.shown / 8, 0, 1),
        0
    ) / total;

    return {
        averageConfidence,
        averageExplorationPressure,
        averageEvidence,
        coverage: confidentCount / total,
    };
};

const getCalibrationGain = (report: PromptLearningEvaluationReport): number => {
    const priorOnly = report.models.find((model) => model.model === 'prior_only');
    const bestModel = report.models[0];

    if (!priorOnly || !bestModel || priorOnly.logLoss <= 0) {
        return 0;
    }

    return clamp((priorOnly.logLoss - bestModel.logLoss) / priorOnly.logLoss, 0, 0.45);
};

const calibrateExplorationWeight = (
    baseWeight: number,
    summary: AggregatedStatSummary,
    explorationScale: number
): number => {
    const sparsity = 1 - summary.coverage;
    const multiplier =
        0.7 +
        (explorationScale * 0.5) +
        (summary.averageExplorationPressure * 0.35) +
        (sparsity * 0.2) -
        (summary.averageConfidence * 0.15);

    return roundWeight(clamp(baseWeight * multiplier, 0.12, 1.4));
};

const calibrateBehaviorWeight = (
    baseWeight: number,
    summary: AggregatedStatSummary,
    behaviorScale: number
): number => {
    const multiplier =
        0.78 +
        (behaviorScale * 0.24) +
        (summary.averageConfidence * 0.18) +
        (summary.averageEvidence * 0.12) -
        (summary.averageExplorationPressure * 0.12);

    return roundWeight(clamp(baseWeight * multiplier, 0.45, 1.45));
};

export const buildPromptLearningPolicy = (
    profile: PromptBehaviorProfile,
    report: PromptLearningEvaluationReport
): PromptLearningPolicy => {
    const calibrationGain = getCalibrationGain(report);
    const sampleScarcity = clamp(1 / (1 + (report.impressions / 60)), 0, 1);
    const explorationScale = clamp(
        0.28 + (sampleScarcity * 0.48) + ((1 - calibrationGain) * 0.24),
        0.18,
        0.98
    );
    const behaviorScale = clamp(
        0.72 + (calibrationGain * 0.45) + ((1 - sampleScarcity) * 0.2),
        0.7,
        1.15
    );

    const summaries = {
        signal: summarizeStats(profile.signalStats),
        metric: summarizeStats(profile.metricStats),
        lens: summarizeStats(profile.lensStats),
        category: summarizeStats(profile.categoryStats),
    };

    return {
        generatedAt: new Date().toISOString(),
        rangeDays: report.rangeDays,
        recommendedModel: report.recommendedModel,
        impressions: report.impressions,
        calibrationGain: roundWeight(calibrationGain),
        sampleScarcity: roundWeight(sampleScarcity),
        explorationScale: roundWeight(explorationScale),
        behaviorScale: roundWeight(behaviorScale),
        explorationWeights: {
            signal: calibrateExplorationWeight(DEFAULT_EXPLORATION_WEIGHTS.signal, summaries.signal, explorationScale),
            metric: calibrateExplorationWeight(DEFAULT_EXPLORATION_WEIGHTS.metric, summaries.metric, explorationScale),
            lens: calibrateExplorationWeight(DEFAULT_EXPLORATION_WEIGHTS.lens, summaries.lens, explorationScale),
            category: calibrateExplorationWeight(DEFAULT_EXPLORATION_WEIGHTS.category, summaries.category, explorationScale),
        },
        behaviorWeights: {
            signal: calibrateBehaviorWeight(DEFAULT_BEHAVIOR_WEIGHTS.signal, summaries.signal, behaviorScale),
            metric: calibrateBehaviorWeight(DEFAULT_BEHAVIOR_WEIGHTS.metric, summaries.metric, behaviorScale),
            lens: calibrateBehaviorWeight(DEFAULT_BEHAVIOR_WEIGHTS.lens, summaries.lens, behaviorScale),
            category: calibrateBehaviorWeight(DEFAULT_BEHAVIOR_WEIGHTS.category, summaries.category, behaviorScale),
        },
    };
};

export const buildPromptBehaviorProfileWithPolicy = async (
    userId: string,
    days?: number
): Promise<PromptBehaviorProfileWithPolicy> => {
    const [profile, evaluation] = await Promise.all([
        buildPromptBehaviorProfile(userId, days),
        evaluatePromptLearningModels(userId, days),
    ]);

    return {
        ...profile,
        policy: buildPromptLearningPolicy(profile, evaluation),
    };
};

export default buildPromptBehaviorProfileWithPolicy;
