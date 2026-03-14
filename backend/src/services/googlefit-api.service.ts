// Google Fit API Service - Fetches aggregated health data from Google Fit
// File: backend/src/services/googlefit-api.service.ts

import axios from 'axios';

// Google Fit API base URL
const FITNESS_API_BASE = 'https://www.googleapis.com/fitness/v1/users/me';

// Data source types we're interested in
const DATA_SOURCES = {
    STEPS: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
    CALORIES: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
    HEART_RATE: 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm',
    ACTIVITY: 'derived:com.google.activity.segment:com.google.android.gms:merge_activity_segments',
    SLEEP: 'derived:com.google.sleep.segment:com.google.android.gms:merged',
};

// Activity types for sleep (from Google Fit API)
const SLEEP_ACTIVITY_TYPES = {
    SLEEPING: 72,           // General sleep
    SLEEP_LIGHT: 109,       // Light sleep
    SLEEP_DEEP: 110,        // Deep sleep
    SLEEP_REM: 111,         // REM sleep
    SLEEP_AWAKE: 112,       // Awake during sleep period
};

// Activity types for moderate/vigorous activity
const ACTIVE_ACTIVITY_TYPES = [
    7,   // Walking
    8,   // Running
    1,   // Biking
    3,   // Still (not active, but tracked)
    9,   // Aerobics
    10,  // Badminton
    13,  // Basketball
    // Add more as needed
];

export interface DailyHealthData {
    date: Date;
    sleepMinutes: number | null;
    sleepQuality: 'poor' | 'fair' | 'good' | 'excellent' | null;
    sleepSegments?: {
        light: number;
        deep: number;
        rem: number;
        awake: number;
    };
    steps: number | null;
    activeMinutes: number | null;
    caloriesBurned: number | null;
    avgHeartRate: number | null;
    restingHeartRate: number | null;
}

export class GoogleFitApiService {
    private createClient(accessToken: string) {
        return axios.create({
            baseURL: FITNESS_API_BASE,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Get epoch time in nanoseconds (Google Fit uses nanoseconds)
     */
    private toNanos(date: Date): string {
        return (date.getTime() * 1000000).toString();
    }

    /**
     * Get start of day in local timezone
     */
    private getStartOfDay(date: Date): Date {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Get end of day in local timezone
     */
    private getEndOfDay(date: Date): Date {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
    }

    /**
     * Fetch aggregated daily data for a specific date
     */
    async fetchDailyData(accessToken: string, date: Date): Promise<DailyHealthData> {
        const client = this.createClient(accessToken);
        const startTime = this.getStartOfDay(date);
        const endTime = this.getEndOfDay(date);

        const result: DailyHealthData = {
            date: startTime,
            sleepMinutes: null,
            sleepQuality: null,
            steps: null,
            activeMinutes: null,
            caloriesBurned: null,
            avgHeartRate: null,
            restingHeartRate: null,
        };

        try {
            // Fetch all data in parallel for efficiency
            const [stepsData, sleepData, heartRateData, activityData] = await Promise.allSettled([
                this.fetchSteps(client, startTime, endTime),
                this.fetchSleep(client, startTime, endTime),
                this.fetchHeartRate(client, startTime, endTime),
                this.fetchActiveMinutes(client, startTime, endTime),
            ]);

            // Process steps
            if (stepsData.status === 'fulfilled' && stepsData.value !== null) {
                result.steps = stepsData.value;
            }

            // Process sleep
            if (sleepData.status === 'fulfilled' && sleepData.value) {
                result.sleepMinutes = sleepData.value.totalMinutes;
                result.sleepQuality = sleepData.value.quality;
                result.sleepSegments = sleepData.value.segments;
            }

            // Process heart rate
            if (heartRateData.status === 'fulfilled' && heartRateData.value) {
                result.avgHeartRate = heartRateData.value.average;
                result.restingHeartRate = heartRateData.value.resting;
            }

            // Process active minutes
            if (activityData.status === 'fulfilled' && activityData.value !== null) {
                result.activeMinutes = activityData.value;
            }

        } catch (error) {
            console.error('Error fetching Google Fit data:', error);
        }

        return result;
    }

    /**
     * Fetch step count for a time period
     */
    private async fetchSteps(
        client: ReturnType<typeof axios.create>,
        startTime: Date,
        endTime: Date
    ): Promise<number | null> {
        try {
            const response = await client.post('/dataset:aggregate', {
                aggregateBy: [{
                    dataTypeName: 'com.google.step_count.delta',
                }],
                bucketByTime: { durationMillis: 86400000 }, // 1 day
                startTimeMillis: startTime.getTime(),
                endTimeMillis: endTime.getTime(),
            });

            const buckets = (response.data as any).bucket || [];
            let totalSteps = 0;

            for (const bucket of buckets) {
                for (const dataset of bucket.dataset || []) {
                    for (const point of dataset.point || []) {
                        for (const value of point.value || []) {
                            totalSteps += value.intVal || 0;
                        }
                    }
                }
            }

            return totalSteps > 0 ? totalSteps : null;
        } catch (error: any) {
            if (error.response?.status !== 403) { // Ignore permission errors silently
                console.error('Error fetching steps:', error.message);
            }
            return null;
        }
    }

    /**
     * Fetch sleep data for a time period
     * Note: Sleep data spans overnight, so we look at a broader window
     */
    private async fetchSleep(
        client: ReturnType<typeof axios.create>,
        startTime: Date,
        endTime: Date
    ): Promise<{
        totalMinutes: number;
        quality: 'poor' | 'fair' | 'good' | 'excellent';
        segments: { light: number; deep: number; rem: number; awake: number };
    } | null> {
        try {
            // For sleep, we need to look at the previous night
            // Sleep from previous evening to this morning
            const sleepStart = new Date(startTime);
            sleepStart.setHours(sleepStart.getHours() - 12); // Look back to 6 PM previous day

            const response = await client.post('/dataset:aggregate', {
                aggregateBy: [{
                    dataTypeName: 'com.google.sleep.segment',
                }],
                startTimeMillis: sleepStart.getTime(),
                endTimeMillis: endTime.getTime(),
            });

            const buckets = (response.data as any).bucket || [];
            const segments = { light: 0, deep: 0, rem: 0, awake: 0 };
            let totalMinutes = 0;

            for (const bucket of buckets) {
                for (const dataset of bucket.dataset || []) {
                    for (const point of dataset.point || []) {
                        const startNanos = parseInt(point.startTimeNanos);
                        const endNanos = parseInt(point.endTimeNanos);
                        const durationMinutes = (endNanos - startNanos) / (1000000 * 60000);

                        const sleepType = point.value?.[0]?.intVal;
                        
                        switch (sleepType) {
                            case SLEEP_ACTIVITY_TYPES.SLEEP_LIGHT:
                                segments.light += durationMinutes;
                                totalMinutes += durationMinutes;
                                break;
                            case SLEEP_ACTIVITY_TYPES.SLEEP_DEEP:
                                segments.deep += durationMinutes;
                                totalMinutes += durationMinutes;
                                break;
                            case SLEEP_ACTIVITY_TYPES.SLEEP_REM:
                                segments.rem += durationMinutes;
                                totalMinutes += durationMinutes;
                                break;
                            case SLEEP_ACTIVITY_TYPES.SLEEP_AWAKE:
                                segments.awake += durationMinutes;
                                // Don't count awake time as sleep
                                break;
                            case SLEEP_ACTIVITY_TYPES.SLEEPING:
                                // General sleep (not segmented)
                                segments.light += durationMinutes; // Assign to light as default
                                totalMinutes += durationMinutes;
                                break;
                        }
                    }
                }
            }

            if (totalMinutes < 30) {
                return null; // Not enough sleep data
            }

            // Calculate sleep quality based on sleep stages
            const quality = this.calculateSleepQuality(totalMinutes, segments);

            return {
                totalMinutes: Math.round(totalMinutes),
                quality,
                segments: {
                    light: Math.round(segments.light),
                    deep: Math.round(segments.deep),
                    rem: Math.round(segments.rem),
                    awake: Math.round(segments.awake),
                },
            };
        } catch (error: any) {
            if (error.response?.status !== 403) {
                console.error('Error fetching sleep:', error.message);
            }
            return null;
        }
    }

    /**
     * Calculate sleep quality based on duration and stages
     */
    private calculateSleepQuality(
        totalMinutes: number,
        segments: { light: number; deep: number; rem: number; awake: number }
    ): 'poor' | 'fair' | 'good' | 'excellent' {
        // Quality factors:
        // 1. Total duration (ideal: 7-9 hours = 420-540 minutes)
        // 2. Deep sleep percentage (ideal: 15-20%)
        // 3. REM percentage (ideal: 20-25%)
        // 4. Awake time (less is better)

        let score = 0;

        // Duration score (0-40 points)
        if (totalMinutes >= 420 && totalMinutes <= 540) {
            score += 40;
        } else if (totalMinutes >= 360 && totalMinutes <= 600) {
            score += 30;
        } else if (totalMinutes >= 300) {
            score += 20;
        } else {
            score += 10;
        }

        // Deep sleep score (0-30 points)
        const deepPercent = (segments.deep / totalMinutes) * 100;
        if (deepPercent >= 15 && deepPercent <= 25) {
            score += 30;
        } else if (deepPercent >= 10) {
            score += 20;
        } else if (deepPercent >= 5) {
            score += 10;
        }

        // REM score (0-20 points)
        const remPercent = (segments.rem / totalMinutes) * 100;
        if (remPercent >= 20 && remPercent <= 30) {
            score += 20;
        } else if (remPercent >= 15) {
            score += 15;
        } else if (remPercent >= 10) {
            score += 10;
        }

        // Awake penalty (0-10 points)
        const awakePercent = (segments.awake / (totalMinutes + segments.awake)) * 100;
        if (awakePercent <= 5) {
            score += 10;
        } else if (awakePercent <= 10) {
            score += 5;
        }

        // Convert score to quality
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'poor';
    }

    /**
     * Fetch heart rate data
     */
    private async fetchHeartRate(
        client: ReturnType<typeof axios.create>,
        startTime: Date,
        endTime: Date
    ): Promise<{ average: number; resting: number } | null> {
        try {
            const response = await client.post('/dataset:aggregate', {
                aggregateBy: [{
                    dataTypeName: 'com.google.heart_rate.bpm',
                }],
                bucketByTime: { durationMillis: 86400000 },
                startTimeMillis: startTime.getTime(),
                endTimeMillis: endTime.getTime(),
            });

            const buckets = (response.data as any).bucket || [];
            const heartRates: number[] = [];

            for (const bucket of buckets) {
                for (const dataset of bucket.dataset || []) {
                    for (const point of dataset.point || []) {
                        for (const value of point.value || []) {
                            if (value.fpVal) {
                                heartRates.push(value.fpVal);
                            }
                        }
                    }
                }
            }

            if (heartRates.length === 0) {
                return null;
            }

            const average = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length);
            
            // Resting heart rate approximation (lowest 10% of readings)
            heartRates.sort((a, b) => a - b);
            const restingCount = Math.max(1, Math.floor(heartRates.length * 0.1));
            const resting = Math.round(
                heartRates.slice(0, restingCount).reduce((a, b) => a + b, 0) / restingCount
            );

            return { average, resting };
        } catch (error: any) {
            if (error.response?.status !== 403) {
                console.error('Error fetching heart rate:', error.message);
            }
            return null;
        }
    }

    /**
     * Fetch active minutes (moderate + vigorous activity)
     */
    private async fetchActiveMinutes(
        client: ReturnType<typeof axios.create>,
        startTime: Date,
        endTime: Date
    ): Promise<number | null> {
        try {
            const response = await client.post('/dataset:aggregate', {
                aggregateBy: [{
                    dataTypeName: 'com.google.activity.segment',
                }],
                startTimeMillis: startTime.getTime(),
                endTimeMillis: endTime.getTime(),
            });

            const buckets = (response.data as any).bucket || [];
            let activeMinutes = 0;

            for (const bucket of buckets) {
                for (const dataset of bucket.dataset || []) {
                    for (const point of dataset.point || []) {
                        const activityType = point.value?.[0]?.intVal;
                        
                        // Only count active activities (walking, running, biking, etc.)
                        if (activityType && ACTIVE_ACTIVITY_TYPES.includes(activityType)) {
                            const startNanos = parseInt(point.startTimeNanos);
                            const endNanos = parseInt(point.endTimeNanos);
                            const durationMinutes = (endNanos - startNanos) / (1000000 * 60000);
                            activeMinutes += durationMinutes;
                        }
                    }
                }
            }

            return activeMinutes > 0 ? Math.round(activeMinutes) : null;
        } catch (error: any) {
            if (error.response?.status !== 403) {
                console.error('Error fetching active minutes:', error.message);
            }
            return null;
        }
    }

    /**
     * Fetch data for multiple days (batch operation)
     */
    async fetchMultipleDays(
        accessToken: string,
        startDate: Date,
        endDate: Date
    ): Promise<DailyHealthData[]> {
        const results: DailyHealthData[] = [];
        const current = new Date(startDate);

        while (current <= endDate) {
            const dayData = await this.fetchDailyData(accessToken, new Date(current));
            results.push(dayData);
            current.setDate(current.getDate() + 1);
        }

        return results;
    }

    /**
     * Fetch yesterday's data (for daily sync)
     */
    async fetchYesterdayData(accessToken: string): Promise<DailyHealthData> {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return this.fetchDailyData(accessToken, yesterday);
    }
}

export const googleFitApiService = new GoogleFitApiService();
export default googleFitApiService;
