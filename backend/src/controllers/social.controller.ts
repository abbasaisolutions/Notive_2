import { Request, Response } from 'express';
import prisma from '../config/prisma';

// Helper to generate mock feed
const generateMockFeed = (source: 'FACEBOOK' | 'INSTAGRAM') => {
    return Array.from({ length: 6 }).map((_, i) => ({
        id: `${source}_${Math.random().toString(36).substr(2, 9)}`,
        source,
        content: source === 'FACEBOOK'
            ? `Reflecting on a great memory from ${2020 + i}. It was a time of growth and learning.`
            : `Amazing vibes with friends! #throwback #${i + 1}`,
        imageUrl: source === 'FACEBOOK'
            ? `https://images.unsplash.com/photo-${1500000000000 + i}?w=500&h=500&fit=crop`
            : `https://images.unsplash.com/photo-${1600000000000 + i}?w=500&h=500&fit=crop`,
        date: new Date(Date.now() - i * 86400000 * 7).toISOString(),
        sourceLink: `https://${source.toLowerCase()}.com/p/${i}`,
    }));
};

/**
 * Get Social Feed (Mock)
 * Returns a list of posts that user can select to import
 */
export const getSocialFeed = async (req: Request, res: Response) => {
    try {
        const { source } = req.params;

        if (source !== 'FACEBOOK' && source !== 'INSTAGRAM') {
            return res.status(400).json({ message: 'Invalid source. Use FACEBOOK or INSTAGRAM' });
        }

        // In real implementation, we would use req.body.accessToken to fetch from Graph API
        const feed = generateMockFeed(source);

        return res.json({ feed });
    } catch (error) {
        console.error('Get social feed error:', error);
        return res.status(500).json({ message: 'Failed to fetch social feed' });
    }
};

/**
 * Import Selected Posts
 * Accepts an array of posts to be converted into entries
 */
export const importPosts = async (req: Request, res: Response) => {
    try {
        // @ts-ignore
        const userId = req.userId;
        const { posts } = req.body;

        if (!Array.isArray(posts) || posts.length === 0) {
            return res.status(400).json({ message: 'No posts provided for import' });
        }

        const createdEntries = [];

        for (const post of posts) {
            // Check if already imported
            const existing = await prisma.entry.findFirst({
                where: {
                    userId,
                    externalId: post.id,
                    source: post.source
                }
            });

            if (existing) continue;

            const entry = await prisma.entry.create({
                data: {
                    userId,
                    title: `${post.source} Memory`,
                    content: post.content || 'Start writing...',
                    contentHtml: post.content ? `<p>${post.content}</p>` : undefined,
                    coverImage: post.imageUrl,
                    source: post.source,
                    externalId: post.id,
                    sourceLink: post.sourceLink,
                    createdAt: new Date(post.date),
                    category: 'PERSONAL',
                    tags: [post.source, 'Imported'],
                }
            });
            createdEntries.push(entry);
        }

        return res.json({
            message: `Successfully imported ${createdEntries.length} memories`,
            entries: createdEntries
        });

    } catch (error) {
        console.error('Import posts error:', error);
        return res.status(500).json({ message: 'Failed to import posts' });
    }
};

// Kept for backward compatibility if needed, but new flow uses getSocialFeed -> importPosts
export const importFacebook = async (req: Request, res: Response) => {
    return res.status(400).json({ message: 'Please use the new Connect -> Select flow' });
};

export const importInstagram = async (req: Request, res: Response) => {
    return res.status(400).json({ message: 'Please use the new Connect -> Select flow' });
};
