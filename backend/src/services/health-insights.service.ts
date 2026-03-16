// Health Insights Service - AI-powered correlations between health and journal data
// File: backend/src/services/health-insights.service.ts

import type { HealthContext } from '@prisma/client';
import prisma from '../config/prisma';
import { aiRuntime, createLlmChatCompletion, hasLlmProvider } from '../config/ai';
import { healthSyncService } from './health-sync.service';
import type { HealthContextSummary, HealthPromptSignal } from '../types/health-context';

interface MetricMoodPair {
    metricValue: number;
    moodScore: number;
}

interface AdaptiveBaseline {
    center: number;
    scale: number;
    mean: number;
    sampleSize: number;
}

interface DirectionalAnomaly {
    zScore: number;
    percentile: number;
    aboveProbability: number;
    belowProbability: number;
    confidence: number;
    center: number;
}

interface InsightData {
    correlations?: {
        sleepMood?: { sleep: string; moodImprovement: number };
        activityMood?: { activity: string; moodImprovement: number };
    };
    stats?: Record<string, any>;
    patterns?: string[];
}

const PROMPT_SIGNAL_LOOKBACK_DAYS = 21;
const PROMPT_SIGNAL_BASELINE_DAYS = 14;
const BASELINE_HALF_LIFE_DAYS = 5;
const MIN_BASELINE_SAMPLE_SIZE = 4;
const SLEEP_SCALE_FLOOR = 0.45;
const ACTIVITY_SCALE_FLOOR = 1.2;
const HEART_RATE_SCALE_FLOOR = 3;

export class HealthInsightsService {
    /**
     * Generate health-mood correlations for a user
     */
    async generateHealthMoodInsights(userId: string, days: number = 30): Promise<{
        sleepMoodCorrelation: string | null;
        activityMoodCorrelation: string | null;
        patterns: string[];
        recommendations: string[];
    }> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [healthContexts, entries] = await Promise.all([
            prisma.healthContext.findMany({
                where: {
                    userId,
                    date: { gte: startDate, lte: endDate },
                },
                orderBy: { date: 'asc' },
            }),
            prisma.entry.findMany({
                where: {
                    userId,
                    createdAt: { gte: startDate, lte: endDate },
                    deletedAt: null,
                    mood: { not: null },
                },
                select: {
                    mood: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
            }),
        ]);

        const moodScoresByDate = new Map<string, number[]>();
        for (const entry of entries) {
            if (!entry.mood) {
                continue;
            }

            const dateKey = this.getDateKey(entry.createdAt);
            const scores = moodScoresByDate.get(dateKey);
            if (scores) {
                scores.push(this.getMoodScore(entry.mood));
            } else {
                moodScoresByDate.set(dateKey, [this.getMoodScore(entry.mood)]);
            }
        }

        const sleepMoodPairs: MetricMoodPair[] = [];
        const activityMoodPairs: MetricMoodPair[] = [];

        for (const health of healthContexts) {
            const moodScores = moodScoresByDate.get(this.getDateKey(health.date));
            if (!moodScores?.length) {
                continue;
            }

            const averageMood = moodScores.reduce((sum, score) => sum + score, 0) / moodScores.length;

            const sleepHours = this.toSleepHours(health.sleepMinutes);
            if (sleepHours !== null) {
                sleepMoodPairs.push({
                    metricValue: sleepHours,
                    moodScore: averageMood,
                });
            }

            const activityLoad = this.getActivityLoad(health.steps, health.activeMinutes);
            if (activityLoad !== null) {
                activityMoodPairs.push({
                    metricValue: activityLoad,
                    moodScore: averageMood,
                });
            }
        }

        const patterns: string[] = [];
        const recommendations: string[] = [];
        let sleepMoodCorrelation: string | null = null;
        let activityMoodCorrelation: string | null = null;

        const sleepCorrelation = this.computeSpearmanCorrelation(sleepMoodPairs);
        if (sleepCorrelation !== null && sleepMoodPairs.length >= 5 && sleepCorrelation >= 0.28) {
            sleepMoodCorrelation = 'Your mood trends more positive after stronger sleep.';
            patterns.push('Sleep and mood are moving together in a positive pattern');
            recommendations.push('Protect the routines that help you recover well before emotionally heavy days');
        }

        const activityCorrelation = this.computeSpearmanCorrelation(activityMoodPairs);
        if (activityCorrelation !== null && activityMoodPairs.length >= 5 && activityCorrelation >= 0.24) {
            activityMoodCorrelation = 'Higher movement days are lining up with better mood.';
            patterns.push('Movement and mood show a positive association');
            recommendations.push('Even light movement may be a reliable lever when you want more momentum or lift');
        }

        const healthStats = await healthSyncService.getHealthStats(userId, days);

        if (healthStats.avgSleepHours !== null && healthStats.avgSleepHours < 6.5) {
            patterns.push('Your average sleep is below recommended levels');
            recommendations.push('Try to gradually increase your sleep duration');
        }

        if (healthStats.avgSteps !== null && healthStats.avgSteps < 5000) {
            patterns.push('Your daily step count is below the recommended minimum');
            recommendations.push('Small walks throughout the day can add up');
        }

        return {
            sleepMoodCorrelation,
            activityMoodCorrelation,
            patterns,
            recommendations,
        };
    }

    /**
     * Rank the most meaningful health/device signals for a day.
     */
    async getPromptSignals(userId: string, date: Date, limit: number = 3): Promise<HealthPromptSignal[]> {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);

        const lookbackStart = new Date(targetDate);
        lookbackStart.setDate(lookbackStart.getDate() - PROMPT_SIGNAL_LOOKBACK_DAYS);

        const healthContexts = await prisma.healthContext.findMany({
            where: {
                userId,
                date: {
                    gte: lookbackStart,
                    lte: targetDate,
                },
            },
            orderBy: { date: 'asc' },
        });

        if (healthContexts.length === 0) {
            return [];
        }

        const targetKey = this.getDateKey(targetDate);
        const currentIndex = healthContexts.findIndex((context) => this.getDateKey(context.date) === targetKey);
        if (currentIndex === -1) {
            return [];
        }

        const currentContext = healthContexts[currentIndex];
        const priorContexts = healthContexts.slice(Math.max(0, currentIndex - PROMPT_SIGNAL_BASELINE_DAYS), currentIndex);
        const signals: HealthPromptSignal[] = [];

        this.addSleepSignals(signals, currentContext, priorContexts);
        this.addActivitySignals(signals, currentContext, priorContexts);
        this.addRecoverySignals(signals, currentContext, priorContexts);
        this.addConsistencySignal(signals, healthContexts.slice(0, currentIndex + 1));

        return signals
            .sort((left, right) => right.score - left.score)
            .slice(0, limit);
    }

    /**
     * Generate AI-powered insight for an entry based on health context
     */
    async generateEntryHealthInsight(
        content: string,
        mood: string | null,
        healthContext: Pick<
            HealthContextSummary,
            'sleepHours' | 'activityLevel' | 'avgHeartRate' | 'activeMinutes' | 'restingHeartRate' | 'signals'
        >
    ): Promise<string | null> {
        const notableSignal = healthContext.signals?.[0];
        const hasUsefulContext =
            notableSignal ||
            healthContext.sleepHours !== null ||
            healthContext.activityLevel !== null ||
            healthContext.avgHeartRate !== null ||
            healthContext.restingHeartRate !== null;

        if (!hasLlmProvider() || !hasUsefulContext) {
            return null;
        }

        const sleepLow = healthContext.sleepHours !== null && healthContext.sleepHours < 6;
        const sleepHigh = healthContext.sleepHours !== null && healthContext.sleepHours > 9;
        const activityLow = healthContext.activityLevel === 'low';
        const recoveryElevated =
            healthContext.restingHeartRate !== null && healthContext.avgHeartRate !== null
                ? healthContext.avgHeartRate >= healthContext.restingHeartRate + 8
                : false;
        const negMood = mood && ['sad', 'anxious', 'frustrated', 'tired'].includes(mood);

        if (!notableSignal && !sleepLow && !sleepHigh && !activityLow && !recoveryElevated && !negMood) {
            return null;
        }

        try {
            const healthSummary = [
                notableSignal ? `${notableSignal.title}: ${notableSignal.summary}` : null,
                healthContext.sleepHours !== null ? `${healthContext.sleepHours} hours of sleep` : null,
                healthContext.activityLevel ? `${healthContext.activityLevel} activity level` : null,
                healthContext.activeMinutes !== null ? `${healthContext.activeMinutes} active minutes` : null,
                healthContext.restingHeartRate !== null ? `${healthContext.restingHeartRate} resting heart rate` : null,
            ]
                .filter(Boolean)
                .join(', ');

            const response = await createLlmChatCompletion({
                model: aiRuntime.healthModel,
                messages: [
                    {
                        role: 'system',
                        content: `You are a gentle, supportive journaling assistant. Given health context and a mood, provide a brief, non-medical observation (1 sentence max) about potential connections.

RULES:
- Never give medical advice or diagnoses
- Use words like "may have", "might", "could"
- Be supportive, not prescriptive
- Only mention patterns, not causes
- If uncertain, return null`,
                    },
                    {
                        role: 'user',
                        content: `Journal content: ${content.slice(0, 500)}
Health context: ${healthSummary}
Mood: ${mood || 'not specified'}
Generate a brief, gentle observation about how today's health context might relate to the mood, or return "null" if no clear connection.`,
                    },
                ],
                max_tokens: 100,
                temperature: 0.5,
            });

            if (!response) {
                return null;
            }

            const insight = response.choices[0]?.message?.content?.trim();
            if (insight && insight !== 'null' && insight.length > 10) {
                return insight;
            }
            return null;
        } catch (error) {
            console.error('Failed to generate entry health insight:', error);
            return null;
        }
    }

    /**
     * Generate weekly summary insight
     */
    async generateWeeklySummary(userId: string): Promise<{
        title: string;
        summary: string;
        highlights: string[];
        data: Record<string, any>;
    } | null> {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const [healthContexts, entries] = await Promise.all([
            prisma.healthContext.findMany({
                where: {
                    userId,
                    date: { gte: startDate, lte: endDate },
                },
            }),
            prisma.entry.findMany({
                where: {
                    userId,
                    createdAt: { gte: startDate, lte: endDate },
                    deletedAt: null,
                },
                select: {
                    mood: true,
                    createdAt: true,
                },
            }),
        ]);

        if (healthContexts.length < 3 || entries.length < 2) {
            return null;
        }

        let sleepMinutesTotal = 0;
        let sleepCount = 0;
        let stepsTotal = 0;
        let stepsCount = 0;

        for (const context of healthContexts) {
            if (context.sleepMinutes !== null) {
                sleepMinutesTotal += context.sleepMinutes;
                sleepCount++;
            }
            if (context.steps !== null) {
                stepsTotal += context.steps;
                stepsCount++;
            }
        }

        const avgSleep = sleepCount > 0 ? sleepMinutesTotal / sleepCount / 60 : 0;
        const avgSteps = stepsCount > 0 ? stepsTotal / stepsCount : 0;

        const moodCounts: Record<string, number> = {};
        for (const entry of entries) {
            if (entry.mood) {
                moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
            }
        }

        const dominantMood =
            Object.entries(moodCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || 'varied';

        const highlights: string[] = [];

        if (avgSleep >= 7 && avgSleep <= 8.5) {
            highlights.push('Great sleep consistency this week');
        } else if (avgSleep > 0 && avgSleep < 6) {
            highlights.push('Sleep was below optimal this week');
        }

        if (avgSteps >= 8000) {
            highlights.push('Strong activity levels maintained');
        }

        const insights = await this.generateHealthMoodInsights(userId, 7);
        if (insights.sleepMoodCorrelation) {
            highlights.push(insights.sleepMoodCorrelation);
        }

        return {
            title: 'Your Week in Review',
            summary: `This week you averaged ${avgSleep.toFixed(1)} hours of sleep and ${Math.round(avgSteps).toLocaleString()} steps per day. Your dominant mood was ${dominantMood}.`,
            highlights,
            data: {
                avgSleep: avgSleep.toFixed(1),
                avgSteps: Math.round(avgSteps),
                dominantMood,
                entriesCount: entries.length,
                daysTracked: healthContexts.length,
            },
        };
    }

    /**
     * Store a generated insight
     */
    async storeInsight(
        userId: string,
        type: string,
        title: string,
        description: string,
        data: InsightData | null,
        period: string
    ): Promise<void> {
        await prisma.healthInsight.create({
            data: {
                userId,
                type,
                title,
                description,
                data: data ? JSON.parse(JSON.stringify(data)) : undefined,
                period,
            },
        });
    }

    /**
     * Get recent insights for a user
     */
    async getRecentInsights(userId: string, limit: number = 5): Promise<any[]> {
        return prisma.healthInsight.findMany({
            where: { userId },
            orderBy: { generatedAt: 'desc' },
            take: limit,
        });
    }

    /**
     * Generate weekly insights for all users (called by cron)
     */
    async generateWeeklyInsightsForAllUsers(): Promise<void> {
        const connections = await prisma.googleFitConnection.findMany({
            select: { userId: true },
        });

        for (const { userId } of connections) {
            try {
                const summary = await this.generateWeeklySummary(userId);
                if (summary) {
                    await this.storeInsight(
                        userId,
                        'weekly_summary',
                        summary.title,
                        summary.summary,
                        { stats: summary.data, patterns: summary.highlights },
                        'week'
                    );
                }
            } catch (error) {
                console.error(`Failed to generate weekly insight for user ${userId}:`, error);
            }
        }
    }

    private addSleepSignals(
        signals: HealthPromptSignal[],
        currentContext: HealthContext,
        priorContexts: HealthContext[]
    ): void {
        const sleepHours = this.toSleepHours(currentContext.sleepMinutes);
        if (sleepHours === null) {
            return;
        }

        const baselineSleep = this.buildAdaptiveBaseline(
            priorContexts
                .map((context) => this.toSleepHours(context.sleepMinutes))
                .filter((value): value is number => value !== null),
            SLEEP_SCALE_FLOOR
        );
        const sleepAnomaly = baselineSleep ? this.getDirectionalAnomaly(sleepHours, baselineSleep) : null;
        const sleepDelta = baselineSleep ? sleepHours - baselineSleep.center : null;
        const qualityPenalty = currentContext.sleepQuality === 'poor'
            ? 0.22
            : currentContext.sleepQuality === 'fair'
                ? 0.12
                : 0;
        const qualityBoost = currentContext.sleepQuality === 'excellent'
            ? 0.16
            : currentContext.sleepQuality === 'good'
                ? 0.1
                : 0;
        const deficitProbability = this.clamp01(
            (sleepAnomaly?.belowProbability || 0) * 0.72 +
            (sleepHours < 5.5 ? 0.28 : sleepHours < 6.3 ? 0.18 : 0) +
            qualityPenalty
        );
        const recoveryProbability = this.clamp01(
            (sleepAnomaly?.aboveProbability || 0) * 0.72 +
            (sleepHours >= 8 ? 0.22 : sleepHours >= 7.2 ? 0.12 : 0) +
            qualityBoost
        );

        if (deficitProbability >= 0.42) {
            signals.push({
                kind: 'sleep_deficit',
                metric: 'sleep',
                score: this.toSignalScore(
                    deficitProbability,
                    sleepAnomaly?.confidence ?? this.getDataConfidence(priorContexts.length),
                    qualityPenalty > 0 ? 0.7 : 0
                ),
                title: 'Sleep recovery looks lighter than usual',
                summary:
                    sleepDelta !== null && sleepDelta <= -0.6
                        ? `You slept ${Math.abs(sleepDelta).toFixed(1)} hours less than your recent average.`
                        : 'Your sleep landed below your usual recovery range.',
                prompt: 'Your recovery looked lighter yesterday. What felt draining, and what would help you reset today?',
                currentValue: sleepHours,
                baselineValue: baselineSleep?.center ?? null,
                unit: 'hours',
                direction: 'below',
            });
        }

        if (recoveryProbability >= 0.42) {
            signals.push({
                kind: 'sleep_recovery',
                metric: 'sleep',
                score: this.toSignalScore(
                    recoveryProbability,
                    sleepAnomaly?.confidence ?? this.getDataConfidence(priorContexts.length),
                    qualityBoost > 0 ? 0.5 : 0
                ),
                title: 'Sleep recovery improved',
                summary:
                    sleepDelta !== null && sleepDelta >= 0.6
                        ? `You slept ${sleepDelta.toFixed(1)} hours more than your recent average.`
                        : 'You logged a stronger sleep window than usual.',
                prompt: 'You seemed to recover better yesterday. What helped you rest well, and how did it change your energy?',
                currentValue: sleepHours,
                baselineValue: baselineSleep?.center ?? null,
                unit: 'hours',
                direction: 'above',
            });
        }
    }

    private addActivitySignals(
        signals: HealthPromptSignal[],
        currentContext: HealthContext,
        priorContexts: HealthContext[]
    ): void {
        const currentLoad = this.getActivityLoad(currentContext.steps, currentContext.activeMinutes);
        if (currentLoad === null) {
            return;
        }

        const baselineLoad = this.buildAdaptiveBaseline(
            priorContexts
                .map((context) => this.getActivityLoad(context.steps, context.activeMinutes))
                .filter((value): value is number => value !== null),
            ACTIVITY_SCALE_FLOOR
        );
        const activityAnomaly = baselineLoad ? this.getDirectionalAnomaly(currentLoad, baselineLoad) : null;
        const activityDelta = baselineLoad ? currentLoad - baselineLoad.center : null;
        const metric = this.getPrimaryActivityMetric(currentContext, priorContexts);
        const boostProbability = this.clamp01(
            (activityAnomaly?.aboveProbability || 0) * 0.74 +
            (currentLoad >= 12 ? 0.22 : currentLoad >= 10 ? 0.1 : 0)
        );
        const dipProbability = this.clamp01(
            (activityAnomaly?.belowProbability || 0) * 0.74 +
            (currentLoad <= 4 ? 0.24 : currentLoad <= 6 ? 0.12 : 0)
        );

        if (boostProbability >= 0.4) {
            signals.push({
                kind: 'activity_boost',
                metric: 'activity',
                score: this.toSignalScore(
                    boostProbability,
                    activityAnomaly?.confidence ?? this.getDataConfidence(priorContexts.length),
                    currentContext.activeMinutes !== null && currentContext.activeMinutes >= 45 ? 0.6 : 0
                ),
                title: 'Movement was stronger than usual',
                summary:
                    activityDelta !== null && activityDelta >= 1.1
                        ? 'You moved noticeably more than your recent baseline.'
                        : 'Yesterday carried a stronger activity load than usual.',
                prompt: 'You were more active than usual yesterday. What gave you energy, and how did that momentum show up in the rest of your day?',
                currentValue: metric.currentValue,
                baselineValue: metric.baselineValue,
                unit: metric.unit,
                direction: 'above',
            });
        }

        if (dipProbability >= 0.4) {
            signals.push({
                kind: 'activity_dip',
                metric: 'activity',
                score: this.toSignalScore(
                    dipProbability,
                    activityAnomaly?.confidence ?? this.getDataConfidence(priorContexts.length),
                    currentContext.activeMinutes !== null && currentContext.activeMinutes < 15 ? 0.4 : 0
                ),
                title: 'Movement dipped below your normal pace',
                summary:
                    activityDelta !== null && activityDelta <= -1.1
                        ? 'You were quieter than your recent activity baseline.'
                        : 'Yesterday had noticeably lighter movement than usual.',
                prompt: 'Yesterday was lighter on movement than your usual pace. What got in the way, and how did that affect your focus or mood?',
                currentValue: metric.currentValue,
                baselineValue: metric.baselineValue,
                unit: metric.unit,
                direction: 'below',
            });
        }
    }

    private addRecoverySignals(
        signals: HealthPromptSignal[],
        currentContext: HealthContext,
        priorContexts: HealthContext[]
    ): void {
        const currentResting = currentContext.restingHeartRate;
        const currentAverage = currentContext.avgHeartRate;

        const baselineResting = this.buildAdaptiveBaseline(
            priorContexts
                .map((context) => context.restingHeartRate)
                .filter((value): value is number => value !== null),
            HEART_RATE_SCALE_FLOOR
        );
        const baselineAverage = this.buildAdaptiveBaseline(
            priorContexts
                .map((context) => context.avgHeartRate)
                .filter((value): value is number => value !== null),
            HEART_RATE_SCALE_FLOOR
        );

        const restingAnomaly =
            currentResting !== null && baselineResting
                ? this.getDirectionalAnomaly(currentResting, baselineResting)
                : null;
        const averageAnomaly =
            currentAverage !== null && baselineAverage
                ? this.getDirectionalAnomaly(currentAverage, baselineAverage)
                : null;
        const restingDelta =
            currentResting !== null && baselineResting ? currentResting - baselineResting.center : null;
        const averageDelta =
            currentAverage !== null && baselineAverage ? currentAverage - baselineAverage.center : null;
        const sleepHours = this.toSleepHours(currentContext.sleepMinutes);
        const poorSleep = sleepHours !== null && sleepHours < 6.5;
        const combinedRecoveryProbability = this.clamp01(
            1 -
            (1 - Math.min(1, (restingAnomaly?.aboveProbability || 0) * 0.95)) *
            (1 - Math.min(1, (averageAnomaly?.aboveProbability || 0) * 0.7)) +
            (poorSleep ? 0.12 : 0)
        );

        if (combinedRecoveryProbability >= 0.42) {
            signals.push({
                kind: 'recovery_strain',
                metric: 'recovery',
                score: this.toSignalScore(
                    combinedRecoveryProbability,
                    Math.max(
                        restingAnomaly?.confidence || 0,
                        averageAnomaly?.confidence || 0,
                        this.getDataConfidence(priorContexts.length)
                    ),
                    poorSleep ? 0.5 : 0
                ),
                title: 'Your recovery markers look elevated',
                summary:
                    restingDelta !== null && restingDelta >= 2
                        ? `Resting heart rate was up ${Math.round(restingDelta)} bpm from your recent baseline.`
                        : averageDelta !== null && averageDelta >= 4
                            ? `Average heart rate ran about ${Math.round(averageDelta)} bpm above your recent range.`
                        : 'Heart-rate signals suggest yesterday may have carried a little more strain.',
                prompt: 'Your recovery markers looked a little elevated yesterday. What felt demanding physically or mentally, and what do you want to protect today?',
                currentValue: currentResting ?? currentAverage,
                baselineValue: baselineResting?.center ?? baselineAverage?.center ?? null,
                unit: 'bpm',
                direction: 'above',
            });
        }
    }

    private addConsistencySignal(signals: HealthPromptSignal[], contexts: HealthContext[]): void {
        const streak = this.calculateConsistencyStreak(contexts);
        const recentWindow = contexts.slice(-7);
        const consistencyRate = recentWindow.length > 0
            ? recentWindow.reduce((count, context) => {
                const sleepHours = this.toSleepHours(context.sleepMinutes);
                const activityLoad = this.getActivityLoad(context.steps, context.activeMinutes);
                return count + (((sleepHours !== null && sleepHours >= 7) || (activityLoad !== null && activityLoad >= 9)) ? 1 : 0);
            }, 0) / recentWindow.length
            : 0;

        if (streak < 3 && consistencyRate < 0.72) {
            return;
        }

        const consistencyProbability = this.clamp01(
            Math.max(
                (streak - 2) / 5,
                (consistencyRate - 0.55) / 0.35
            )
        );

        signals.push({
            kind: 'consistency_streak',
            metric: 'recovery',
            score: this.toSignalScore(
                consistencyProbability,
                this.getDataConfidence(recentWindow.length),
                streak >= 5 ? 0.6 : 0
            ),
            title: 'You are building a steady rhythm',
            summary: streak >= 3
                ? `You have put together ${streak} days of solid sleep or movement consistency.`
                : `You hit a strong consistency rate across the last ${recentWindow.length} tracked days.`,
            prompt: 'You have been building a healthy rhythm lately. What habits are helping, and what is worth repeating this week?',
            currentValue: streak,
            baselineValue: null,
            unit: null,
            direction: 'steady',
        });
    }

    private calculateConsistencyStreak(contexts: HealthContext[]): number {
        let streak = 0;

        for (let index = contexts.length - 1; index >= 0; index -= 1) {
            const context = contexts[index];
            const sleepHours = this.toSleepHours(context.sleepMinutes);
            const activityLoad = this.getActivityLoad(context.steps, context.activeMinutes);
            const isConsistentDay =
                (sleepHours !== null && sleepHours >= 7) || (activityLoad !== null && activityLoad >= 9);

            if (!isConsistentDay) {
                break;
            }

            streak++;
        }

        return streak;
    }

    private getPrimaryActivityMetric(
        currentContext: HealthContext,
        priorContexts: HealthContext[]
    ): {
        currentValue: number | null;
        baselineValue: number | null;
        unit: 'steps' | 'minutes';
    } {
        if (currentContext.activeMinutes !== null) {
            const baselineActiveMinutes = this.buildAdaptiveBaseline(
                priorContexts
                    .map((context) => context.activeMinutes)
                    .filter((value): value is number => value !== null),
                8
            );

            return {
                currentValue: currentContext.activeMinutes,
                baselineValue: baselineActiveMinutes?.center ?? null,
                unit: 'minutes',
            };
        }

        const baselineSteps = this.buildAdaptiveBaseline(
            priorContexts
                .map((context) => context.steps)
                .filter((value): value is number => value !== null),
            900
        );

        return {
            currentValue: currentContext.steps,
            baselineValue: baselineSteps?.center ?? null,
            unit: 'steps',
        };
    }

    private getActivityLoad(steps: number | null, activeMinutes: number | null): number | null {
        if (steps === null && activeMinutes === null) {
            return null;
        }

        const normalizedSteps = steps !== null ? steps / 1000 : 0;
        const normalizedActiveMinutes = activeMinutes !== null ? activeMinutes / 10 : 0;
        return Math.round((normalizedSteps + normalizedActiveMinutes) * 10) / 10;
    }

    private buildAdaptiveBaseline(values: number[], floorScale: number): AdaptiveBaseline | null {
        if (values.length === 0) {
            return null;
        }

        const weights = values.map((_, index) =>
            Math.pow(0.5, (values.length - 1 - index) / BASELINE_HALF_LIFE_DAYS)
        );
        const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
        const weightedMean = values.reduce((sum, value, index) => sum + (value * weights[index]), 0) / weightTotal;
        const weightedVariance = values.reduce(
            (sum, value, index) => sum + (weights[index] * Math.pow(value - weightedMean, 2)),
            0
        ) / weightTotal;

        const median = this.median(values);
        const mad = this.median(values.map((value) => Math.abs(value - median)));
        const scale = Math.max(
            mad * 1.4826,
            Math.sqrt(weightedVariance),
            floorScale
        );

        return {
            center: values.length >= MIN_BASELINE_SAMPLE_SIZE
                ? (weightedMean * 0.7) + (median * 0.3)
                : weightedMean,
            scale,
            mean: weightedMean,
            sampleSize: values.length,
        };
    }

    private getDirectionalAnomaly(value: number, baseline: AdaptiveBaseline): DirectionalAnomaly {
        const safeScale = baseline.scale > 0 ? baseline.scale : 1;
        const zScore = (value - baseline.center) / safeScale;
        const percentile = this.normalCdf(zScore);

        return {
            zScore,
            percentile,
            aboveProbability: this.clamp01(Math.max(0, (percentile - 0.5) * 2)),
            belowProbability: this.clamp01(Math.max(0, (0.5 - percentile) * 2)),
            confidence: this.getDataConfidence(baseline.sampleSize),
            center: baseline.center,
        };
    }

    private toSignalScore(probability: number, confidence: number, bonus: number = 0): number {
        const rawScore = (probability * 6.6) + (confidence * 2.2) + bonus;
        return Math.round(Math.min(10, Math.max(0, rawScore)) * 10) / 10;
    }

    private getDataConfidence(sampleSize: number): number {
        return this.clamp01(sampleSize / 6);
    }

    private clamp01(value: number): number {
        return Math.max(0, Math.min(1, value));
    }

    private toSleepHours(sleepMinutes: number | null): number | null {
        if (sleepMinutes === null) {
            return null;
        }

        return Math.round((sleepMinutes / 60) * 10) / 10;
    }

    private computeSpearmanCorrelation(pairs: MetricMoodPair[]): number | null {
        if (pairs.length < 5) {
            return null;
        }

        const metricRanks = this.rankValues(pairs.map((pair) => pair.metricValue));
        const moodRanks = this.rankValues(pairs.map((pair) => pair.moodScore));
        return this.computePearsonCorrelation(metricRanks, moodRanks);
    }

    private rankValues(values: number[]): number[] {
        const sorted = values
            .map((value, index) => ({ value, index }))
            .sort((left, right) => left.value - right.value);
        const ranks = new Array<number>(values.length);

        let start = 0;
        while (start < sorted.length) {
            let end = start + 1;
            while (end < sorted.length && sorted[end].value === sorted[start].value) {
                end++;
            }

            const averageRank = ((start + 1) + end) / 2;
            for (let cursor = start; cursor < end; cursor += 1) {
                ranks[sorted[cursor].index] = averageRank;
            }

            start = end;
        }

        return ranks;
    }

    private computePearsonCorrelation(left: number[], right: number[]): number | null {
        if (left.length !== right.length || left.length < 2) {
            return null;
        }

        const leftMean = this.average(left);
        const rightMean = this.average(right);
        if (leftMean === null || rightMean === null) {
            return null;
        }

        let numerator = 0;
        let leftVariance = 0;
        let rightVariance = 0;

        for (let index = 0; index < left.length; index += 1) {
            const leftDelta = left[index] - leftMean;
            const rightDelta = right[index] - rightMean;
            numerator += leftDelta * rightDelta;
            leftVariance += leftDelta * leftDelta;
            rightVariance += rightDelta * rightDelta;
        }

        if (leftVariance === 0 || rightVariance === 0) {
            return null;
        }

        return numerator / Math.sqrt(leftVariance * rightVariance);
    }

    private median(values: number[]): number {
        const sorted = [...values].sort((left, right) => left - right);
        const midpoint = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
        }

        return sorted[midpoint];
    }

    private normalCdf(value: number): number {
        return 0.5 * (1 + this.errorFunction(value / Math.sqrt(2)));
    }

    private errorFunction(value: number): number {
        const sign = value < 0 ? -1 : 1;
        const absolute = Math.abs(value);
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;
        const t = 1 / (1 + (p * absolute));
        const polynomial =
            (((((a5 * t) + a4) * t) + a3) * t + a2) * t + a1;
        const approximation = 1 - (polynomial * t * Math.exp(-(absolute * absolute)));
        return sign * approximation;
    }

    private average(values: number[]): number | null {
        if (values.length === 0) {
            return null;
        }

        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    private getDateKey(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Convert mood to numeric score for correlation analysis
     */
    private getMoodScore(mood: string): number {
        const scores: Record<string, number> = {
            happy: 5,
            motivated: 4.5,
            calm: 4,
            thoughtful: 3.5,
            tired: 2.5,
            anxious: 2,
            frustrated: 1.5,
            sad: 1,
        };
        return scores[mood] || 3;
    }
}

export const healthInsightsService = new HealthInsightsService();
export default healthInsightsService;
