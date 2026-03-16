import type { PromptLearningPolicy } from './prompt-learning-policy.service';
import type { PromptLearningPolicyPerformanceReport } from './prompt-learning-policy-snapshot.service';

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const roundWeight = (value: number): number =>
    Math.round(value * 1000) / 1000;

const getOverallAcceptanceRate = (report: PromptLearningPolicyPerformanceReport): number => {
    const totals = report.snapshots.reduce(
        (acc, snapshot) => ({
            impressions: acc.impressions + snapshot.impressions,
            accepted: acc.accepted + snapshot.accepted,
        }),
        { impressions: 0, accepted: 0 }
    );

    return totals.impressions > 0 ? totals.accepted / totals.impressions : 0;
};

const scaleWeights = (
    weights: PromptLearningPolicy['explorationWeights'],
    factor: number,
    min: number,
    max: number
): PromptLearningPolicy['explorationWeights'] => ({
    signal: roundWeight(clamp(weights.signal * factor, min, max)),
    metric: roundWeight(clamp(weights.metric * factor, min, max)),
    lens: roundWeight(clamp(weights.lens * factor, min, max)),
    category: roundWeight(clamp(weights.category * factor, min, max)),
});

export const applyPromptPolicyPerformanceFeedback = (
    policy: PromptLearningPolicy,
    report: PromptLearningPolicyPerformanceReport
): PromptLearningPolicy => {
    const { trend } = report;
    const sampleScarcity = clamp(policy.sampleScarcity, 0, 1);
    const calibrationGain = clamp(policy.calibrationGain, 0, 1);
    const deltaSeverity = clamp(Math.abs(trend.deltaAcceptanceRate) / 0.12, 0, 1);
    const hasMeaningfulTrend =
        trend.currentImpressions >= 12 &&
        (trend.previousImpressions >= 12 || trend.trend === 'stable');

    let explorationFactor = 1;
    let behaviorFactor = 1;

    if (trend.trend === 'declining' && hasMeaningfulTrend) {
        explorationFactor -= 0.12 + (deltaSeverity * 0.2) + ((1 - sampleScarcity) * 0.05);
        behaviorFactor += 0.05 + (deltaSeverity * 0.08) + (calibrationGain * 0.04);
    } else if (trend.trend === 'improving' && hasMeaningfulTrend) {
        explorationFactor += 0.03 + (deltaSeverity * 0.08) + (sampleScarcity * 0.08);
        behaviorFactor += 0.02 + (calibrationGain * 0.05);
    } else if (trend.trend === 'stable') {
        if (sampleScarcity >= 0.45 && trend.currentImpressions >= 8) {
            explorationFactor += 0.05 + (sampleScarcity * 0.12);
        } else if (sampleScarcity <= 0.2 && trend.currentImpressions >= 20) {
            explorationFactor -= 0.04;
            behaviorFactor += 0.03;
        }
    } else if (trend.trend === 'insufficient_data' && sampleScarcity >= 0.35) {
        explorationFactor += 0.04 + (sampleScarcity * 0.1);
    }

    const overallAcceptanceRate = getOverallAcceptanceRate(report);
    if (policy.recommendedModel) {
        const modelSummary = report.modelSummaries.find((summary) => summary.model === policy.recommendedModel);
        if (modelSummary && modelSummary.impressions >= 20) {
            const modelEdge = modelSummary.acceptanceRate - overallAcceptanceRate;
            if (modelEdge <= -0.03) {
                explorationFactor -= 0.06;
                behaviorFactor += 0.05;
            } else if (modelEdge >= 0.03 && sampleScarcity >= 0.3) {
                explorationFactor += 0.04;
            }
        }
    }

    explorationFactor = clamp(explorationFactor, 0.62, 1.35);
    behaviorFactor = clamp(behaviorFactor, 0.88, 1.2);

    return {
        ...policy,
        generatedAt: new Date().toISOString(),
        explorationScale: roundWeight(clamp(policy.explorationScale * explorationFactor, 0.14, 1.1)),
        behaviorScale: roundWeight(clamp(policy.behaviorScale * behaviorFactor, 0.68, 1.25)),
        explorationWeights: scaleWeights(policy.explorationWeights, explorationFactor, 0.08, 1.6),
        behaviorWeights: scaleWeights(policy.behaviorWeights, behaviorFactor, 0.4, 1.6),
    };
};

export default applyPromptPolicyPerformanceFeedback;
