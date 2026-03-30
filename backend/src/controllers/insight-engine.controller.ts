import { Request, Response } from 'express';
import { getHeroInsight, recordInsightReaction, generateWeeklyDigest } from '../services/insight-engine.service';

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
 * Body: { insightId: string, reaction: 'expanded' | 'dismissed' | 'wrote_entry' }
 */
export const postInsightFeedback = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { insightId, reaction } = req.body || {};

        if (typeof insightId !== 'string' || !insightId.trim()) {
            return res.status(400).json({ message: 'insightId is required' });
        }

        const validReactions = ['expanded', 'dismissed', 'wrote_entry'];
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
