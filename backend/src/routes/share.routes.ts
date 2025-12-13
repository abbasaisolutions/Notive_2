import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    createEntryShareLink,
    createChapterShareLink,
    getSharedContent,
    revokeShareLink,
} from '../controllers/share.controller';

const router = Router();

// Public route - no auth required
router.get('/:token', getSharedContent);

// Protected routes
router.post('/entry/:id', authMiddleware, createEntryShareLink);
router.post('/chapter/:id', authMiddleware, createChapterShareLink);
router.delete('/:token', authMiddleware, revokeShareLink);

export default router;
