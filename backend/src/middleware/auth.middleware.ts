import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../config/prisma';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Authorization header missing or invalid' });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyAccessToken(token);

        if (!payload) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                isBanned: true,
            },
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        if (user.isBanned) {
            return res.status(403).json({ message: 'Your account has been suspended' });
        }

        // Attach user info to request
        req.userId = user.id;
        req.userEmail = user.email;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
