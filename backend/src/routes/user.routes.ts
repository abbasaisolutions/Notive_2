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

const router = Router();

// Google SSO (public)
router.post('/google', googleSignIn);

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
