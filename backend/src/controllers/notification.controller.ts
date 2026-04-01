import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * List notifications for the authenticated user.
 * GET /api/v1/notifications?page=1&limit=20&unreadOnly=false
 */
export const listNotifications = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
        const unreadOnly = req.query.unreadOnly === 'true';

        const where = {
            userId,
            ...(unreadOnly ? { readAt: null } : {}),
        };

        const [notifications, total] = await Promise.all([
            prisma.inAppNotification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.inAppNotification.count({ where }),
        ]);

        const unreadCount = unreadOnly
            ? total
            : await prisma.inAppNotification.count({ where: { userId, readAt: null } });

        return res.json({ notifications, total, unreadCount, page, limit });
    } catch (error) {
        console.error('List notifications error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Mark a single notification as read.
 * PATCH /api/v1/notifications/:id/read
 */
export const markNotificationRead = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const notification = await prisma.inAppNotification.findFirst({
            where: { id, userId },
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (!notification.readAt) {
            await prisma.inAppNotification.update({
                where: { id },
                data: { readAt: new Date() },
            });
        }

        return res.json({ message: 'Marked as read' });
    } catch (error) {
        console.error('Mark notification read error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Mark all notifications as read for the authenticated user.
 * PATCH /api/v1/notifications/read-all
 */
export const markAllNotificationsRead = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        await prisma.inAppNotification.updateMany({
            where: { userId, readAt: null },
            data: { readAt: new Date() },
        });

        return res.json({ message: 'All marked as read' });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
