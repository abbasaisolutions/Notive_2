// Health Sync Service - Daily sync and health data management
// File: backend/src/services/health-sync.service.ts

import prisma from '../config/prisma';
import { googleFitOAuthService } from './googlefit-oauth.service';
import { googleFitApiService, DailyHealthData } from './googlefit-api.service';

export interface HealthContextSummary {
    date: Date;
    sleepHours: number | null;
    sleepQuality: string | null;
    steps: number | null;
    activityLevel: 'low' | 'moderate' | 'high' | null;
    avgHeartRate: number | null;
}

export class HealthSyncService {
    /**
     * Sync health data for a specific user
     */
    async syncUserHealth(userId: string): Promise<boolean> {
        try {
            // Get valid access token
            const accessToken = await googleFitOAuthService.getValidAccessToken(userId);
            if (!accessToken) {
                console.log(`No valid Google Fit token for user ${userId}`);
                return false;
            }

            // Fetch yesterday's data
            const healthData = await googleFitApiService.fetchYesterdayData(accessToken);
            
            // Store the data
            await this.storeHealthContext(userId, healthData);

            // Update last sync timestamp
            await googleFitOAuthService.updateLastSync(userId);

            console.log(`Successfully synced health data for user ${userId}`);
            return true;
        } catch (error) {
            console.error(`Failed to sync health data for user ${userId}:`, error);
            return false;
        }
    }

    /**
     * Store health context data
     */
    async storeHealthContext(userId: string, data: DailyHealthData): Promise<void> {
        // Normalize the date to start of day
        const date = new Date(data.date);
        date.setHours(0, 0, 0, 0);

        await prisma.healthContext.upsert({
            where: {
                userId_date: {
                    userId,
                    date,
                },
            },
            update: {
                sleepMinutes: data.sleepMinutes,
                sleepQuality: data.sleepQuality,
                steps: data.steps,
                activeMinutes: data.activeMinutes,
                caloriesBurned: data.caloriesBurned,
                avgHeartRate: data.avgHeartRate,
                restingHeartRate: data.restingHeartRate,
                syncedAt: new Date(),
            },
            create: {
                userId,
                date,
                sleepMinutes: data.sleepMinutes,
                sleepQuality: data.sleepQuality,
                steps: data.steps,
                activeMinutes: data.activeMinutes,
                caloriesBurned: data.caloriesBurned,
                avgHeartRate: data.avgHeartRate,
                restingHeartRate: data.restingHeartRate,
            },
        });
    }

    /**
     * Sync all connected users (for cron job)
     */
    async syncAllUsers(): Promise<{ success: number; failed: number }> {
        const connections = await prisma.googleFitConnection.findMany({
            select: { userId: true },
        });

        let success = 0;
        let failed = 0;

        for (const connection of connections) {
            const result = await this.syncUserHealth(connection.userId);
            if (result) {
                success++;
            } else {
                failed++;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`Health sync completed: ${success} success, ${failed} failed`);
        return { success, failed };
    }

    /**
     * Backfill health data for a user (initial sync or gap filling)
     */
    async backfillUserHealth(userId: string, days: number = 30): Promise<number> {
        const accessToken = await googleFitOAuthService.getValidAccessToken(userId);
        if (!accessToken) {
            throw new Error('No valid Google Fit connection');
        }

        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 1); // Start from yesterday

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        let synced = 0;
        const current = new Date(startDate);

        while (current <= endDate) {
            try {
                const healthData = await googleFitApiService.fetchDailyData(accessToken, new Date(current));
                await this.storeHealthContext(userId, healthData);
                synced++;
            } catch (error) {
                console.error(`Failed to sync day ${current.toISOString()}:`, error);
            }
            current.setDate(current.getDate() + 1);
        }

        await googleFitOAuthService.updateLastSync(userId);
        return synced;
    }

    /**
     * Get health context for a specific date
     */
    async getHealthContextForDate(userId: string, date: Date): Promise<HealthContextSummary | null> {
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);

        const context = await prisma.healthContext.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: normalizedDate,
                },
            },
        });

        if (!context) {
            return null;
        }

        return {
            date: context.date,
            sleepHours: context.sleepMinutes ? Math.round(context.sleepMinutes / 60 * 10) / 10 : null,
            sleepQuality: context.sleepQuality,
            steps: context.steps,
            activityLevel: this.categorizeActivityLevel(context.steps, context.activeMinutes),
            avgHeartRate: context.avgHeartRate,
        };
    }

    /**
     * Get health context for a date range
     */
    async getHealthContextRange(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<HealthContextSummary[]> {
        const contexts = await prisma.healthContext.findMany({
            where: {
                userId,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { date: 'asc' },
        });

        return contexts.map(context => ({
            date: context.date,
            sleepHours: context.sleepMinutes ? Math.round(context.sleepMinutes / 60 * 10) / 10 : null,
            sleepQuality: context.sleepQuality,
            steps: context.steps,
            activityLevel: this.categorizeActivityLevel(context.steps, context.activeMinutes),
            avgHeartRate: context.avgHeartRate,
        }));
    }

    /**
     * Get health context for today's entry writing
     */
    async getTodayHealthContext(userId: string): Promise<HealthContextSummary | null> {
        // For today's entry, we show yesterday's health data (complete day)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return this.getHealthContextForDate(userId, yesterday);
    }

    /**
     * Categorize activity level based on steps and active minutes
     */
    private categorizeActivityLevel(
        steps: number | null,
        activeMinutes: number | null
    ): 'low' | 'moderate' | 'high' | null {
        if (steps === null && activeMinutes === null) {
            return null;
        }

        // Scoring based on WHO recommendations
        // Low: < 5000 steps or < 15 active minutes
        // Moderate: 5000-10000 steps or 15-30 active minutes
        // High: > 10000 steps or > 30 active minutes

        let score = 0;

        if (steps !== null) {
            if (steps >= 10000) score += 2;
            else if (steps >= 5000) score += 1;
        }

        if (activeMinutes !== null) {
            if (activeMinutes >= 30) score += 2;
            else if (activeMinutes >= 15) score += 1;
        }

        if (score >= 3) return 'high';
        if (score >= 1) return 'moderate';
        return 'low';
    }

    /**
     * Get health statistics for a period (for insights)
     */
    async getHealthStats(userId: string, days: number = 30): Promise<{
        avgSleepHours: number | null;
        avgSteps: number | null;
        avgHeartRate: number | null;
        daysWithData: number;
        sleepTrend: 'improving' | 'declining' | 'stable';
        activityTrend: 'improving' | 'declining' | 'stable';
    }> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const contexts = await prisma.healthContext.findMany({
            where: {
                userId,
                date: { gte: startDate },
            },
            orderBy: { date: 'asc' },
        });

        if (contexts.length === 0) {
            return {
                avgSleepHours: null,
                avgSteps: null,
                avgHeartRate: null,
                daysWithData: 0,
                sleepTrend: 'stable',
                activityTrend: 'stable',
            };
        }

        // Calculate averages
        const sleepValues = contexts.map(c => c.sleepMinutes).filter((v): v is number => v !== null);
        const stepValues = contexts.map(c => c.steps).filter((v): v is number => v !== null);
        const heartRateValues = contexts.map(c => c.avgHeartRate).filter((v): v is number => v !== null);

        const avgSleepHours = sleepValues.length > 0
            ? Math.round(sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length / 60 * 10) / 10
            : null;

        const avgSteps = stepValues.length > 0
            ? Math.round(stepValues.reduce((a, b) => a + b, 0) / stepValues.length)
            : null;

        const avgHeartRate = heartRateValues.length > 0
            ? Math.round(heartRateValues.reduce((a, b) => a + b, 0) / heartRateValues.length)
            : null;

        // Calculate trends (compare first half vs second half)
        const midpoint = Math.floor(contexts.length / 2);
        const firstHalf = contexts.slice(0, midpoint);
        const secondHalf = contexts.slice(midpoint);

        const sleepTrend = this.calculateTrend(
            firstHalf.map(c => c.sleepMinutes).filter((v): v is number => v !== null),
            secondHalf.map(c => c.sleepMinutes).filter((v): v is number => v !== null)
        );

        const activityTrend = this.calculateTrend(
            firstHalf.map(c => c.steps).filter((v): v is number => v !== null),
            secondHalf.map(c => c.steps).filter((v): v is number => v !== null)
        );

        return {
            avgSleepHours,
            avgSteps,
            avgHeartRate,
            daysWithData: contexts.length,
            sleepTrend,
            activityTrend,
        };
    }

    /**
     * Calculate trend from two sets of values
     */
    private calculateTrend(
        firstValues: number[],
        secondValues: number[]
    ): 'improving' | 'declining' | 'stable' {
        if (firstValues.length === 0 || secondValues.length === 0) {
            return 'stable';
        }

        const firstAvg = firstValues.reduce((a, b) => a + b, 0) / firstValues.length;
        const secondAvg = secondValues.reduce((a, b) => a + b, 0) / secondValues.length;

        const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

        if (percentChange > 10) return 'improving';
        if (percentChange < -10) return 'declining';
        return 'stable';
    }

    /**
     * Delete all health data for a user (for privacy/GDPR)
     */
    async deleteUserHealthData(userId: string): Promise<void> {
        await prisma.healthContext.deleteMany({
            where: { userId },
        });

        await prisma.healthInsight.deleteMany({
            where: { userId },
        });
    }
}

export const healthSyncService = new HealthSyncService();
export default healthSyncService;
