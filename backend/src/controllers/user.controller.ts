import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                role: true,
                googleId: true,
                createdAt: true,
                profile: true, // Include the profile relation
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({ user });
    } catch (error) {
        console.error('Get profile error:', error);
        return res.status(500).json({ message: 'Failed to fetch profile' });
    }
};

/**
 * Update user profile
 */
export const updateProfile = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { name, email, avatarUrl, bio, location, occupation, website, lifeGoals } = req.body;

        // Check if email is already taken by another user
        if (email) {
            const existing = await prisma.user.findFirst({
                where: { email, NOT: { id: userId } },
            });
            if (existing) {
                return res.status(400).json({ message: 'Email already in use' });
            }
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(name !== undefined && { name }),
                ...(email !== undefined && { email }),
                ...(avatarUrl !== undefined && { avatarUrl }),
                // Update or Create the linked profile
                profile: {
                    upsert: {
                        create: {
                            bio,
                            location,
                            occupation,
                            website,
                            lifeGoals: lifeGoals || [],
                        },
                        update: {
                            ...(bio !== undefined && { bio }),
                            ...(location !== undefined && { location }),
                            ...(occupation !== undefined && { occupation }),
                            ...(website !== undefined && { website }),
                            ...(lifeGoals !== undefined && { lifeGoals }),
                        }
                    }
                }
            },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                role: true,
                profile: true,
            },
        });

        return res.json({ message: 'Profile updated', user });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({ message: 'Failed to update profile' });
    }
};

/**
 * Change password
 */
export const changePassword = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { currentPassword, newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If user has a password (not SSO-only), verify current password
        if (user.password) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required' });
            }
            const isValid = await bcrypt.compare(currentPassword, user.password);
            if (!isValid) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        return res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ message: 'Failed to change password' });
    }
};

/**
 * Upload avatar via URL
 */
export const updateAvatar = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { avatarUrl } = req.body;

        const user = await prisma.user.update({
            where: { id: userId },
            data: { avatarUrl },
            select: {
                id: true,
                avatarUrl: true,
            },
        });

        return res.json({ message: 'Avatar updated', user });
    } catch (error) {
        console.error('Update avatar error:', error);
        return res.status(500).json({ message: 'Failed to update avatar' });
    }
};
