import { Router } from 'express';
import { analyzeEntry, generatePersonalStatement } from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/analyze/:entryId?', authMiddleware, analyzeEntry);
router.get('/statement', authMiddleware, generatePersonalStatement);

export default router;
