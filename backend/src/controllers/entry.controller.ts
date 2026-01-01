import { Request, Response } from 'express';
import prisma from '../config/prisma';
import taggingService from '../services/tagging.service';

// --- CREATE ENTRY ---
export const createEntry = async (req: Request, res: Response) => {
    try {
        // @ts-ignore - userId is set by auth middleware
        const userId = req.userId;
        const { title, content, contentHtml, mood, tags, coverImage, audioUrl, chapterId, autoTag } = req.body;

        if (!content) {
            return res.status(400).json({ message: 'Content is required' });
        }

        // Auto-tag if requested or if no tags provided
        let finalTags = tags || [];
        if (autoTag || ((!tags || tags.length === 0) && content.length > 20)) {
            try {
                const suggestedTags = await taggingService.suggestTags(content, title);
                // Only use high-confidence tags (> 0.7)
                const autoTags = suggestedTags
                    .filter(t => t.confidence > 0.7)
                    .map(t => t.name);

                // Merge with any user-provided tags (user tags take priority)
                finalTags = [...new Set([...finalTags, ...autoTags])];
            } catch (tagError) {
                console.error('Auto-tagging failed, using user tags:', tagError);
            }
        }

        const entry = await prisma.entry.create({
            data: {
                title: title || null,
                content,
                contentHtml: contentHtml || null,
                mood: mood || null,
                tags: finalTags,
                coverImage: coverImage || null,
                audioUrl: audioUrl || null,
                chapterId: chapterId || null,
                userId,
            },
        });

        return res.status(201).json({
            entry,
            suggestedTags: finalTags.length > (tags?.length || 0)
                ? finalTags.filter((t: string) => !tags?.includes(t))
                : [],
        });
    } catch (error) {
        console.error('Create entry error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- GET ALL ENTRIES (with pagination and search) ---
export const getEntries = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;
        const skip = (page - 1) * limit;
        const where: any = {
            userId,
            deletedAt: null,
        };

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
                { tags: { has: search } },
            ];
        }

        const [entries, total] = await Promise.all([
            prisma.entry.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    title: true,
                    content: true,
                    mood: true,
                    tags: true,
                    coverImage: true,
                    audioUrl: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.entry.count({ where }),
        ]);

        return res.status(200).json({
            entries,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get entries error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- GET SINGLE ENTRY ---
export const getEntry = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { id } = req.params;

        const entry = await prisma.entry.findFirst({
            where: { id, userId, deletedAt: null },
        });

        if (!entry) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        return res.status(200).json({ entry });
    } catch (error) {
        console.error('Get entry error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- UPDATE ENTRY ---
export const updateEntry = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { id } = req.params;
        const { title, content, contentHtml, mood, tags, coverImage, audioUrl, chapterId } = req.body;

        // Check if entry exists and belongs to user
        const existing = await prisma.entry.findFirst({
            where: { id, userId, deletedAt: null },
        });

        if (!existing) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        const entry = await prisma.entry.update({
            where: { id },
            data: {
                title: title !== undefined ? title : existing.title,
                content: content !== undefined ? content : existing.content,
                contentHtml: contentHtml !== undefined ? contentHtml : existing.contentHtml,
                mood: mood !== undefined ? mood : existing.mood,
                tags: tags !== undefined ? tags : existing.tags,
                coverImage: coverImage !== undefined ? coverImage : existing.coverImage,
                audioUrl: audioUrl !== undefined ? audioUrl : existing.audioUrl,
                chapterId: chapterId !== undefined ? chapterId : existing.chapterId,
            },  
        });

        return res.status(200).json({ entry });
    } catch (error) {
        console.error('Update entry error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// --- DELETE ENTRY (soft delete) ---
export const deleteEntry = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { id } = req.params;

        // Check if entry exists and belongs to user
        const existing = await prisma.entry.findFirst({
            where: { id, userId, deletedAt: null },
        });

        if (!existing) {
            return res.status(404).json({ message: 'Entry not found' });
        }

        await prisma.entry.update({
            where: { id },
            data: { deletedAt: new Date() },
        });

        return res.status(200).json({ message: 'Entry deleted successfully' });
    } catch (error) {
        console.error('Delete entry error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};
