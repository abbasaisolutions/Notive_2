import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    getActivity,
    getDashboardInsights,
    getMoodTrends,
    getStats,
    getSummary,
    getTagMoodPatterns,
    getTagThemes,
    getTimelineSummary,
} from '../controllers/analytics.controller';
import insightsController from '../controllers/insights.controller';
import { getJournalIntelligence } from '../controllers/journal-intelligence.controller';

const router = Router();

router.use(authMiddleware);

// Basic analytics
router.get('/stats', getStats);
router.get('/summary', getSummary);
router.get('/timeline-summary', getTimelineSummary);
router.get('/moods', getMoodTrends);
router.get('/activity', getActivity);
router.get('/dashboard-insights', getDashboardInsights);
router.get('/tag-themes', getTagThemes);
router.get('/tag-mood-patterns', getTagMoodPatterns);

// Journal intelligence (deterministic KPIs)
router.get('/journal-intelligence', getJournalIntelligence);

// AI-powered insights
router.get('/insights', insightsController.getInsights);
router.post('/analyze', insightsController.analyzeEntry);
router.get('/patterns', insightsController.getPatterns);

export default router;
