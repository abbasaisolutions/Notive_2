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
import { securityConfig } from '../config/security';
import { createRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
const searchLimiter = createRateLimiter({
    keyPrefix: 'search',
    windowMs: securityConfig.rateLimits.search.windowMs,
    max: securityConfig.rateLimits.search.max,
    message: 'Search requests are coming in too quickly. Please slow down and try again.',
    keyGenerator: (req) => req.userId || req.ip || 'anonymous',
});

// All routes are protected
router.use(authMiddleware);

// Search routes (must be before /:id to avoid conflicts)
router.get('/search', searchLimiter, searchController.searchEntries);
router.get('/search/suggestions', searchLimiter, searchController.getSearchSuggestions);
router.post('/duplicate-check', searchLimiter, searchController.checkDuplicateCandidates);
router.get('/resurfaced', searchLimiter, searchController.getResurfacedEntries);
router.get('/theme-clusters', searchLimiter, searchController.getThemeClusters);
router.get('/:id/related', searchLimiter, searchController.getRelatedEntries);

router.post('/', createEntry);
router.get('/', getEntries);
router.get('/:id', getEntry);
router.put('/:id', updateEntry);
router.delete('/:id', deleteEntry);

export default router;
