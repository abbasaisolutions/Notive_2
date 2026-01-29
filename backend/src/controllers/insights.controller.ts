// Analytics Controller - Smart insights and pattern detection endpoints
// File: backend/src/controllers/insights.controller.ts

import { Request, Response } from 'express';
import prisma from '../config/prisma';
import nlpService from '../services/nlp.service';
import { healthInsightsService } from '../services/health-insights.service';
import { healthSyncService } from '../services/health-sync.service';
import { googleFitOAuthService } from '../services/googlefit-oauth.service';

class InsightsController {
    /**
     * Get AI-generated insights for user's entries
     * GET /api/v1/analytics/insights
     */
    async getInsights(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.userId;
            const period = req.query.period as string || 'month';

            // Calculate date range
            const now = new Date();
            const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;
            const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

            // Fetch entries
            const entries = await prisma.entry.findMany({
                where: {
                    userId,
                    createdAt: { gte: cutoff },
                    deletedAt: null,
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    content: true,
                    mood: true,
                    tags: true,
                    createdAt: true,
                    skills: true,
                    lessons: true,
                },
            });

            // Generate NLP insights
            const nlpInsights = await nlpService.generateInsights(
                entries.map(e => ({
                    content: e.content,
                    mood: e.mood || undefined,
                    createdAt: e.createdAt,
                    skills: e.skills || undefined, /* skills are string[] ?? */
                    lessons: e.lessons || undefined /* lessons are string[] ?? */
                    // Check if skills/lessons exist on Entry type 
                }))
            );

            // Calculate additional stats
            const moodDistribution: Record<string, number> = {};
            const tagCounts: Record<string, number> = {};
            let totalWords = 0;

            for (const entry of entries) {
                // Mood stats
                if (entry.mood) {
                    moodDistribution[entry.mood] = (moodDistribution[entry.mood] || 0) + 1;
                }

                // Tag stats
                for (const tag of entry.tags || []) {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                }

                // Word count
                totalWords += entry.content.split(/\s+/).length;
            }

            // Calculate writing consistency (entries per week)
            const weeksInPeriod = periodDays / 7;
            const entriesPerWeek = entries.length / weeksInPeriod;

            return res.json({
                insights: {
                    ...nlpInsights,
                    entryCount: entries.length,
                    totalWords,
                    averageWordsPerEntry: Math.round(totalWords / (entries.length || 1)),
                    entriesPerWeek: Math.round(entriesPerWeek * 10) / 10,
                    moodDistribution: Object.entries(moodDistribution)
                        .map(([mood, count]) => ({ mood, count, percentage: Math.round((count / entries.length) * 100) }))
                        .sort((a, b) => b.count - a.count),
                    topTags: Object.entries(tagCounts)
                        .map(([tag, count]) => ({ tag, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 10),
                },
                period,
                generatedAt: new Date().toISOString(),
            });
        } catch (error: any) {
            console.error('Insights error:', error);
            return res.status(500).json({ message: 'Failed to generate insights' });
        }
    }

    /**
     * Get comprehensive insights including health correlations
     * GET /api/v1/analytics/comprehensive-insights
     */
    async getComprehensiveInsights(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.userId;
            const period = req.query.period as string || 'month';
            const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 365;

            // Check if user has Google Fit connected
            const hasHealthData = await googleFitOAuthService.isConnected(userId);

            // Get base insights
            const now = new Date();
            const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

            const entries = await prisma.entry.findMany({
                where: {
                    userId,
                    createdAt: { gte: cutoff },
                    deletedAt: null,
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    content: true,
                    mood: true,
                    tags: true,
                    createdAt: true,
                },
            });

            // Get NLP insights
            const nlpInsights = await nlpService.generateInsights(
                entries.map(e => ({
                    content: e.content,
                    mood: e.mood || undefined,
                    createdAt: e.createdAt,
                }))
            );

            // Get health insights if available
            let healthInsights = null;
            let healthStats = null;

            if (hasHealthData) {
                try {
                    healthInsights = await healthInsightsService.generateHealthMoodInsights(userId, periodDays);
                    healthStats = await healthSyncService.getHealthStats(userId, periodDays);
                } catch (error) {
                    console.warn('Could not get health insights:', error);
                }
            }

            // Build combined insights
            const combinedInsights: string[] = [];
            
            // Add mood trends
            if (nlpInsights.moodTrend === 'improving') {
                combinedInsights.push('Your overall mood has been improving lately. Keep up whatever you\'re doing!');
            } else if (nlpInsights.moodTrend === 'declining') {
                combinedInsights.push('Your mood has been trending down. Consider what factors might be contributing.');
            }

            // Add health correlations
            if (healthInsights?.sleepMoodCorrelation) {
                combinedInsights.push(healthInsights.sleepMoodCorrelation);
            }
            if (healthInsights?.activityMoodCorrelation) {
                combinedInsights.push(healthInsights.activityMoodCorrelation);
            }

            // Add health-based recommendations
            if (healthStats && healthStats.avgSleepHours !== null && healthStats.avgSleepHours < 6.5) {
                combinedInsights.push('Your average sleep has been lower than recommended. Quality rest can significantly impact mood.');
            }

            return res.json({
                insights: {
                    ...nlpInsights,
                    entryCount: entries.length,
                    combinedInsights,
                },
                healthData: hasHealthData ? {
                    connected: true,
                    stats: healthStats,
                    correlations: healthInsights ? {
                        sleepMood: healthInsights.sleepMoodCorrelation,
                        activityMood: healthInsights.activityMoodCorrelation,
                    } : null,
                    patterns: healthInsights?.patterns || [],
                    recommendations: healthInsights?.recommendations || [],
                } : {
                    connected: false,
                    message: 'Connect Google Fit to see health-mood correlations',
                },
                period,
                generatedAt: new Date().toISOString(),
            });
        } catch (error: any) {
            console.error('Comprehensive insights error:', error);
            return res.status(500).json({ message: 'Failed to generate comprehensive insights' });
        }
    }

    /**
     * Analyze a single entry
     * POST /api/v1/analytics/analyze
     */
    async analyzeEntry(req: Request, res: Response) {
        try {
            const { content, title } = req.body;

            if (!content) {
                return res.status(400).json({ message: 'Content is required' });
            }

            const fullText = title ? `${title}. ${content}` : content;
            const analysis = await nlpService.analyzeContent(fullText);

            return res.json({
                analysis,
                suggestions: {
                    mood: analysis.suggestedMood,
                    tags: analysis.topics,
                },
            });
        } catch (error: any) {
            console.error('Analysis error:', error);
            return res.status(500).json({ message: 'Failed to analyze content' });
        }
    }

    /**
     * Get pattern detection for user
     * GET /api/v1/analytics/patterns
     */
    async getPatterns(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.userId;

            // Get entries from last 30 days
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const entries = await prisma.entry.findMany({
                where: {
                    userId,
                    createdAt: { gte: thirtyDaysAgo },
                    deletedAt: null,
                },
                orderBy: { createdAt: 'asc' },
                select: {
                    mood: true,
                    createdAt: true,
                },
            });

            // Analyze writing time patterns
            const hourCounts: Record<number, number> = {};
            const dayCounts: Record<number, number> = {};

            for (const entry of entries) {
                const date = new Date(entry.createdAt);
                const hour = date.getHours();
                const day = date.getDay();

                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
                dayCounts[day] = (dayCounts[day] || 0) + 1;
            }

            // Find best writing time
            const peakHour = Object.entries(hourCounts)
                .sort((a, b) => b[1] - a[1])[0];

            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const peakDay = Object.entries(dayCounts)
                .sort((a, b) => b[1] - a[1])[0];

            // Mood by day of week
            const moodByDay: Record<number, { total: number; count: number }> = {};
            for (const entry of entries) {
                if (entry.mood) {
                    const day = new Date(entry.createdAt).getDay();
                    if (!moodByDay[day]) moodByDay[day] = { total: 0, count: 0 };
                    moodByDay[day].total += this.getMoodScore(entry.mood);
                    moodByDay[day].count++;
                }
            }

            const moodPatterns = Object.entries(moodByDay).map(([day, data]) => ({
                day: dayNames[parseInt(day)],
                averageMood: Math.round((data.total / data.count) * 10) / 10,
            }));

            return res.json({
                patterns: {
                    bestWritingTime: peakHour ? {
                        hour: parseInt(peakHour[0]),
                        label: this.formatHour(parseInt(peakHour[0])),
                        entries: peakHour[1],
                    } : null,
                    bestWritingDay: peakDay ? {
                        day: dayNames[parseInt(peakDay[0])],
                        entries: peakDay[1],
                    } : null,
                    moodByDay: moodPatterns,
                    totalEntriesAnalyzed: entries.length,
                },
            });
        } catch (error: any) {
            console.error('Patterns error:', error);
            return res.status(500).json({ message: 'Failed to detect patterns' });
        }
    }

    private getMoodScore(mood: string): number {
        const scores: Record<string, number> = {
            happy: 9, grateful: 9, motivated: 8, hopeful: 8,
            calm: 7, thoughtful: 6, neutral: 5,
            tired: 4, anxious: 3, sad: 2, angry: 2,
        };
        return scores[mood] || 5;
    }

    private formatHour(hour: number): string {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:00 ${period}`;
    }
}

export default new InsightsController();
