import prisma from '../config/prisma';
import { getRedisClient } from '../config/redis';
import { getMoodScore, normalizeMood } from '../utils/mood';
import { serverLogger } from '../utils/server-logger';

const CACHE_TTL_SECONDS = 6 * 60 * 60;
const cacheKey = (userId: string) => `mood-forecast:${userId}`;

export type MoodForecastConfidence = 'low' | 'medium' | 'high';

export type MoodForecastDay = {
    day: string;
    dayIndex: number;
    averageScore: number;
    sampleSize: number;
    delta: number;
};

export type MoodForecast = {
    confidence: MoodForecastConfidence;
    sampleSize: number;
    windowDays: number;
    personalAverage: number;
    weakDays: MoodForecastDay[];
    strongDays: MoodForecastDay[];
    nextWeakDay: { day: string; daysAway: number } | null;
    nextStrongDay: { day: string; daysAway: number } | null;
    gentleNote: string | null;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const WINDOW_DAYS = 56;
const MIN_ENTRIES_FOR_LOW = 8;
const MIN_ENTRIES_FOR_MEDIUM = 16;
const MIN_ENTRIES_FOR_HIGH = 28;
const MIN_SAMPLES_PER_DAY = 2;
const MEANINGFUL_DELTA = 0.6;

const roundOne = (value: number) => Math.round(value * 10) / 10;

const daysUntil = (targetDayIndex: number): number => {
    const today = new Date().getDay();
    const diff = (targetDayIndex - today + 7) % 7;
    return diff === 0 ? 7 : diff;
};

const pickNextOccurrence = (days: MoodForecastDay[]): { day: string; daysAway: number } | null => {
    if (days.length === 0) return null;
    const withDistance = days.map((day) => ({ ...day, daysAway: daysUntil(day.dayIndex) }));
    withDistance.sort((a, b) => a.daysAway - b.daysAway);
    const next = withDistance[0];
    return { day: next.day, daysAway: next.daysAway };
};

const buildGentleNote = (
    weakDays: MoodForecastDay[],
    strongDays: MoodForecastDay[]
): string | null => {
    if (weakDays.length > 0) {
        const names = weakDays.map((day) => day.day).slice(0, 2);
        const joined = names.length === 2 ? `${names[0]}s and ${names[1]}s` : `${names[0]}s`;
        return `${joined} tend to run a little heavier. A gentle plan helps.`;
    }
    if (strongDays.length > 0) {
        const names = strongDays.map((day) => day.day).slice(0, 2);
        const joined = names.length === 2 ? `${names[0]}s and ${names[1]}s` : `${names[0]}s`;
        return `${joined} usually feel lighter for you — worth noticing what works.`;
    }
    return null;
};

class MoodForecastService {
    async getForecast(userId: string): Promise<MoodForecast> {
        try {
            const cached = await getRedisClient().get(cacheKey(userId));
            if (cached) {
                return JSON.parse(cached) as MoodForecast;
            }
        } catch (error) {
            serverLogger.warn('mood_forecast.cache_read_failed', {
                userId,
                message: error instanceof Error ? error.message : String(error),
            });
        }

        const forecast = await this.computeForecast(userId);

        try {
            await getRedisClient().set(cacheKey(userId), JSON.stringify(forecast), { EX: CACHE_TTL_SECONDS });
        } catch (error) {
            serverLogger.warn('mood_forecast.cache_write_failed', {
                userId,
                message: error instanceof Error ? error.message : String(error),
            });
        }

        return forecast;
    }

    async invalidate(userId: string): Promise<void> {
        try {
            await getRedisClient().del(cacheKey(userId));
        } catch (error) {
            serverLogger.warn('mood_forecast.cache_invalidate_failed', {
                userId,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private async computeForecast(userId: string): Promise<MoodForecast> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);

        const entries = await prisma.entry.findMany({
            where: {
                userId,
                deletedAt: null,
                mood: { not: null },
                createdAt: { gte: cutoff },
            },
            select: { mood: true, createdAt: true },
        });

        const totalEntries = entries.length;
        const base: MoodForecast = {
            confidence: 'low',
            sampleSize: totalEntries,
            windowDays: WINDOW_DAYS,
            personalAverage: 5,
            weakDays: [],
            strongDays: [],
            nextWeakDay: null,
            nextStrongDay: null,
            gentleNote: null,
        };

        if (totalEntries < MIN_ENTRIES_FOR_LOW) {
            return base;
        }

        const perDay: Array<{ scores: number[]; dayIndex: number }> = DAY_NAMES.map((_, index) => ({
            scores: [],
            dayIndex: index,
        }));
        let totalScore = 0;
        let scoredCount = 0;

        entries.forEach((entry) => {
            const normalized = normalizeMood(entry.mood);
            if (!normalized) return;
            const score = getMoodScore(normalized);
            totalScore += score;
            scoredCount += 1;
            const dayIndex = new Date(entry.createdAt).getDay();
            perDay[dayIndex].scores.push(score);
        });

        if (scoredCount === 0) return base;

        const personalAverage = roundOne(totalScore / scoredCount);

        const dayAverages: MoodForecastDay[] = perDay
            .filter((bucket) => bucket.scores.length >= MIN_SAMPLES_PER_DAY)
            .map((bucket) => {
                const avg = bucket.scores.reduce((sum, value) => sum + value, 0) / bucket.scores.length;
                return {
                    day: DAY_NAMES[bucket.dayIndex],
                    dayIndex: bucket.dayIndex,
                    averageScore: roundOne(avg),
                    sampleSize: bucket.scores.length,
                    delta: roundOne(avg - personalAverage),
                };
            });

        const weakDays = dayAverages
            .filter((day) => day.delta <= -MEANINGFUL_DELTA)
            .sort((a, b) => a.delta - b.delta)
            .slice(0, 2);
        const strongDays = dayAverages
            .filter((day) => day.delta >= MEANINGFUL_DELTA)
            .sort((a, b) => b.delta - a.delta)
            .slice(0, 2);

        let confidence: MoodForecastConfidence = 'low';
        if (totalEntries >= MIN_ENTRIES_FOR_HIGH && dayAverages.length >= 5) confidence = 'high';
        else if (totalEntries >= MIN_ENTRIES_FOR_MEDIUM && dayAverages.length >= 4) confidence = 'medium';

        return {
            confidence,
            sampleSize: totalEntries,
            windowDays: WINDOW_DAYS,
            personalAverage,
            weakDays,
            strongDays,
            nextWeakDay: pickNextOccurrence(weakDays),
            nextStrongDay: pickNextOccurrence(strongDays),
            gentleNote: buildGentleNote(weakDays, strongDays),
        };
    }
}

export default new MoodForecastService();
