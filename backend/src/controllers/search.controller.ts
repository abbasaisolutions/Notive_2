import { Request, Response } from 'express';
import prisma from '../config/prisma';
import semanticSearchService from '../services/semantic-search.service';
import { executeHybridSearch } from '../services/hybrid-search.service';
import retrievalInsightsService from '../services/retrieval-insights.service';
import type { SearchIntent } from '../utils/search-intent';

const VALID_SEARCH_INTENTS = new Set<SearchIntent>([
    'general',
    'emotion',
    'lesson',
    'skill',
    'reflection',
    'memory',
    'action',
]);

export class SearchController {
    async searchEntries(req: Request, res: Response) {
        try {
            const userId = req.userId;
            const query = (req.query.q ?? req.query.search) as string | undefined;
            const requestedIntent = typeof req.query.intent === 'string' ? req.query.intent.trim().toLowerCase() : '';
            const limitRaw = parseInt(req.query.limit as string, 10) || 20;
            const limit = Math.min(Math.max(limitRaw, 1), 50);

            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const normalized = (query || '').trim();
            if (normalized.length < 2) {
                return res.status(400).json({
                    message: 'Search query must be at least 2 characters',
                });
            }

            const result = await executeHybridSearch({
                userId,
                query: normalized,
                limit,
                intent: VALID_SEARCH_INTENTS.has(requestedIntent as SearchIntent)
                    ? (requestedIntent as SearchIntent)
                    : undefined,
            });

            return res.json(result);
        } catch (error: any) {
            console.error('Search error:', error);
            return res.status(500).json({
                message: 'Search failed',
            });
        }
    }

    async getRelatedEntries(req: Request, res: Response) {
        try {
            const userId = req.userId;
            const { id } = req.params;
            const limitRaw = parseInt(req.query.limit as string, 10) || 4;
            const limit = Math.min(Math.max(limitRaw, 1), 8);

            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const entry = await prisma.entry.findFirst({
                where: {
                    id,
                    userId,
                    deletedAt: null,
                },
                select: {
                    id: true,
                    title: true,
                    content: true,
                    mood: true,
                    tags: true,
                },
            });

            if (!entry) {
                return res.status(404).json({ message: 'Entry not found' });
            }

            const relatedEntries = await semanticSearchService.findRelatedEntries({
                userId,
                entryId: entry.id,
                title: entry.title,
                content: entry.content,
                mood: entry.mood,
                tags: entry.tags,
                limit,
            });

            return res.json({
                entryId: entry.id,
                relatedEntries,
                strategy: relatedEntries.some((item) => item.rerankScore)
                    ? 'dense_rerank'
                    : relatedEntries.length > 0
                        ? 'dense'
                        : 'none',
            });
        } catch (error: any) {
            console.error('Related entries error:', error);
            return res.status(500).json({
                message: 'Failed to fetch related entries',
            });
        }
    }

    async checkDuplicateCandidates(req: Request, res: Response) {
        try {
            const userId = req.userId;
            const { content, title, entryId } = req.body as {
                content?: string;
                title?: string | null;
                entryId?: string | null;
            };

            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const normalizedContent = String(content || '').trim();
            if (normalizedContent.length < 60) {
                return res.json({
                    duplicates: [],
                    hasNearDuplicate: false,
                    message: 'Write a little more to check for duplicates.',
                });
            }

            const duplicates = await retrievalInsightsService.findDuplicateCandidates({
                userId,
                content: normalizedContent,
                title: typeof title === 'string' ? title : null,
                excludeEntryId: typeof entryId === 'string' ? entryId : null,
                limit: 4,
            });

            return res.json({
                duplicates,
                hasNearDuplicate: duplicates.some((candidate) => candidate.duplicateKind === 'near_duplicate'),
            });
        } catch (error: any) {
            console.error('Duplicate check error:', error);
            return res.status(500).json({
                message: 'Failed to check for duplicates',
            });
        }
    }

    async getResurfacedEntries(req: Request, res: Response) {
        try {
            const userId = req.userId;
            const limitRaw = parseInt(req.query.limit as string, 10) || 3;
            const limit = Math.min(Math.max(limitRaw, 1), 6);

            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const resurfaced = await retrievalInsightsService.getResurfacedMoments({
                userId,
                limit,
            });

            return res.json({
                resurfaced,
                count: resurfaced.length,
            });
        } catch (error: any) {
            console.error('Resurfaced entries error:', error);
            return res.status(500).json({
                message: 'Failed to fetch resurfaced entries',
            });
        }
    }

    async getOnThisDayEntries(req: Request, res: Response) {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const timezone = (req.query.timezone as string) || 'UTC';
            const entries = await retrievalInsightsService.getOnThisDayEntries(userId, timezone);

            return res.json({
                entries,
                count: entries.length,
            });
        } catch (error: any) {
            console.error('On This Day entries error:', error);
            return res.status(500).json({
                message: 'Failed to fetch on-this-day entries',
            });
        }
    }

    async getThemeClusters(req: Request, res: Response) {
        try {
            const userId = req.userId;
            const limitRaw = parseInt(req.query.limit as string, 10) || 4;
            const limit = Math.min(Math.max(limitRaw, 1), 8);

            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const clusters = await retrievalInsightsService.getThemeClusters({
                userId,
                limit,
            });

            return res.json({
                clusters,
                count: clusters.length,
            });
        } catch (error: any) {
            console.error('Theme cluster error:', error);
            return res.status(500).json({
                message: 'Failed to fetch theme clusters',
            });
        }
    }

    async getSearchSuggestions(req: Request, res: Response) {
        try {
            const userId = req.userId;

            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const limitRaw = parseInt(req.query.limit as string, 10) || 10;
            const limit = Math.min(Math.max(limitRaw, 1), 25);

            let topTags = await prisma.$queryRaw<Array<{ tag: string; count: bigint }>>`
                SELECT
                    t.name as tag,
                    COUNT(*)::bigint as count
                FROM "EntryTag" et
                JOIN "Tag" t ON t.id = et."tagId"
                JOIN "Entry" e ON e.id = et."entryId"
                WHERE et."userId" = ${userId}
                    AND e."deletedAt" IS NULL
                GROUP BY t.name
                ORDER BY count DESC
                LIMIT ${limit};
            `;

            if (!topTags || topTags.length === 0) {
                topTags = await prisma.$queryRaw<Array<{ tag: string; count: bigint }>>`
                SELECT
                    tag,
                    COUNT(*)::bigint as count
                FROM (
                    SELECT unnest(e.tags) as tag
                    FROM "Entry" e
                    WHERE e."userId" = ${userId}
                        AND e."deletedAt" IS NULL
                ) t
                WHERE tag IS NOT NULL AND tag <> ''
                GROUP BY tag
                ORDER BY count DESC
                LIMIT ${limit};
            `;
            }

            const topMoods = await prisma.$queryRaw<Array<{ mood: string; count: bigint }>>`
                SELECT
                    e.mood,
                    COUNT(*)::bigint as count
                FROM "Entry" e
                WHERE e."userId" = ${userId}
                    AND e."deletedAt" IS NULL
                    AND e.mood IS NOT NULL
                GROUP BY e.mood
                ORDER BY count DESC
                LIMIT 5;
            `;

            return res.json({
                suggestions: {
                    tags: topTags.map((tagRow: { tag: string; count: bigint }) => tagRow.tag),
                    moods: topMoods.map((moodRow: { mood: string; count: bigint }) => moodRow.mood),
                },
            });
        } catch (error: any) {
            console.error('Suggestions error:', error);
            return res.status(500).json({
                message: 'Failed to get suggestions',
            });
        }
    }
}

export default new SearchController();
