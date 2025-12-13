import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * Create a new chapter
 */
export const createChapter = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { name, description, color, icon } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Chapter name is required' });
        }

        const chapter = await prisma.chapter.create({
            data: {
                name,
                description,
                color: color || '#6366f1',
                icon: icon || '📖',
                userId,
            },
            include: {
                _count: {
                    select: { entries: true },
                },
            },
        });

        return res.status(201).json({ chapter });
    } catch (error) {
        console.error('Create chapter error:', error);
        return res.status(500).json({ message: 'Failed to create chapter' });
    }
};

/**
 * Get all chapters for the user
 */
export const getChapters = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;

        const chapters = await prisma.chapter.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { entries: true },
                },
            },
        });

        return res.json({ chapters });
    } catch (error) {
        console.error('Get chapters error:', error);
        return res.status(500).json({ message: 'Failed to fetch chapters' });
    }
};

/**
 * Get a single chapter by ID
 */
export const getChapter = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { id } = req.params;

        const chapter = await prisma.chapter.findFirst({
            where: { id, userId },
            include: {
                _count: {
                    select: { entries: true },
                },
            },
        });

        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        return res.json({ chapter });
    } catch (error) {
        console.error('Get chapter error:', error);
        return res.status(500).json({ message: 'Failed to fetch chapter' });
    }
};

/**
 * Update a chapter
 */
export const updateChapter = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { id } = req.params;
        const { name, description, color, icon } = req.body;

        const existingChapter = await prisma.chapter.findFirst({
            where: { id, userId },
        });

        if (!existingChapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        const chapter = await prisma.chapter.update({
            where: { id },
            data: {
                name: name ?? existingChapter.name,
                description: description ?? existingChapter.description,
                color: color ?? existingChapter.color,
                icon: icon ?? existingChapter.icon,
            },
            include: {
                _count: {
                    select: { entries: true },
                },
            },
        });

        return res.json({ chapter });
    } catch (error) {
        console.error('Update chapter error:', error);
        return res.status(500).json({ message: 'Failed to update chapter' });
    }
};

/**
 * Delete a chapter (entries are unassigned, not deleted)
 */
export const deleteChapter = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { id } = req.params;

        const existingChapter = await prisma.chapter.findFirst({
            where: { id, userId },
        });

        if (!existingChapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        await prisma.chapter.delete({
            where: { id },
        });

        return res.json({ message: 'Chapter deleted successfully' });
    } catch (error) {
        console.error('Delete chapter error:', error);
        return res.status(500).json({ message: 'Failed to delete chapter' });
    }
};

/**
 * Get entries in a chapter
 */
export const getChapterEntries = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { id } = req.params;

        const chapter = await prisma.chapter.findFirst({
            where: { id, userId },
        });

        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        const entries = await prisma.entry.findMany({
            where: {
                chapterId: id,
                userId,
                deletedAt: null,
            },
            orderBy: { createdAt: 'desc' },
        });

        return res.json({ chapter, entries });
    } catch (error) {
        console.error('Get chapter entries error:', error);
        return res.status(500).json({ message: 'Failed to fetch chapter entries' });
    }
};
