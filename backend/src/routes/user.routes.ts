import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    getProfile,
    patchProfileBasics,
    patchProfilePreferences,
    patchProfilePrivacy,
    updateProfile,
    createSensitiveSession,
    updateEmail,
    changePassword,
    exportData,
    deleteAccount,
} from '../controllers/user.controller';
import { googleSignIn } from '../controllers/google.controller';
import { securityConfig } from '../config/security';
import { createRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
const authAttemptLimiter = createRateLimiter({
    keyPrefix: 'legacy-user-google',
    windowMs: securityConfig.rateLimits.auth.windowMs,
    max: securityConfig.rateLimits.auth.max,
    message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});

// Legacy Google SSO alias. New clients should prefer /api/v1/auth/sso/google/credential.
router.post('/google', authAttemptLimiter, googleSignIn);

// Protected routes
router.use(authMiddleware);

router.get('/profile', getProfile);
router.patch('/profile/basic', patchProfileBasics);
router.patch('/profile/preferences', patchProfilePreferences);
router.patch('/profile/privacy', patchProfilePrivacy);
router.put('/profile', updateProfile);
router.post('/security/re-auth', createSensitiveSession);
router.put('/email', updateEmail);
router.put('/password', changePassword);
// Backward-compatible alias: avatar updates are handled by the profile endpoint.
router.put('/avatar', updateProfile);
router.get('/export', exportData);
router.delete('/account', deleteAccount);

export default router;
