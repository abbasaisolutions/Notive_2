import { Router } from 'express';
import {
    analyzeEntry,
    chatWithJournal,
    exportOpportunityPack,
    generatePersonalStatement,
    getOpportunityOverview,
    getOpportunityTrends,
    updateOpportunityEvidence,
} from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();


router.post('/chat', authMiddleware, chatWithJournal);
router.post('/analyze/:entryId?', authMiddleware, analyzeEntry);
router.get('/statement', authMiddleware, generatePersonalStatement);
router.get('/opportunity/overview', authMiddleware, getOpportunityOverview);
router.get('/opportunity/trends', authMiddleware, getOpportunityTrends);
router.patch('/opportunity/entry/:entryId', authMiddleware, updateOpportunityEvidence);
router.get('/opportunity/export', authMiddleware, exportOpportunityPack);

export default router;
