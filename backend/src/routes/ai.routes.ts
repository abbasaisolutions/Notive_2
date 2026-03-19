import { Router } from 'express';
import {
    analyzeEntry,
    chatWithJournal,
    exportOpportunityPack,
    generatePersonalStatement,
    getAiCoachStatus,
    getOpportunityOverview,
    getOpportunityTrends,
    updateOpportunityEvidence,
} from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { securityConfig } from '../config/security';
import { createRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
const aiLimiter = createRateLimiter({
    keyPrefix: 'ai',
    windowMs: securityConfig.rateLimits.ai.windowMs,
    max: securityConfig.rateLimits.ai.max,
    message: 'AI requests are coming in too quickly. Please wait a moment and try again.',
    keyGenerator: (req) => req.userId || req.ip || 'anonymous',
});


router.get('/status', authMiddleware, getAiCoachStatus);
router.post('/chat', authMiddleware, aiLimiter, chatWithJournal);
router.post('/analyze/:entryId?', authMiddleware, aiLimiter, analyzeEntry);
router.get('/statement', authMiddleware, generatePersonalStatement);
router.get('/opportunity/overview', authMiddleware, getOpportunityOverview);
router.get('/opportunity/trends', authMiddleware, getOpportunityTrends);
router.patch('/opportunity/entry/:entryId', authMiddleware, updateOpportunityEvidence);
router.get('/opportunity/export', authMiddleware, aiLimiter, exportOpportunityPack);

export default router;
