import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getStats, getMoodTrends, getActivity } from '../controllers/analytics.controller';
import insightsController from '../controllers/insights.controller';

const router = Router();

router.use(authMiddleware);

// Basic analytics
router.get('/stats', getStats);
router.get('/moods', getMoodTrends);
router.get('/activity', getActivity);

// AI-powered insights
router.get('/insights', insightsController.getInsights);
router.get('/comprehensive-insights', insightsController.getComprehensiveInsights.bind(insightsController));
router.post('/analyze', insightsController.analyzeEntry);
router.get('/patterns', insightsController.getPatterns);

export default router;
