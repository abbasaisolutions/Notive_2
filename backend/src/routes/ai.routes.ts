import { Router } from 'express';
import { analyzeEntry, generatePersonalStatement, chatWithJournal, rewriteText } from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();


router.post('/chat', authMiddleware, chatWithJournal);
router.post('/analyze/:entryId?', authMiddleware, analyzeEntry);
router.get('/statement', authMiddleware, generatePersonalStatement);
router.post('/rewrite', authMiddleware, rewriteText);

export default router;
