import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead,
} from '../controllers/notification.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', listNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);

export default router;
