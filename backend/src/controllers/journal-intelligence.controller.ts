import { Request, Response } from 'express';
import prisma from '../config/prisma';
import {
    buildJournalIntelligence,
    type IntelEntry,
    type IntelAnalysis,
} from '../services/journal-intelligence.service';

/**
 * GET /api/v1/analytics/journal-intelligence
 * Returns deterministic KPI dashboard data (zero LLM cost).
 * Query: ?days=30 (default 90)
 */
export const getJournalIntelligence = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const days = Math.min(Number(req.query.days) || 90, 365);
        const since = new Date();
        since.setDate(since.getDate() - days);

        const entries = await prisma.entry.findMany({
            where: { userId, createdAt: { gte: since } },
            select: {
                id: true,
                content: true,
                mood: true,
                tags: true,
                lifeArea: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (entries.length < 3) {
            return res.json({
                intelligence: null,
                reason: 'insufficient_entries',
                entryCount: entries.length,
                minRequired: 3,
            });
        }

        const entryIds = entries.map((e) => e.id);

        const analyses = await prisma.entryAnalysis.findMany({
            where: { entryId: { in: entryIds } },
            select: {
                entryId: true,
                sentimentScore: true,
                emotions: true,
                entities: true,
                topics: true,
                keywords: true,
                suggestedMood: true,
                wordCount: true,
            },
        });

        const intelEntries: IntelEntry[] = entries.map((e) => ({
            id: e.id,
            content: e.content,
            mood: e.mood,
            tags: e.tags,
            lifeArea: e.lifeArea,
            createdAt: e.createdAt,
        }));

        const intelAnalyses: IntelAnalysis[] = analyses.map((a) => ({
            entryId: a.entryId,
            sentimentScore: a.sentimentScore,
            emotions: a.emotions as Record<string, number> | null,
            entities: a.entities as string[] | null,
            topics: Array.isArray(a.topics) ? a.topics as string[] : [],
            keywords: Array.isArray(a.keywords) ? a.keywords as string[] : [],
            suggestedMood: a.suggestedMood,
            wordCount: a.wordCount,
        }));

        const intelligence = buildJournalIntelligence(intelEntries, intelAnalyses);

        return res.json({ intelligence });
    } catch (error) {
        console.error('Journal intelligence error:', error);
        return res.status(500).json({ message: 'Failed to compute journal intelligence' });
    }
};
