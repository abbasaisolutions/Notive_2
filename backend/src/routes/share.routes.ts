import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    createEntryShareLink,
    createChapterShareLink,
    getSharedContent,
    revokeShareLink,
} from '../controllers/share.controller';
import { createShareLinkSchema, validate } from '../utils/validation';

const router = Router();

// Public route - no auth required
router.get('/:token', getSharedContent);

// Protected routes
router.post('/entry/:id', authMiddleware, validate(createShareLinkSchema), createEntryShareLink);
router.post('/chapter/:id', authMiddleware, validate(createShareLinkSchema), createChapterShareLink);
router.delete('/:token', authMiddleware, revokeShareLink);

export default router;
