import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getStats, getMoodTrends, getActivity } from '../controllers/analytics.controller';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getStats);
router.get('/moods', getMoodTrends);
router.get('/activity', getActivity);

export default router;
