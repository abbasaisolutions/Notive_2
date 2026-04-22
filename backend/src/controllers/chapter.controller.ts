import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { buildEntryStorySignal } from '../services/opportunity.service';

/**
 * Create a new chapter
 */
export const createChapter = async (req: Request, res: Response) => {
    try {
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
        const userId = req.userId;
        const { id } = req.params;
        const pageRaw = parseInt(req.query.page as string, 10);
        const limitRaw = parseInt(req.query.limit as string, 10);
        const page = Number.isFinite(pageRaw) ? Math.max(pageRaw, 1) : 1;
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
        const skip = (page - 1) * limit;

        const chapter = await prisma.chapter.findFirst({
            where: { id, userId },
        });

        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        const entryWhere = { chapterId: id, userId, deletedAt: null } as const;

        const [entries, total] = await Promise.all([
            prisma.entry.findMany({
                where: entryWhere,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    title: true,
                    content: true,
                    contentHtml: true,
                    mood: true,
                    source: true,
                    category: true,
                    lifeArea: true,
                    chapterId: true,
                    tags: true,
                    skills: true,
                    lessons: true,
                    reflection: true,
                    analysis: true,
                    coverImage: true,
                    locationLat: true,
                    locationLng: true,
                    locationName: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.entry.count({ where: entryWhere }),
        ]);

        return res.json({
            chapter,
            entries: entries.map((entry) => {
                const { analysis, reflection, ...responseEntry } = entry;
                return {
                    ...responseEntry,
                    storySignal: buildEntryStorySignal({
                        id: entry.id,
                        title: entry.title,
                        content: entry.content,
                        mood: entry.mood,
                        tags: entry.tags,
                        skills: entry.skills,
                        lessons: entry.lessons,
                        reflection,
                        createdAt: entry.createdAt,
                        analysis,
                    }),
                };
            }),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get chapter entries error:', error);
        return res.status(500).json({ message: 'Failed to fetch chapter entries' });
    }
};

