// Import Routes - Social media import endpoints
// File: backend/src/routes/import.routes.ts

import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware';
import socialImportController from '../controllers/social-import.controller';

const router = Router();

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
router.post('/batch', authMiddleware, socialImportController.importBatch);
router.post('/archive', authMiddleware, archiveUpload.single('file'), socialImportController.importArchive);

// OAuth callbacks (no auth - signed state carries callback context)
router.get('/callback/instagram', socialImportController.instagramCallback);
router.get('/callback/facebook', socialImportController.facebookCallback);

export default router;
