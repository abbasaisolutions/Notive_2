import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * Get overall statistics
 */
export const getStats = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;

        // Total entries
        const totalEntries = await prisma.entry.count({
            where: { userId, deletedAt: null },
        });

        // Total chapters
        const totalChapters = await prisma.chapter.count({
            where: { userId },
        });

        // Entries this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const entriesThisWeek = await prisma.entry.count({
            where: { userId, deletedAt: null, createdAt: { gte: weekAgo } },
        });

        // Calculate streak (consecutive days with entries)
        const entries = await prisma.entry.findMany({
            where: { userId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        });

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        let lastDate: string | null = null;

        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        for (const entry of entries) {
            const entryDate = entry.createdAt.toDateString();

            if (!lastDate) {
                // First entry - check if it's today or yesterday to start streak
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
            // If same day, continue counting

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
        const allContent = await prisma.entry.findMany({
            where: { userId, deletedAt: null },
            select: { content: true },
        });
        const totalWords = allContent.reduce((acc, e) => acc + e.content.split(/\s+/).length, 0);

        return res.json({
            totalEntries,
            totalChapters,
            entriesThisWeek,
            currentStreak,
            longestStreak,
            totalWords,
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
        // @ts-ignore
        const userId = req.userId;

        const entries = await prisma.entry.findMany({
            where: { userId, deletedAt: null, mood: { not: null } },
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
        // @ts-ignore
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
