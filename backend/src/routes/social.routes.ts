import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { importPosts } from '../controllers/social.controller';
import { securityConfig } from '../config/security';
import { createRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
const socialImportLimiter = createRateLimiter({
    keyPrefix: 'social-import',
    windowMs: securityConfig.rateLimits.socialImport.windowMs,
    max: securityConfig.rateLimits.socialImport.max,
    message: 'Social import requests are coming in too quickly. Please wait a moment and try again.',
    strategy: 'ip-and-user',
});

router.use(authMiddleware);

router.post('/import', socialImportLimiter, importPosts);

export default router;
