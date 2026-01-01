import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getProfile, updateProfile, changePassword, updateAvatar, exportData, deleteAccount } from '../controllers/user.controller';
import { googleSignIn } from '../controllers/google.controller';

const router = Router();

// Google SSO (public)
router.post('/google', googleSignIn);

// Protected routes
router.use(authMiddleware);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);
router.put('/avatar', updateAvatar);
router.get('/export', exportData);
router.delete('/account', deleteAccount);

export default router;
