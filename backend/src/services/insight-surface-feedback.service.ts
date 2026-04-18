/**
 * Insight Surface Feedback Service
 *
 * Persists and applies "Helpful" / "Off mark" reactions on dashboard insight
 * surfaces that are not LLM-generated (pattern correlations, contradictions,
 * trigger entities, gentle reflection prompts).
 *
 * Feedback stored here is read by buildFilteredDashboardInsights() to demote
 * items a user has explicitly flagged as unhelpful, closing the learning loop
 * on pattern-discovery and reflection surfaces.
 *
 * Cost posture: no LLM calls. Single insert/update per user action.
 */

import prisma from '../config/prisma';
import type { DashboardInsightsData } from './dashboard-insights.service';

export type InsightSurfaceType = 'correlation' | 'contradiction' | 'trigger' | 'reflection';
export type InsightSurfaceReaction = 'helpful' | 'not_helpful';

export const VALID_SURFACE_TYPES: InsightSurfaceType[] = [
    'correlation', 'contradiction', 'trigger', 'reflection',
];
export const VALID_SURFACE_REACTIONS: InsightSurfaceReaction[] = ['helpful', 'not_helpful'];

const NEGATIVE_FEEDBACK_LOOKBACK_DAYS = 45;

const normalizeKey = (value: string): string => value.trim().toLowerCase();

export async function recordSurfaceFeedback(
    userId: string,
    surfaceType: InsightSurfaceType,
    entityKey: string,
    reaction: InsightSurfaceReaction,
): Promise<void> {
    const key = normalizeKey(entityKey);
    if (!key) return;

    await prisma.insightSurfaceFeedback.upsert({
        where: { userId_surfaceType_entityKey: { userId, surfaceType, entityKey: key } },
        create: { userId, surfaceType, entityKey: key, reaction },
        update: { reaction, createdAt: new Date() },
    });
}

type NegativeFeedbackIndex = Record<InsightSurfaceType, Set<string>>;

async function loadNegativeFeedbackIndex(userId: string): Promise<NegativeFeedbackIndex> {
    const since = new Date();
    since.setDate(since.getDate() - NEGATIVE_FEEDBACK_LOOKBACK_DAYS);

    const rows = await prisma.insightSurfaceFeedback.findMany({
        where: { userId, reaction: 'not_helpful', createdAt: { gte: since } },
        select: { surfaceType: true, entityKey: true },
    });

    const index: NegativeFeedbackIndex = {
        correlation: new Set(),
        contradiction: new Set(),
        trigger: new Set(),
        reflection: new Set(),
    };

    for (const row of rows) {
        const bucket = index[row.surfaceType as InsightSurfaceType];
        if (bucket) bucket.add(row.entityKey);
    }

    return index;
}

export async function applySurfaceFeedback(
    userId: string,
    insights: DashboardInsightsData,
): Promise<DashboardInsightsData> {
    const index = await loadNegativeFeedbackIndex(userId);

    const correlations = insights.correlations.filter(
        (item) => !index.correlation.has(normalizeKey(item.topic)),
    );
    const contradictions = insights.contradictions.filter(
        (item) => !index.contradiction.has(normalizeKey(item.entryId)),
    );
    const triggerMap = insights.triggerMap.filter(
        (item) => !index.trigger.has(normalizeKey(item.entity)),
    );

    return { ...insights, correlations, contradictions, triggerMap };
}
