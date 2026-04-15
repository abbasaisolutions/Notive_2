import { Router } from 'express';
import { createAccountDeletionRequest } from '../controllers/legal.controller';
import { securityConfig } from '../config/security';
import { createRateLimiter } from '../middleware/rate-limit.middleware';
import { accountDeletionRequestSchema, validate } from '../utils/validation';

const router = Router();

const accountDeletionRequestLimiter = createRateLimiter({
    keyPrefix: 'account-deletion-request',
    windowMs: securityConfig.rateLimits.accountDeletion.windowMs,
    max: securityConfig.rateLimits.accountDeletion.max,
    message: 'Too many deletion requests were submitted from this source. Please wait and try again later.',
});

router.post('/account-deletion-requests', accountDeletionRequestLimiter, validate(accountDeletionRequestSchema), createAccountDeletionRequest);

export default router;
