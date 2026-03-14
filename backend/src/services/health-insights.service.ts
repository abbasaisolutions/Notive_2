// Health Insights Service - AI-powered correlations between health and journal data
// File: backend/src/services/health-insights.service.ts

import prisma from '../config/prisma';
import OpenAI from 'openai';
import { healthSyncService } from './health-sync.service';

const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

interface MoodHealthCorrelation {
    sleepHours: number;
    mood: string;
    date: Date;
}

interface InsightData {
    correlations?: {
        sleepMood?: { sleep: string; moodImprovement: number };
        activityMood?: { activity: string; moodImprovement: number };
    };
    stats?: Record<string, any>;
    patterns?: string[];
}

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
        // Get health data
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const healthContexts = await prisma.healthContext.findMany({
            where: {
                userId,
                date: { gte: startDate, lte: endDate },
            },
            orderBy: { date: 'asc' },
        });

        // Get entries with moods for the same period
        const entries = await prisma.entry.findMany({
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
        });

        // Match health data with mood data by date
        const correlations: MoodHealthCorrelation[] = [];

        for (const health of healthContexts) {
            const healthDate = health.date.toISOString().split('T')[0];
            
            // Find entries on the same day
            const dayEntries = entries.filter(e => {
                const entryDate = e.createdAt.toISOString().split('T')[0];
                return entryDate === healthDate;
            });

            for (const entry of dayEntries) {
                if (entry.mood && health.sleepMinutes) {
                    correlations.push({
                        sleepHours: health.sleepMinutes / 60,
                        mood: entry.mood,
                        date: entry.createdAt,
                    });
                }
            }
        }

        const patterns: string[] = [];
        const recommendations: string[] = [];
        let sleepMoodCorrelation: string | null = null;
        let activityMoodCorrelation: string | null = null;

        if (correlations.length >= 5) {
            // Analyze sleep-mood correlation
            const goodSleepMoods = correlations
                .filter(c => c.sleepHours >= 7)
                .map(c => this.getMoodScore(c.mood));
            
            const poorSleepMoods = correlations
                .filter(c => c.sleepHours < 6)
                .map(c => this.getMoodScore(c.mood));

            if (goodSleepMoods.length > 0 && poorSleepMoods.length > 0) {
                const goodSleepAvg = goodSleepMoods.reduce((a, b) => a + b, 0) / goodSleepMoods.length;
                const poorSleepAvg = poorSleepMoods.reduce((a, b) => a + b, 0) / poorSleepMoods.length;

                if (goodSleepAvg > poorSleepAvg + 0.5) {
                    sleepMoodCorrelation = `Your mood tends to be more positive on days with 7+ hours of sleep.`;
                    patterns.push('Sleep duration correlates with mood improvement');
                    recommendations.push('Aim for 7-8 hours of sleep to support your emotional wellbeing');
                }
            }

            // Analyze activity-mood correlation
            const healthWithMood = healthContexts.map(h => {
                const healthDate = h.date.toISOString().split('T')[0];
                const dayEntry = entries.find(e => e.createdAt.toISOString().split('T')[0] === healthDate);
                return { ...h, mood: dayEntry?.mood };
            }).filter(h => h.mood);

            const activeHighMoods = healthWithMood
                .filter(h => (h.steps || 0) >= 8000)
                .map(h => this.getMoodScore(h.mood!));

            const sedentaryMoods = healthWithMood
                .filter(h => (h.steps || 0) < 3000)
                .map(h => this.getMoodScore(h.mood!));

            if (activeHighMoods.length > 0 && sedentaryMoods.length > 0) {
                const activeAvg = activeHighMoods.reduce((a, b) => a + b, 0) / activeHighMoods.length;
                const sedentaryAvg = sedentaryMoods.reduce((a, b) => a + b, 0) / sedentaryMoods.length;

                if (activeAvg > sedentaryAvg + 0.5) {
                    activityMoodCorrelation = `Higher activity days tend to coincide with more positive moods.`;
                    patterns.push('Physical activity correlates with improved mood');
                    recommendations.push('Consider light exercise or walks on days you feel down');
                }
            }
        }

        // Add general patterns based on data
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
     * Generate AI-powered insight for an entry based on health context
     */
    async generateEntryHealthInsight(
        content: string,
        mood: string | null,
        healthContext: {
            sleepHours: number | null;
            activityLevel: string | null;
            avgHeartRate: number | null;
        }
    ): Promise<string | null> {
        if (!openai || (!healthContext.sleepHours && !healthContext.activityLevel)) {
            return null;
        }

        // Only generate insight if there's something notable
        const sleepLow = healthContext.sleepHours !== null && healthContext.sleepHours < 6;
        const sleepHigh = healthContext.sleepHours !== null && healthContext.sleepHours > 9;
        const activityLow = healthContext.activityLevel === 'low';
        const negMood = mood && ['sad', 'anxious', 'frustrated', 'tired'].includes(mood);

        if (!sleepLow && !sleepHigh && !activityLow && !negMood) {
            return null; // No notable pattern
        }

        try {
            const healthSummary = [
                healthContext.sleepHours ? `${healthContext.sleepHours} hours of sleep` : null,
                healthContext.activityLevel ? `${healthContext.activityLevel} activity level` : null,
            ].filter(Boolean).join(', ');

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are a gentle, supportive journaling assistant. Given health context and a mood, provide a brief, non-medical observation (1 sentence max) about potential connections. 

RULES:
- Never give medical advice or diagnoses
- Use words like "may have", "might", "could"
- Be supportive, not prescriptive
- Only mention patterns, not causes
- If uncertain, return null`
                    },
                    {
                        role: 'user',
                        content: `Health context: ${healthSummary}
Mood: ${mood || 'not specified'}
Generate a brief, gentle observation about how today's health context might relate to the mood, or return "null" if no clear connection.`
                    }
                ],
                max_tokens: 100,
                temperature: 0.5,
            });

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

        // Get week's health data
        const healthContexts = await prisma.healthContext.findMany({
            where: {
                userId,
                date: { gte: startDate, lte: endDate },
            },
        });

        // Get week's entries
        const entries = await prisma.entry.findMany({
            where: {
                userId,
                createdAt: { gte: startDate, lte: endDate },
                deletedAt: null,
            },
            select: {
                mood: true,
                createdAt: true,
            },
        });

        if (healthContexts.length < 3 || entries.length < 2) {
            return null; // Not enough data
        }

        // Calculate averages
        const avgSleep = healthContexts
            .filter(h => h.sleepMinutes)
            .reduce((sum, h) => sum + (h.sleepMinutes || 0), 0) / 
            healthContexts.filter(h => h.sleepMinutes).length / 60;

        const avgSteps = healthContexts
            .filter(h => h.steps)
            .reduce((sum, h) => sum + (h.steps || 0), 0) /
            healthContexts.filter(h => h.steps).length;

        // Count moods
        const moodCounts: Record<string, number> = {};
        entries.forEach(e => {
            if (e.mood) {
                moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
            }
        });

        const dominantMood = Object.entries(moodCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'varied';

        const highlights: string[] = [];
        
        if (avgSleep >= 7 && avgSleep <= 8.5) {
            highlights.push('Great sleep consistency this week');
        } else if (avgSleep < 6) {
            highlights.push('Sleep was below optimal this week');
        }

        if (avgSteps >= 8000) {
            highlights.push('Strong activity levels maintained');
        }

        // Generate insight
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
