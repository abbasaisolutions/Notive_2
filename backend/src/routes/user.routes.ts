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
import {
    changePasswordSchema,
    createSensitiveSessionSchema,
    deleteAccountSchema,
    googleCredentialSchema,
    patchProfileBasicsSchema,
    patchProfilePreferencesSchema,
    patchProfilePrivacySchema,
    updateEmailSchema,
    updateProfileSchema,
    validate,
} from '../utils/validation';

const router = Router();
const authAttemptLimiter = createRateLimiter({
    keyPrefix: 'legacy-user-google',
    windowMs: securityConfig.rateLimits.auth.windowMs,
    max: securityConfig.rateLimits.auth.max,
    message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});

// Legacy Google SSO alias. New clients should prefer /api/v1/auth/sso/google/credential.
router.post('/google', authAttemptLimiter, validate(googleCredentialSchema), googleSignIn);

// Protected routes
router.use(authMiddleware);

// Backward-compatible alias for older clients that still request /api/v1/user.
router.get('/', getProfile);
router.get('/profile', getProfile);
router.patch('/profile/basic', validate(patchProfileBasicsSchema), patchProfileBasics);
router.patch('/profile/preferences', validate(patchProfilePreferencesSchema), patchProfilePreferences);
router.patch('/profile/privacy', validate(patchProfilePrivacySchema), patchProfilePrivacy);
router.put('/profile', validate(updateProfileSchema), updateProfile);
router.post('/security/re-auth', validate(createSensitiveSessionSchema), createSensitiveSession);
router.put('/email', validate(updateEmailSchema), updateEmail);
router.put('/password', validate(changePasswordSchema), changePassword);
// Backward-compatible alias: avatar updates are handled by the profile endpoint.
router.put('/avatar', validate(updateProfileSchema), updateProfile);
router.get('/export', exportData);
router.delete('/account', validate(deleteAccountSchema), deleteAccount);

export default router;
