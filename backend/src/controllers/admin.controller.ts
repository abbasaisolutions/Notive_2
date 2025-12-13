import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * Get all users (paginated)
 */
export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string || '';
        const skip = (page - 1) * limit;

        const where = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
            ],
        } : {};

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    role: true,
                    isBanned: true,
                    createdAt: true,
                    _count: {
                        select: { entries: true },
                    },
                },
            }),
            prisma.user.count({ where }),
        ]);

        return res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get all users error:', error);
        return res.status(500).json({ message: 'Failed to fetch users' });
    }
};

/**
 * Get platform statistics
 */
export const getPlatformStats = async (req: Request, res: Response) => {
    try {
        const [totalUsers, totalEntries, newUsersThisWeek, activeToday] = await Promise.all([
            prisma.user.count(),
            prisma.entry.count({ where: { deletedAt: null } }),
            prisma.user.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
            prisma.entry.groupBy({
                by: ['userId'],
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        return res.json({
            totalUsers,
            totalEntries,
            newUsersThisWeek,
            activeUsersToday: activeToday.length,
        });
    } catch (error) {
        console.error('Get platform stats error:', error);
        return res.status(500).json({ message: 'Failed to fetch stats' });
    }
};

/**
 * Get single user details
 */
export const getUserDetails = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                role: true,
                isBanned: true,
                googleId: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        entries: true,
                        chapters: true,
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({ user });
    } catch (error) {
        console.error('Get user details error:', error);
        return res.status(500).json({ message: 'Failed to fetch user' });
    }
};

/**
 * Update user role
 */
export const updateUserRole = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!['USER', 'ADMIN', 'SUPERADMIN'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        // @ts-ignore
        const currentUserId = req.userId;

        // Prevent self-demotion
        if (userId === currentUserId && role !== 'SUPERADMIN') {
            return res.status(400).json({ message: 'Cannot change your own role' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: { id: true, email: true, role: true },
        });

        return res.json({ message: 'Role updated', user });
    } catch (error) {
        console.error('Update user role error:', error);
        return res.status(500).json({ message: 'Failed to update role' });
    }
};

/**
 * Ban/unban user
 */
export const toggleUserBan = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // @ts-ignore
        const currentUserId = req.userId;

        // Prevent self-ban
        if (userId === currentUserId) {
            return res.status(400).json({ message: 'Cannot ban yourself' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isBanned: true, role: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent banning admins (only superadmin can)
        // @ts-ignore
        if (user.role !== 'USER' && req.userRole !== 'SUPERADMIN') {
            return res.status(403).json({ message: 'Cannot ban admins' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { isBanned: !user.isBanned },
            select: { id: true, email: true, isBanned: true },
        });

        return res.json({
            message: updatedUser.isBanned ? 'User banned' : 'User unbanned',
            user: updatedUser,
        });
    } catch (error) {
        console.error('Toggle user ban error:', error);
        return res.status(500).json({ message: 'Failed to update ban status' });
    }
};

/**
 * Delete user (superadmin only)
 */
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        // @ts-ignore
        const currentUserId = req.userId;

        // Prevent self-deletion
        if (userId === currentUserId) {
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deleting other superadmins
        if (user.role === 'SUPERADMIN') {
            return res.status(403).json({ message: 'Cannot delete superadmins' });
        }

        await prisma.user.delete({
            where: { id: userId },
        });

        return res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        return res.status(500).json({ message: 'Failed to delete user' });
    }
};
