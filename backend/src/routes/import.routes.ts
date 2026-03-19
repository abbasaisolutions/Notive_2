// Import Routes - Social media import endpoints
// File: backend/src/routes/import.routes.ts

import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import socialImportController from '../controllers/social-import.controller';
import { securityConfig } from '../config/security';
import { createRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
const importLimiter = createRateLimiter({
    keyPrefix: 'import',
    windowMs: securityConfig.rateLimits.import.windowMs,
    max: securityConfig.rateLimits.import.max,
    message: 'Import actions are happening too quickly. Please wait a moment and try again.',
    keyGenerator: (req) => req.userId || req.ip || 'anonymous',
});
const archiveUploadLimiter = createRateLimiter({
    keyPrefix: 'archive-upload',
    windowMs: securityConfig.rateLimits.archiveUpload.windowMs,
    max: securityConfig.rateLimits.archiveUpload.max,
    message: 'Archive uploads are temporarily limited. Please wait before uploading again.',
    keyGenerator: (req) => req.userId || req.ip || 'anonymous',
});

const archiveUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 250 * 1024 * 1024, // 250MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/zip',
            'application/x-zip-compressed',
            'application/json',
            'text/json',
            'text/plain',
            'application/octet-stream',
        ];
        const name = (file.originalname || '').toLowerCase();
        if (allowedMimes.includes(file.mimetype) || name.endsWith('.zip') || name.endsWith('.json')) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    },
});

// Protected routes (require auth)
router.get('/auth-urls', authMiddleware, socialImportController.getAuthUrls);
router.get('/status', authMiddleware, socialImportController.getImportStatus);
router.get('/candidates', authMiddleware, socialImportController.getCandidates);
router.delete('/connections/:provider', authMiddleware, socialImportController.disconnectConnection);
router.post('/batch', authMiddleware, importLimiter, socialImportController.importBatch);
router.post('/archive', authMiddleware, archiveUploadLimiter, archiveUpload.single('file'), socialImportController.importArchive);

// OAuth callbacks (no auth - signed state carries callback context)
router.get('/callback/instagram', socialImportController.instagramCallback);
router.get('/callback/facebook', socialImportController.facebookCallback);

export default router;
