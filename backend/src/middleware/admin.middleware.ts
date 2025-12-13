import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

/**
 * Middleware to check if user is an admin
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // @ts-ignore
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, isBanned: true },
        });

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        if (user.isBanned) {
            return res.status(403).json({ message: 'Your account has been suspended' });
        }

        if (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        // @ts-ignore
        req.userRole = user.role;
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        return res.status(500).json({ message: 'Authorization failed' });
    }
};

/**
 * Middleware to check if user is a super admin
 */
export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // @ts-ignore
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, isBanned: true },
        });

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        if (user.isBanned) {
            return res.status(403).json({ message: 'Your account has been suspended' });
        }

        if (user.role !== 'SUPERADMIN') {
            return res.status(403).json({ message: 'Super admin access required' });
        }

        next();
    } catch (error) {
        console.error('Super admin middleware error:', error);
        return res.status(500).json({ message: 'Authorization failed' });
    }
};
