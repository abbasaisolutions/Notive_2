import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from '../utils/jwt';

// Calculate expiry date for refresh token (7 days)
const getRefreshTokenExpiry = (): Date => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    return expiry;
};

// --- REGISTER ---
export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || null,
            },
        });

        // Generate tokens
        const accessToken = generateAccessToken({ userId: user.id, email: user.email });
        const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

        // Store refresh token in DB
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: getRefreshTokenExpiry(),
            },
        });

        // Set refresh token as HttpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.status(201).json({
            message: 'User registered successfully',
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        });
    } catch (error: any) {
        console.error('Register error:', error);
        console.error('Error stack:', error?.stack);
        console.error('Error message:', error?.message);
        return res.status(500).json({ message: 'Internal server error', error: error?.message });
    }
};

// --- LOGIN ---
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
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

        // Store refresh token in DB
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: getRefreshTokenExpiry(),
            },
        });

        // Set refresh token as HttpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.status(200).json({
            message: 'Login successful',
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
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
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token not found' });
        }

        // Verify refresh token
        const payload = verifyRefreshToken(refreshToken);
        if (!payload) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        // Check if token exists in database
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });

        if (!storedToken || storedToken.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Refresh token expired or invalid' });
        }

        // Generate new access token
        const accessToken = generateAccessToken({
            userId: storedToken.user.id,
            email: storedToken.user.email,
        });

        return res.status(200).json({
            accessToken,
            user: {
                id: storedToken.user.id,
                email: storedToken.user.email,
                name: storedToken.user.name,
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
        const refreshToken = req.cookies?.refreshToken;

        if (refreshToken) {
            // Delete refresh token from database
            await prisma.refreshToken.deleteMany({
                where: { token: refreshToken },
            });
        }

        // Clear the cookie
        res.clearCookie('refreshToken');

        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- GET ME (Current User) ---
export const getMe = async (req: Request, res: Response) => {
    try {
        // @ts-ignore - userId is set by auth middleware
        const userId = req.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({ user });
    } catch (error) {
        console.error('GetMe error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
