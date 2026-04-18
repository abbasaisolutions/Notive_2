import { Request, Response } from 'express';
import { buildJournalIntelligence } from '../services/journal-intelligence.service';
import { buildDashboardInsights } from '../services/dashboard-insights.service';
import { fetchInsightInputs } from '../services/insight-inputs.service';
import { applySurfaceFeedback } from '../services/insight-surface-feedback.service';

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

        const { entries, analyses } = await fetchInsightInputs(userId!, { since });

        if (entries.length < 3) {
            return res.json({
                intelligence: null,
                reason: 'insufficient_entries',
                entryCount: entries.length,
                minRequired: 3,
            });
        }

        const intelligence = buildJournalIntelligence(entries, analyses);

        return res.json({ intelligence });
    } catch (error) {
        console.error('Journal intelligence error:', error);
        return res.status(500).json({ message: 'Failed to compute journal intelligence' });
    }
};

/**
 * GET /api/v1/analytics/insights-bundle
 * One-shot fetcher: loads entry + analysis rows once and runs both the
 * dashboard-insights and journal-intelligence builders over them.
 *
 * Replaces two sequential frontend calls to /dashboard-insights and
 * /journal-intelligence that were re-running the same Postgres query.
 */
export const getInsightsBundle = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        // take: 150 matches the old /dashboard-insights cap; journal-intelligence
        // previously used a 90-day window, but limiting by count + ordering desc
        // keeps the same recency bias with a single query.
        const { entries, analyses } = await fetchInsightInputs(userId!, { take: 150 });

        const rawInsights = buildDashboardInsights(entries, analyses);
        const dashboardInsights = await applySurfaceFeedback(userId!, rawInsights);

        const intelligence = entries.length >= 3
            ? buildJournalIntelligence(entries, analyses)
            : null;

        return res.json({
            dashboardInsights,
            intelligence,
            entryCount: entries.length,
        });
    } catch (error) {
        console.error('Insights bundle error:', error);
        return res.status(500).json({ message: 'Failed to compute insights bundle' });
    }
};
