import { Router } from 'express';
import {
    createEntry,
    getEntries,
    getEntry,
    updateEntry,
    deleteEntry,
} from '../controllers/entry.controller';
import searchController from '../controllers/search.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All routes are protected
router.use(authMiddleware);

// Search routes (must be before /:id to avoid conflicts)
router.get('/search', searchController.searchEntries);
router.get('/search/suggestions', searchController.getSearchSuggestions);
router.post('/duplicate-check', searchController.checkDuplicateCandidates);
router.get('/resurfaced', searchController.getResurfacedEntries);
router.get('/theme-clusters', searchController.getThemeClusters);
router.get('/:id/related', searchController.getRelatedEntries);

router.post('/', createEntry);
router.get('/', getEntries);
router.get('/:id', getEntry);
router.put('/:id', updateEntry);
router.delete('/:id', deleteEntry);

export default router;
