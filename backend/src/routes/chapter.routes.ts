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

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// CRUD routes
router.post('/', createChapter);
router.get('/', getChapters);
router.get('/:id', getChapter);
router.put('/:id', updateChapter);
router.delete('/:id', deleteChapter);

// Get entries in a chapter
router.get('/:id/entries', getChapterEntries);

export default router;
