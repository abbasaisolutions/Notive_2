import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { hashToken } from '../utils/token-security';
import { verifyGoogleCredential } from '../utils/google-auth';

const getRefreshTokenExpiry = (): Date => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    return expiry;
};

const isMobileClient = (req: Request): boolean => {
    const platform = (req.header('x-client-platform') || '').toLowerCase();
    return platform === 'mobile' || platform === 'capacitor' || platform === 'native';
};

/**
 * Google Sign-In
 */
export const googleSignIn = async (req: Request, res: Response) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ message: 'Google credential is required' });
        }

        const { googleId, email, name, picture } = await verifyGoogleCredential(credential);
        const normalizedEmail = email.toLowerCase();

        // Check if user exists
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { googleId },
                    { email: normalizedEmail },
                ],
            },
        });

        if (user) {
            // Check if banned
            if (user.isBanned) {
                return res.status(403).json({ message: 'Your account has been suspended' });
            }

            // Update Google ID if linking existing account
            if (!user.googleId) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { googleId, avatarUrl: picture || user.avatarUrl },
                });
            }
        } else {
            // Create new user
            user = await prisma.user.create({
                data: {
                    email: normalizedEmail,
                    googleId,
                    name: name || normalizedEmail.split('@')[0],
                    avatarUrl: picture,
                },
            });
        }

        // Generate tokens
        const accessToken = generateAccessToken({ userId: user.id, email: user.email });
        const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });
        const refreshTokenHash = hashToken(refreshToken);

        // Save refresh token
        const expiresAt = getRefreshTokenExpiry();

        await prisma.refreshToken.create({
            data: {
                token: refreshTokenHash,
                userId: user.id,
                expiresAt,
            },
        });

        // Set refresh token in cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const userWithProfile = await prisma.user.findUnique({
            where: { id: user.id },
            include: { profile: true },
        });

        return res.json({
            message: 'Login successful',
            accessToken,
            ...(isMobileClient(req) ? { refreshToken } : {}),
            user: {
                id: userWithProfile?.id || user.id,
                email: userWithProfile?.email || user.email,
                name: userWithProfile?.name || user.name,
                avatarUrl: userWithProfile?.avatarUrl || user.avatarUrl,
                role: userWithProfile?.role || user.role,
                hasPassword: Boolean(userWithProfile?.password || user.password),
                createdAt: userWithProfile?.createdAt || user.createdAt,
                profile: userWithProfile?.profile || null,
            },
        });
    } catch (error) {
        console.error('Google sign-in error:', error);
        return res.status(500).json({ message: 'Google sign-in failed' });
    }
};
