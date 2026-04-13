import { Request, Response } from 'express';
import { createHash } from 'crypto';
import prisma from '../config/prisma';
import { buildProfileContextSummary } from '../services/profile-context.service';
import { buildAnalyticsSummary, type AnalyticsPeriod } from '../services/analytics-summary.service';
import { buildDashboardInsights } from '../services/dashboard-insights.service';
import { fetchInsightInputs } from '../services/insight-inputs.service';
import { evaluatePromptLearningModels } from '../services/prompt-learning-evaluation.service';
import { buildPromptExperimentReport } from '../services/prompt-experiment-report.service';
import { applyPromptPolicyPerformanceFeedback } from '../services/prompt-learning-policy-feedback.service';
import { buildPromptBehaviorProfileWithPolicy } from '../services/prompt-learning-policy.service';
import { isValidTag } from '../services/tagging.service';
import {
    buildPromptLearningPolicyPerformanceReport,
    persistPromptLearningPolicySnapshot,
} from '../services/prompt-learning-policy-snapshot.service';
import { buildTimelineSignatureSummary } from '../services/timeline-signature.service';
import {
    buildEntryListWhere,
    filterEntriesByTemporalContext,
    normalizeEntryDayPart,
    normalizeEntryDateKey,
    normalizeEntryDateRange,
    normalizeEntryMood,
    normalizeEntrySearch,
    normalizeEntrySource,
    normalizeEntryTheme,
    normalizeEntryWeekday,
    normalizeLifeArea,
} from '../utils/entry-filters';

const clampDays = (value: number): number => {
    if (!Number.isFinite(value)) return 30;
    return Math.min(365, Math.max(7, Math.floor(value)));
};

const normalizeAnalyticsPeriod = (value: unknown): AnalyticsPeriod =>
    value === 'month' || value === 'year' ? value : 'week';

const buildTelemetryFingerprint = (input: {
    userId: string;
    eventType: string;
    field?: string | null;
    value?: string | null;
    pathname?: string | null;
    occurredAt: Date;
    metadata?: unknown;
}) => createHash('sha256').update(JSON.stringify(input)).digest('hex');

export const getSummary = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const period = normalizeAnalyticsPeriod(req.query.period);

        const [entries, profile] = await Promise.all([
            prisma.entry.findMany({
                where: { userId, deletedAt: null },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    content: true,
                    mood: true,
                    tags: true,
                    skills: true,
                    lessons: true,
                    source: true,
                    createdAt: true,
                },
            }),
            prisma.userProfile.findUnique({
                where: { userId },
                select: {
                    primaryGoal: true,
                    focusArea: true,
                    experienceLevel: true,
                    writingPreference: true,
                    starterPrompt: true,
                    importPreference: true,
                    lifeGoals: true,
                    outputGoals: true,
                    onboardingCompletedAt: true,
                    updatedAt: true,
                },
            }),
        ]);

        const summary = buildAnalyticsSummary({
            entries,
            profileContext: buildProfileContextSummary(profile),
            period,
        });

        return res.json({
            period,
            summary,
        });
    } catch (error) {
        console.error('Get analytics summary error:', error);
        return res.status(500).json({ message: 'Failed to fetch analytics summary' });
    }
};

export const getTimelineSummary = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const source = normalizeEntrySource(req.query.source);
        const lifeArea = normalizeLifeArea(req.query.lifeArea);
        const search = normalizeEntrySearch(req.query.search);
        const theme = normalizeEntryTheme(req.query.theme);
        const mood = normalizeEntryMood(req.query.mood);
        const date = normalizeEntryDateKey(req.query.date);
        const { startDate, endDate } = normalizeEntryDateRange({
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        });
        const weekday = normalizeEntryWeekday(req.query.weekday);
        const dayPart = normalizeEntryDayPart(req.query.dayPart);
        const where = buildEntryListWhere({
            userId,
            search,
            source,
            lifeArea,
            theme,
            mood,
            date,
            startDate,
            endDate,
        });

        const entries = await prisma.entry.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                content: true,
                mood: true,
                tags: true,
                skills: true,
                lessons: true,
                lifeArea: true,
                source: true,
                createdAt: true,
            },
        });
        const filteredEntries = filterEntriesByTemporalContext(entries, { weekday, dayPart });

        return res.json({
            summary: buildTimelineSignatureSummary(filteredEntries),
        });
    } catch (error) {
        console.error('Get timeline summary error:', error);
        return res.status(500).json({ message: 'Failed to fetch timeline summary' });
    }
};

/**
 * Get overall statistics
 */
export const getStats = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        // Run all independent queries in parallel
        const [totalEntries, totalChapters, entriesThisWeek, entries, profile] = await Promise.all([
            prisma.entry.count({ where: { userId, deletedAt: null } }),
            prisma.chapter.count({ where: { userId } }),
            prisma.entry.count({ where: { userId, deletedAt: null, createdAt: { gte: weekAgo } } }),
            // Single fetch used for both streak and word count (cap at 730 days — 2 years is plenty)
            prisma.entry.findMany({
                where: { userId, deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: 730,
                select: { createdAt: true, content: true },
            }),
            prisma.userProfile.findUnique({
                where: { userId },
                select: {
                    primaryGoal: true,
                    focusArea: true,
                    experienceLevel: true,
                    writingPreference: true,
                    starterPrompt: true,
                    importPreference: true,
                    lifeGoals: true,
                    outputGoals: true,
                    onboardingCompletedAt: true,
                    updatedAt: true,
                },
            }),
        ]);

        // Calculate streak (consecutive days with entries)
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let lastDate: string | null = null;

        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        for (const entry of entries) {
            const entryDate = entry.createdAt.toDateString();

            if (!lastDate) {
                if (entryDate === today || entryDate === yesterday) {
                    currentStreak = 1;
                    tempStreak = 1;
                }
                lastDate = entryDate;
                continue;
            }

            const lastDateTime = new Date(lastDate).getTime();
            const entryDateTime = new Date(entryDate).getTime();
            const dayDiff = Math.floor((lastDateTime - entryDateTime) / 86400000);

            if (dayDiff === 1) {
                tempStreak++;
            } else if (dayDiff > 1) {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 1;
            }

            lastDate = entryDate;
        }

        longestStreak = Math.max(longestStreak, tempStreak);
        if (entries.length > 0) {
            const firstEntryDate = entries[0].createdAt.toDateString();
            if (firstEntryDate === today || firstEntryDate === yesterday) {
                currentStreak = tempStreak;
            }
        }

        // Words written (approximate)
        const totalWords = entries.reduce(
            (acc, entry) => acc + entry.content.split(/\s+/).length,
            0
        );

        return res.json({
            totalEntries,
            totalChapters,
            entriesThisWeek,
            currentStreak,
            longestStreak,
            totalWords,
            profileContext: buildProfileContextSummary(profile),
        });
    } catch (error) {
        console.error('Get stats error:', error);
        return res.status(500).json({ message: 'Failed to fetch stats' });
    }
};

/**
 * Get mood distribution
 */
export const getMoodTrends = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

        const entries = await prisma.entry.findMany({
            where: { userId, deletedAt: null, mood: { not: null }, createdAt: { gte: twelveMonthsAgo } },
            select: { mood: true },
        });

        const moodCounts: Record<string, number> = {};
        for (const entry of entries) {
            if (entry.mood) {
                moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
            }
        }

        const moods = Object.entries(moodCounts).map(([mood, count]) => ({
            mood,
            count,
            percentage: Math.round((count / entries.length) * 100),
        }));

        moods.sort((a, b) => b.count - a.count);

        return res.json({ moods, total: entries.length });
    } catch (error) {
        console.error('Get mood trends error:', error);
        return res.status(500).json({ message: 'Failed to fetch mood trends' });
    }
};

/**
 * Get writing activity (for heatmap)
 */
export const getActivity = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        // Get entries from last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const entries = await prisma.entry.findMany({
            where: {
                userId,
                deletedAt: null,
                createdAt: { gte: ninetyDaysAgo },
            },
            select: { createdAt: true },
        });

        // Group by date
        const activity: Record<string, number> = {};
        for (const entry of entries) {
            const date = entry.createdAt.toISOString().split('T')[0];
            activity[date] = (activity[date] || 0) + 1;
        }

        return res.json({ activity });
    } catch (error) {
        console.error('Get activity error:', error);
        return res.status(500).json({ message: 'Failed to fetch activity' });
    }
};

export const postTelemetryEvent = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const {
            eventType,
            field,
            value,
            pathname,
            metadata,
            occurredAt,
        } = req.body || {};

        if (typeof eventType !== 'string' || !eventType.trim()) {
            return res.status(400).json({ message: 'eventType is required.' });
        }

        const profile = await prisma.userProfile.findUnique({
            where: { userId },
            select: { id: true },
        });

        const occurred = occurredAt ? new Date(occurredAt) : new Date();
        if (Number.isNaN(occurred.getTime())) {
            return res.status(400).json({ message: 'occurredAt must be a valid date.' });
        }

        await prisma.personalizationEvent.create({
            data: {
                userId,
                profileId: profile?.id || null,
                eventType: eventType.trim().slice(0, 80),
                field: typeof field === 'string' ? field.slice(0, 80) : null,
                value: typeof value === 'string' ? value.slice(0, 500) : null,
                pathname: typeof pathname === 'string' ? pathname.slice(0, 200) : null,
                metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
                occurredAt: occurred,
                fingerprint: buildTelemetryFingerprint({
                    userId,
                    eventType: eventType.trim().slice(0, 80),
                    field: typeof field === 'string' ? field.slice(0, 80) : null,
                    value: typeof value === 'string' ? value.slice(0, 500) : null,
                    pathname: typeof pathname === 'string' ? pathname.slice(0, 200) : null,
                    occurredAt: occurred,
                    metadata: metadata && typeof metadata === 'object' ? metadata : null,
                }),
            },
        });

        return res.status(201).json({ ok: true });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            return res.status(200).json({ ok: true, duplicate: true });
        }

        console.error('Post telemetry event error:', error);
        return res.status(500).json({ message: 'Failed to capture telemetry event' });
    }
};

/**
 * Get personalization telemetry timeline
 */
export const getPersonalizationTelemetry = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const daysParam = typeof req.query.days === 'string' ? Number(req.query.days) : NaN;
        const days = clampDays(daysParam);

        const since = new Date();
        since.setDate(since.getDate() - days);

        const events = await prisma.personalizationEvent.findMany({
            where: {
                userId,
                occurredAt: { gte: since },
            },
            orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
            take: 1000,
            select: {
                id: true,
                eventType: true,
                questionId: true,
                field: true,
                value: true,
                pathname: true,
                metadata: true,
                occurredAt: true,
                createdAt: true,
            },
        });

        const summaryByType: Record<string, number> = {};
        const answeredByField: Record<string, number> = {};
        const timelineMap: Record<string, Record<string, number>> = {};

        for (const event of events) {
            summaryByType[event.eventType] = (summaryByType[event.eventType] || 0) + 1;

            if (event.eventType === 'ANSWER_CAPTURED' && event.field) {
                answeredByField[event.field] = (answeredByField[event.field] || 0) + 1;
            }

            const day = event.occurredAt.toISOString().slice(0, 10);
            if (!timelineMap[day]) {
                timelineMap[day] = {};
            }
            timelineMap[day][event.eventType] = (timelineMap[day][event.eventType] || 0) + 1;
        }

        const timeline = Object.entries(timelineMap)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, counts]) => ({ date, counts }));

        return res.json({
            rangeDays: days,
            from: since.toISOString(),
            to: new Date().toISOString(),
            totalEvents: events.length,
            summaryByType,
            answeredByField,
            timeline,
            recentEvents: events.slice(0, 50),
        });
    } catch (error) {
        console.error('Get personalization telemetry error:', error);
        return res.status(500).json({ message: 'Failed to fetch personalization telemetry' });
    }
};

export const getPromptLearningProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const daysParam = typeof req.query.days === 'string' ? Number(req.query.days) : NaN;
        const performanceDays = Number.isFinite(daysParam)
            ? Math.min(90, Math.max(30, Math.floor(daysParam)))
            : 60;
        const [profile, performance] = await Promise.all([
            buildPromptBehaviorProfileWithPolicy(userId, daysParam),
            buildPromptLearningPolicyPerformanceReport(userId, performanceDays),
        ]);
        const adaptedProfile = {
            ...profile,
            policy: applyPromptPolicyPerformanceFeedback(profile.policy, performance),
        };
        await persistPromptLearningPolicySnapshot(userId, adaptedProfile);

        return res.json(adaptedProfile);
    } catch (error) {
        console.error('Get prompt learning profile error:', error);
        return res.status(500).json({ message: 'Failed to fetch prompt learning profile' });
    }
};

export const getPromptLearningEvaluation = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const daysParam = typeof req.query.days === 'string' ? Number(req.query.days) : NaN;
        const report = await evaluatePromptLearningModels(userId, daysParam);

        return res.json(report);
    } catch (error) {
        console.error('Get prompt learning evaluation error:', error);
        return res.status(500).json({ message: 'Failed to fetch prompt learning evaluation' });
    }
};

export const getPromptLearningPolicyPerformance = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const daysParam = typeof req.query.days === 'string' ? Number(req.query.days) : NaN;
        const report = await buildPromptLearningPolicyPerformanceReport(userId, daysParam);

        return res.json(report);
    } catch (error) {
        console.error('Get prompt learning policy performance error:', error);
        return res.status(500).json({ message: 'Failed to fetch prompt learning policy performance' });
    }
};

export const getPromptExperimentReport = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const daysParam = typeof req.query.days === 'string' ? Number(req.query.days) : NaN;
        const report = await buildPromptExperimentReport(userId, daysParam);

        return res.json(report);
    } catch (error) {
        console.error('Get prompt experiment report error:', error);
        return res.status(500).json({ message: 'Failed to fetch prompt experiment report' });
    }
};

/**
 * Get dashboard insights (emotional fingerprint, resilience, correlations, etc.)
 * GET /api/v1/analytics/dashboard-insights
 */
export const getDashboardInsights = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { entries, analyses } = await fetchInsightInputs(userId!, { take: 150 });
        const insights = buildDashboardInsights(entries, analyses);
        return res.json(insights);
    } catch (error) {
        console.error('Get dashboard insights error:', error);
        return res.status(500).json({ message: 'Failed to fetch dashboard insights' });
    }
};

/**
 * Get recurring tag themes from last 30 days
 * Returns top tags by frequency with last-seen date for DashboardInsight use
 */
export const getTagThemes = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const entries = await prisma.entry.findMany({
            where: { userId, deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
            select: { tags: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });

        const tagMap = new Map<string, { count: number; lastSeen: Date }>();

        for (const entry of entries) {
            for (const tag of entry.tags) {
                const norm = tag.toLowerCase().trim();
                if (!norm) continue;
                const existing = tagMap.get(norm);
                if (!existing) {
                    tagMap.set(norm, { count: 1, lastSeen: entry.createdAt });
                } else {
                    existing.count += 1;
                    if (entry.createdAt > existing.lastSeen) existing.lastSeen = entry.createdAt;
                }
            }
        }

        const themes = Array.from(tagMap.entries())
            .map(([tag, { count, lastSeen }]) => ({ tag, count, lastSeen }))
            .filter(({ tag }) => isValidTag(tag))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return res.json({ themes, periodDays: 30, totalEntries: entries.length });
    } catch (error) {
        console.error('Get tag themes error:', error);
        return res.status(500).json({ message: 'Failed to fetch tag themes' });
    }
};

/**
 * Get mood-tag correlation patterns
 * Finds tags where a specific mood dominates (≥50% of entries with that tag)
 */
export const getTagMoodPatterns = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const entries = await prisma.entry.findMany({
            where: {
                userId,
                deletedAt: null,
                createdAt: { gte: sixtyDaysAgo },
                mood: { not: null },
            },
            select: { tags: true, mood: true },
        });

        // tag → mood → count
        const tagMoodMap = new Map<string, Record<string, number>>();

        for (const entry of entries) {
            if (!entry.mood) continue;
            for (const tag of entry.tags) {
                const norm = tag.toLowerCase().trim();
                if (!norm) continue;
                if (!tagMoodMap.has(norm)) tagMoodMap.set(norm, {});
                const moodCounts = tagMoodMap.get(norm)!;
                moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
            }
        }

        const patterns: { tag: string; dominantMood: string; percentage: number; entryCount: number }[] = [];

        for (const [tag, moodCounts] of tagMoodMap.entries()) {
            const total = Object.values(moodCounts).reduce((s, n) => s + n, 0);
            if (total < 4) continue; // need at least 4 data points
            const [dominantMood, dominantCount] = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
            const percentage = Math.round((dominantCount / total) * 100);
            if (percentage >= 50) {
                patterns.push({ tag, dominantMood, percentage, entryCount: total });
            }
        }

        patterns.sort((a, b) => b.entryCount - a.entryCount);

        return res.json({ patterns: patterns.slice(0, 5), periodDays: 60 });
    } catch (error) {
        console.error('Get tag mood patterns error:', error);
        return res.status(500).json({ message: 'Failed to fetch tag mood patterns' });
    }
};


