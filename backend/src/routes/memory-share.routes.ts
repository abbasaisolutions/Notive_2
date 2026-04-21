import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/rate-limit.middleware';
import {
    searchUsers,
    recentRecipients,
    createBundle,
    listReceived,
    listSent,
    markAllReceivedRead,
    markSharedNotificationsRead,
    respondToShareRequest,
    getBundleDetail,
    reactToBundle,
    revokeBundle,
    entryShareStats,
} from '../controllers/memory-share.controller';

const router = Router();

router.use(authMiddleware);

const searchLimiter = createRateLimiter({
    keyPrefix: 'memory-share-user-search',
    windowMs: 60_000,
    max: 30,
    message: 'Too many search requests, please try again shortly',
});

// User search / recent
router.get('/users/search', searchLimiter, searchUsers);
router.get('/users/recent', recentRecipients);

// Bundles
router.post('/bundles', createBundle);
router.get('/received', listReceived);
router.patch('/received/read-all', markAllReceivedRead);
router.get('/sent', listSent);
router.get('/entry-share-stats', entryShareStats);
router.patch('/notifications/read', markSharedNotificationsRead);
router.patch('/requests/:senderId/respond', respondToShareRequest);
router.get('/bundles/:id', getBundleDetail);
router.patch('/bundles/:id/react', reactToBundle);
router.delete('/bundles/:id', revokeBundle);

export default router;
