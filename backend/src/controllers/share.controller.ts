import { Request, Response } from 'express';
import prisma from '../config/prisma';
import crypto from 'crypto';

/**
 * Create a share link for an entry
 */
export const createEntryShareLink = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { id } = req.params;
        const { expiresIn } = req.body; // Optional: hours until expiry

        // Verify entry belongs to user
        const entry = await prisma.entry.findFirst({
            where: { id, userId, deletedAt: null },
        });

        if (!entry) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        // Check for existing share link
        const existing = await prisma.shareLink.findFirst({
            where: { entryId: id },
        });

        if (existing) {
            return res.json({ shareLink: existing, url: `/share/${existing.token}` });
        }

        // Create new share link
        const shareLink = await prisma.shareLink.create({
            data: {
                token: crypto.randomBytes(16).toString('hex'),
                entryId: id,
                expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) : null,
            },
        });

        return res.status(201).json({ shareLink, url: `/share/${shareLink.token}` });
    } catch (error) {
        console.error('Create share link error:', error);
        return res.status(500).json({ message: 'Failed to create share link' });
    }
};

/**
 * Create a share link for a chapter
 */
export const createChapterShareLink = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { id } = req.params;
        const { expiresIn } = req.body;

        const chapter = await prisma.chapter.findFirst({
            where: { id, userId },
        });

        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        const existing = await prisma.shareLink.findFirst({
            where: { chapterId: id },
        });

        if (existing) {
            return res.json({ shareLink: existing, url: `/share/${existing.token}` });
        }

        const shareLink = await prisma.shareLink.create({
            data: {
                token: crypto.randomBytes(16).toString('hex'),
                chapterId: id,
                expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 60 * 60 * 1000) : null,
            },
        });

        return res.status(201).json({ shareLink, url: `/share/${shareLink.token}` });
    } catch (error) {
        console.error('Create chapter share link error:', error);
        return res.status(500).json({ message: 'Failed to create share link' });
    }
};

/**
 * Get shared content by token (PUBLIC - no auth required)
 */
export const getSharedContent = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;

        const shareLink = await prisma.shareLink.findUnique({
            where: { token },
            include: {
                entry: {
                    select: {
                        id: true,
                        title: true,
                        content: true,
                        contentHtml: true,
                        coverImage: true,
                        mood: true,
                        tags: true,
                        createdAt: true,
                        user: { select: { name: true } },
                    },
                },
                chapter: {
                    include: {
                        entries: {
                            where: { deletedAt: null },
                            orderBy: { createdAt: 'desc' },
                            select: {
                                id: true,
                                title: true,
                                content: true,
                                coverImage: true,
                                mood: true,
                                tags: true,
                                createdAt: true,
                            },
                        },
                        user: { select: { name: true } },
                    },
                },
            },
        });

        if (!shareLink) {
            return res.status(404).json({ message: 'Share link not found or expired' });
        }

        // Check expiry
        if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
            return res.status(410).json({ message: 'Share link has expired' });
        }

        const type = shareLink.entryId ? 'entry' : 'chapter';
        const content = shareLink.entryId ? shareLink.entry : shareLink.chapter;

        return res.json({ type, content });
    } catch (error) {
        console.error('Get shared content error:', error);
        return res.status(500).json({ message: 'Failed to fetch shared content' });
    }
};

/**
 * Revoke a share link
 */
export const revokeShareLink = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { token } = req.params;

        const shareLink = await prisma.shareLink.findUnique({
            where: { token },
            include: { entry: true, chapter: true },
        });

        if (!shareLink) {
            return res.status(404).json({ message: 'Share link not found' });
        }

        // Verify ownership
        const ownsEntry = shareLink.entry?.userId === userId;
        const ownsChapter = shareLink.chapter?.userId === userId;

        if (!ownsEntry && !ownsChapter) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        await prisma.shareLink.delete({ where: { token } });

        return res.json({ message: 'Share link revoked' });
    } catch (error) {
        console.error('Revoke share link error:', error);
        return res.status(500).json({ message: 'Failed to revoke share link' });
    }
};
