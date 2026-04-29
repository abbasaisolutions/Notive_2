import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { hashToken } from '../utils/token-security';
import { verifyGoogleCredential } from '../utils/google-auth';
import { setRefreshTokenCookie } from '../utils/refresh-token-cookie';
import { emailService } from '../services/email.service';

const getRefreshTokenExpiry = (): Date => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    return expiry;
};

const isMobileClient = (req: Request): boolean => {
    const platform = (req.header('x-client-platform') || '').toLowerCase();
    return platform === 'mobile' || platform === 'capacitor' || platform === 'native';
};

const resolveGoogleAuthError = (error: unknown) => {
    const rawMessage = error instanceof Error && error.message
        ? error.message
        : 'Google sign-in failed';

    if (rawMessage === 'Google SSO is not configured') {
        return {
            status: 503,
            message: 'Google sign-in is not configured for this environment.',
        };
    }

    if (rawMessage === 'Google credential is required') {
        return {
            status: 400,
            message: 'Google credential is required.',
        };
    }

    if (
        rawMessage === 'Invalid Google token'
        || /audience|wrong recipient|token used too late|malformed|invalid token/i.test(rawMessage)
    ) {
        return {
            status: 401,
            message: 'Google credential could not be verified for this app.',
        };
    }

    if (/deleted_client|invalid_client|oauth client/i.test(rawMessage)) {
        return {
            status: 503,
            message: 'Google sign-in is temporarily unavailable because this environment needs an active Google OAuth client.',
        };
    }

    if (rawMessage === 'Email not provided by Google') {
        return {
            status: 400,
            message: 'Google did not provide an email address for this account.',
        };
    }

    return {
        status: 500,
        message: 'Google sign-in failed',
    };
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

            // Fire-and-forget welcome email
            emailService.sendWelcomeEmail(user).catch(() => {});
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
        setRefreshTokenCookie(res, refreshToken);

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
                updatedAt: userWithProfile?.updatedAt || user.updatedAt,
                profile: userWithProfile?.profile || null,
            },
        });
    } catch (error) {
        console.error('Google sign-in error:', error);
        const resolved = resolveGoogleAuthError(error);
        return res.status(resolved.status).json({ message: resolved.message });
    }
};
