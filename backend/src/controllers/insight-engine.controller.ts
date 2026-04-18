import { Request, Response } from 'express';
import { getHeroInsight, recordInsightReaction, generateWeeklyDigest } from '../services/insight-engine.service';
import {
    recordSurfaceFeedback,
    VALID_SURFACE_TYPES,
    VALID_SURFACE_REACTIONS,
    type InsightSurfaceType,
    type InsightSurfaceReaction,
} from '../services/insight-surface-feedback.service';

/**
 * GET /api/v1/ai/dashboard-insight
 * Returns today's hero insight (cached or freshly generated).
 */
export const getHeroDashboardInsight = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const insight = await getHeroInsight(userId);

        if (!insight) {
            return res.json({ insight: null, reason: 'insufficient_data_or_llm_disabled' });
        }

        return res.json({ insight });
    } catch (error) {
        console.error('Get hero dashboard insight error:', error);
        return res.status(500).json({ message: 'Failed to fetch dashboard insight' });
    }
};

/**
 * GET /api/v1/ai/weekly-digest
 * Returns a weekly editorial synthesis.
 */
export const getWeeklyDigest = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const digest = await generateWeeklyDigest(userId);

        if (!digest) {
            return res.json({ digest: null, reason: 'insufficient_data_or_llm_disabled' });
        }

        return res.json({ digest });
    } catch (error) {
        console.error('Get weekly digest error:', error);
        return res.status(500).json({ message: 'Failed to generate weekly digest' });
    }
};

/**
 * POST /api/v1/ai/insight-feedback
 * Records user reaction to an insight.
 * Body: { insightId: string, reaction: 'expanded' | 'dismissed' | 'wrote_entry' | 'helpful' | 'not_helpful' }
 */
export const postInsightFeedback = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { insightId, reaction } = req.body || {};

        if (typeof insightId !== 'string' || !insightId.trim()) {
            return res.status(400).json({ message: 'insightId is required' });
        }

        const validReactions = ['expanded', 'dismissed', 'wrote_entry', 'helpful', 'not_helpful'];
        if (!validReactions.includes(reaction)) {
            return res.status(400).json({ message: `reaction must be one of: ${validReactions.join(', ')}` });
        }

        const success = await recordInsightReaction(insightId.trim(), userId, reaction);

        if (!success) {
            return res.status(404).json({ message: 'Insight not found' });
        }

        return res.json({ ok: true });
    } catch (error) {
        console.error('Post insight feedback error:', error);
        return res.status(500).json({ message: 'Failed to record insight feedback' });
    }
};

/**
 * POST /api/v1/ai/surface-feedback
 * Records reaction on a non-LLM insight surface (correlation, contradiction,
 * trigger, reflection). Keyed by a stable entity key (topic, entryId, etc.)
 * so future dashboards can demote items the user flagged as unhelpful.
 * Body: { surfaceType, entityKey, reaction }
 */
export const postSurfaceFeedback = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { surfaceType, entityKey, reaction } = req.body || {};

        if (!VALID_SURFACE_TYPES.includes(surfaceType)) {
            return res.status(400).json({
                message: `surfaceType must be one of: ${VALID_SURFACE_TYPES.join(', ')}`,
            });
        }

        if (typeof entityKey !== 'string' || !entityKey.trim()) {
            return res.status(400).json({ message: 'entityKey is required' });
        }

        if (!VALID_SURFACE_REACTIONS.includes(reaction)) {
            return res.status(400).json({
                message: `reaction must be one of: ${VALID_SURFACE_REACTIONS.join(', ')}`,
            });
        }

        await recordSurfaceFeedback(
            userId,
            surfaceType as InsightSurfaceType,
            entityKey,
            reaction as InsightSurfaceReaction,
        );

        return res.json({ ok: true });
    } catch (error) {
        console.error('Post surface feedback error:', error);
        return res.status(500).json({ message: 'Failed to record surface feedback' });
    }
};
