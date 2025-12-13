import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../middleware/admin.middleware';
import {
    getAllUsers,
    getPlatformStats,
    getUserDetails,
    updateUserRole,
    toggleUserBan,
    deleteUser,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware);
router.use(requireAdmin);

// Admin routes
router.get('/users', getAllUsers);
router.get('/stats', getPlatformStats);
router.get('/users/:userId', getUserDetails);
router.put('/users/:userId/role', updateUserRole);
router.put('/users/:userId/ban', toggleUserBan);

// Superadmin only
router.delete('/users/:userId', requireSuperAdmin, deleteUser);

export default router;
