import { Router } from 'express';
import {
    analyzeEntry,
    chatWithJournal,
    exportOpportunityPack,
    generatePersonalStatement,
    getAiCoachStatus,
    recordContactOutcome,
    getSupportMap,
    getTodayAction,
    getOpportunityOverview,
    getOpportunityTrends,
    previewActionBrief,
    updateOpportunityEvidence,
} from '../controllers/ai.controller';
import {
    getHeroDashboardInsight,
    getWeeklyDigest,
    postInsightFeedback,
} from '../controllers/insight-engine.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { securityConfig } from '../config/security';
import { createRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
const aiLimiter = createRateLimiter({
    keyPrefix: 'ai',
    windowMs: securityConfig.rateLimits.ai.windowMs,
    max: securityConfig.rateLimits.ai.max,
    message: 'AI requests are coming in too quickly. Please wait a moment and try again.',
    strategy: 'ip-and-user',
});


router.get('/status', authMiddleware, getAiCoachStatus);
router.post('/chat', authMiddleware, aiLimiter, chatWithJournal);
router.get('/action/today', authMiddleware, getTodayAction);
router.post('/action/preview', authMiddleware, aiLimiter, previewActionBrief);
router.post('/contact-outcome', authMiddleware, aiLimiter, recordContactOutcome);
router.get('/support-map', authMiddleware, getSupportMap);
router.post('/analyze/:entryId?', authMiddleware, aiLimiter, analyzeEntry);
router.get('/statement', authMiddleware, generatePersonalStatement);
router.get('/opportunity/overview', authMiddleware, getOpportunityOverview);
router.get('/opportunity/trends', authMiddleware, getOpportunityTrends);
router.patch('/opportunity/entry/:entryId', authMiddleware, updateOpportunityEvidence);
router.get('/opportunity/export', authMiddleware, aiLimiter, exportOpportunityPack);

// Insight engine
router.get('/dashboard-insight', authMiddleware, getHeroDashboardInsight);
router.get('/weekly-digest', authMiddleware, aiLimiter, getWeeklyDigest);
router.post('/insight-feedback', authMiddleware, postInsightFeedback);

export default router;
