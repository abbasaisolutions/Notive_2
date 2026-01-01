// Import Routes - Social media import endpoints
// File: backend/src/routes/import.routes.ts

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import socialImportController from '../controllers/social-import.controller';

const router = Router();

// Protected routes (require auth)
router.get('/auth-urls', authMiddleware, socialImportController.getAuthUrls);
router.get('/status', authMiddleware, socialImportController.getImportStatus);
router.get('/candidates', authMiddleware, socialImportController.getCandidates);
router.post('/batch', authMiddleware, socialImportController.importBatch);

// OAuth callbacks (no auth - state contains userId)
router.get('/callback/instagram', socialImportController.instagramCallback);
router.get('/callback/facebook', socialImportController.facebookCallback);

export default router;
