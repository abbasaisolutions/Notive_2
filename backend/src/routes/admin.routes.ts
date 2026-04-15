import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../middleware/admin.middleware';
import {
    getAllUsers,
    getPerformanceOverview,
    getPlatformStats,
    getUserDetails,
    updateUserRole,
    toggleUserBan,
    revokeUserSessions,
    deleteUser,
} from '../controllers/admin.controller';
import { adminActionSchema, updateUserRoleSchema, validate } from '../utils/validation';

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware);
router.use(requireAdmin);

// Admin routes
router.get('/users', getAllUsers);
router.get('/stats', getPlatformStats);
router.get('/performance-overview', getPerformanceOverview);
router.get('/users/:userId', getUserDetails);
router.put('/users/:userId/role', validate(updateUserRoleSchema), updateUserRole);
router.put('/users/:userId/ban', validate(adminActionSchema), toggleUserBan);
router.post('/users/:userId/revoke-sessions', validate(adminActionSchema), revokeUserSessions);

// Superadmin only
router.delete('/users/:userId', requireSuperAdmin, validate(adminActionSchema), deleteUser);

export default router;
