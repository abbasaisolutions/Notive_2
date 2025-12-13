import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization header missing or invalid' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);

    if (!payload) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Attach user info to request
    // @ts-ignore
    req.userId = payload.userId;
    // @ts-ignore
    req.userEmail = payload.email;

    next();
};
