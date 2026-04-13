/**
 * Shared Prisma fetcher for the deterministic insight services.
 *
 * Consolidates the previously-duplicated entry + analysis selects that
 * lived in analytics.controller (dashboard-insights), journal-intelligence
 * .controller, and insight-engine.service. One select, one shape, reused.
 */

import prisma from '../config/prisma';
import type { InsightInputEntry, InsightInputAnalysis } from '../types/insight-inputs';

export type FetchInsightInputsOpts = {
    /** Max number of entries (and matching analyses) to return. */
    take?: number;
    /** Only include entries created on/after this date. */
    since?: Date;
};

export type InsightInputs = {
    entries: InsightInputEntry[];
    analyses: InsightInputAnalysis[];
};

export async function fetchInsightInputs(
    userId: string,
    opts: FetchInsightInputsOpts = {}
): Promise<InsightInputs> {
    const { take, since } = opts;

    const entries = await prisma.entry.findMany({
        where: {
            userId,
            deletedAt: null,
            ...(since ? { createdAt: { gte: since } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        ...(take ? { take } : {}),
        select: {
            id: true,
            title: true,
            content: true,
            mood: true,
            tags: true,
            skills: true,
            lessons: true,
            reflection: true,
            lifeArea: true,
            createdAt: true,
        },
    });

    if (entries.length === 0) {
        return { entries: [], analyses: [] };
    }

    const entryIds = entries.map((e) => e.id);
    const analyses = await prisma.entryAnalysis.findMany({
        where: { entryId: { in: entryIds } },
        select: {
            entryId: true,
            sentimentScore: true,
            sentimentLabel: true,
            emotions: true,
            entities: true,
            topics: true,
            keywords: true,
            suggestedMood: true,
            wordCount: true,
        },
    });

    const mappedEntries: InsightInputEntry[] = entries.map((e) => ({
        id: e.id,
        title: e.title,
        content: e.content,
        mood: e.mood,
        tags: e.tags ?? [],
        skills: e.skills ?? [],
        lessons: e.lessons ?? [],
        reflection: e.reflection ?? null,
        lifeArea: e.lifeArea ?? null,
        createdAt: e.createdAt,
    }));

    const mappedAnalyses: InsightInputAnalysis[] = analyses.map((a) => ({
        entryId: a.entryId,
        sentimentScore: a.sentimentScore,
        sentimentLabel: a.sentimentLabel,
        emotions: a.emotions as Record<string, number> | null,
        entities: a.entities as string[] | null,
        topics: Array.isArray(a.topics) ? (a.topics as string[]) : [],
        keywords: Array.isArray(a.keywords) ? (a.keywords as string[]) : [],
        suggestedMood: a.suggestedMood,
        wordCount: a.wordCount,
    }));

    return { entries: mappedEntries, analyses: mappedAnalyses };
}
