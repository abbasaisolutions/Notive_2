import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from '../utils/jwt';
import crypto from 'crypto';
import { emailService } from '../services/email.service';
import { hashToken } from '../utils/token-security';
import { clearRefreshTokenCookie, setRefreshTokenCookie } from '../utils/refresh-token-cookie';

// Calculate expiry date for refresh token (7 days)
const getRefreshTokenExpiry = (): Date => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    return expiry;
};

const isMobileClient = (req: Request): boolean => {
    const platform = (req.header('x-client-platform') || '').toLowerCase();
    return platform === 'mobile' || platform === 'capacitor' || platform === 'native';
};

const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, and a number';
const hasStrongPassword = (value: string): boolean =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);

const parseBirthDate = (value: unknown): Date | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let parsed: Date;

    if (dateOnlyMatch) {
        const [, year, month, day] = dateOnlyMatch;
        parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    } else {
        const raw = new Date(trimmed);
        if (Number.isNaN(raw.getTime())) {
            return null;
        }
        parsed = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
    }

    if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) {
        return null;
    }

    return parsed;
};

// --- REGISTER ---
export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, birthDate } = req.body;
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const parsedBirthDate = parseBirthDate(birthDate);

        // Validate input
        if (!normalizedEmail || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        if (!parsedBirthDate) {
            return res.status(400).json({ message: 'Birth date is required' });
        }
        if (!hasStrongPassword(password)) {
            return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: normalizedEmail,
                password: hashedPassword,
                name: name || null,
                profile: {
                    create: {
                        birthDate: parsedBirthDate,
                        lifeGoals: [],
                        outputGoals: [],
                    },
                },
            },
            include: { profile: true },
        });

        // Generate tokens
        const accessToken = generateAccessToken({ userId: user.id, email: user.email });
        const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });
        const refreshTokenHash = hashToken(refreshToken);

        // Store refresh token in DB
        await prisma.refreshToken.create({
            data: {
                token: refreshTokenHash,
                userId: user.id,
                expiresAt: getRefreshTokenExpiry(),
            },
        });

        // Set refresh token as HttpOnly cookie
        setRefreshTokenCookie(res, refreshToken);

        return res.status(201).json({
            message: 'User registered successfully',
            accessToken,
            ...(isMobileClient(req) ? { refreshToken } : {}),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                role: user.role,
                hasPassword: Boolean(user.password),
                createdAt: user.createdAt,
                profile: user.profile,
            },
        });
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- LOGIN ---
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const isDevelopment = process.env.NODE_ENV !== 'production';

        // Validate input
        if (!normalizedEmail || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            include: { profile: true },
        });
        if (!user) {
            if (isDevelopment) {
                const userCount = await prisma.user.count();
                if (userCount === 0) {
                    return res.status(401).json({
                        message: 'No local accounts exist yet. Create one from Register or seed an admin user first.',
                    });
                }
            }
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        if (user.isBanned) {
            return res.status(403).json({ message: 'Your account has been suspended' });
        }

        // Verify password (SSO users don't have passwords)
        if (!user.password) {
            return res.status(401).json({ message: 'Please use Google Sign-In for this account' });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate tokens
        const accessToken = generateAccessToken({ userId: user.id, email: user.email });
        const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });
        const refreshTokenHash = hashToken(refreshToken);

        // Store refresh token in DB
        await prisma.refreshToken.create({
            data: {
                token: refreshTokenHash,
                userId: user.id,
                expiresAt: getRefreshTokenExpiry(),
            },
        });

        // Set refresh token as HttpOnly cookie
        setRefreshTokenCookie(res, refreshToken);

        return res.status(200).json({
            message: 'Login successful',
            accessToken,
            ...(isMobileClient(req) ? { refreshToken } : {}),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                role: user.role,
                hasPassword: Boolean(user.password),
                createdAt: user.createdAt,
                profile: user.profile,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- REFRESH TOKEN ---
export const refresh = async (req: Request, res: Response) => {
    try {
        // Web: sent via httpOnly cookie. Mobile (Capacitor): sent in request body.
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token not found' });
        }

        // Verify refresh token
        const payload = verifyRefreshToken(refreshToken);
        if (!payload) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }
        const refreshTokenHash = hashToken(refreshToken);

        // Check if token exists in database
        let storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshTokenHash },
            include: {
                user: {
                    include: { profile: true },
                },
            },
        });
        if (!storedToken) {
            // Transitional compatibility for sessions minted before token hashing.
            storedToken = await prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: {
                    user: {
                        include: { profile: true },
                    },
                },
            });
        }

        if (!storedToken || storedToken.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Refresh token expired or invalid' });
        }
        if (storedToken.user.isBanned) {
            await prisma.refreshToken.deleteMany({
                where: { userId: storedToken.user.id },
            });
            clearRefreshTokenCookie(res);
            return res.status(403).json({ message: 'Your account has been suspended' });
        }

        // Rotate refresh token to reduce replay risk
        const newRefreshToken = generateRefreshToken({
            userId: storedToken.user.id,
            email: storedToken.user.email,
        });
        const newRefreshTokenHash = hashToken(newRefreshToken);

        await prisma.$transaction([
            prisma.refreshToken.deleteMany({
                where: {
                    token: { in: [refreshTokenHash, refreshToken] },
                },
            }),
            prisma.refreshToken.create({
                data: {
                    token: newRefreshTokenHash,
                    userId: storedToken.user.id,
                    expiresAt: getRefreshTokenExpiry(),
                },
            }),
        ]);

        // Generate new access token
        const accessToken = generateAccessToken({
            userId: storedToken.user.id,
            email: storedToken.user.email,
        });

        // Update cookie for web clients
        setRefreshTokenCookie(res, newRefreshToken);

        return res.status(200).json({
            accessToken,
            ...(isMobileClient(req) ? { refreshToken: newRefreshToken } : {}),
            user: {
                id: storedToken.user.id,
                email: storedToken.user.email,
                name: storedToken.user.name,
                avatarUrl: storedToken.user.avatarUrl,
                role: storedToken.user.role,
                hasPassword: Boolean(storedToken.user.password),
                createdAt: storedToken.user.createdAt,
                profile: storedToken.user.profile,
            },
        });
    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- LOGOUT ---
export const logout = async (req: Request, res: Response) => {
    try {
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

        if (refreshToken) {
            const refreshTokenHash = hashToken(refreshToken);
            // Delete refresh token from database
            await prisma.refreshToken.deleteMany({
                where: {
                    token: { in: [refreshTokenHash, refreshToken] },
                },
            });
        }

        // Clear the cookie
        clearRefreshTokenCookie(res);

        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- GET ME (Current User) ---
export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true, role: true, password: true, profile: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { password, ...safeUser } = user;
        return res.status(200).json({
            user: {
                ...safeUser,
                hasPassword: Boolean(password),
            },
        });
    } catch (error) {
        console.error('GetMe error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- FORGOT PASSWORD ---
export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

        if (!normalizedEmail) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        // Always return success even if user not found to prevent enumeration attacks
        if (!user) {
            return res.status(200).json({ message: 'If an account with that email exists, we sent you a reset link.' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Token expires in 1 hour
        const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: resetTokenHash,
                resetTokenExpiry: passwordResetExpires
            }
        });

        await emailService.sendPasswordResetEmail(user, resetToken);

        return res.status(200).json({ message: 'If an account with that email exists, we sent you a reset link.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- RESET PASSWORD ---
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: 'Token and password are required' });
        }
        if (!hasStrongPassword(password)) {
            return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
        }

        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid token
        const user = await prisma.user.findFirst({
            where: {
                resetToken: resetTokenHash,
                resetTokenExpiry: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        // Update password and clear reset fields
        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        return res.status(200).json({ message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};


