import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    createChapter,
    getChapters,
    getChapter,
    updateChapter,
    deleteChapter,
    getChapterEntries,
} from '../controllers/chapter.controller';
import { createChapterSchema, updateChapterSchema, validate } from '../utils/validation';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// CRUD routes
router.post('/', validate(createChapterSchema), createChapter);
router.get('/', getChapters);
router.get('/:id', getChapter);
router.put('/:id', validate(updateChapterSchema), updateChapter);
router.delete('/:id', deleteChapter);

// Get entries in a chapter
router.get('/:id/entries', getChapterEntries);

export default router;
