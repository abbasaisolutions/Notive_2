import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getStats, getMoodTrends, getActivity, getPersonalizationTelemetry, getSummary, getTimelineSummary, postTelemetryEvent } from '../controllers/analytics.controller';
import insightsController from '../controllers/insights.controller';

const router = Router();

router.use(authMiddleware);

// Basic analytics
router.get('/stats', getStats);
router.get('/summary', getSummary);
router.get('/timeline-summary', getTimelineSummary);
router.get('/moods', getMoodTrends);
router.get('/activity', getActivity);
router.get('/personalization', getPersonalizationTelemetry);
router.post('/events', postTelemetryEvent);

// AI-powered insights
router.get('/insights', insightsController.getInsights);
router.post('/analyze', insightsController.analyzeEntry);
router.get('/patterns', insightsController.getPatterns);

export default router;
