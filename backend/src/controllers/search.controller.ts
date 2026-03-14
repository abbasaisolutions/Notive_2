// Search Controller - Full-text search endpoint
// File: backend/src/controllers/search.controller.ts

import { Request, Response } from 'express';
import prisma from '../config/prisma';

type SearchRow = {
    id: string;
    title: string | null;
    content_preview: string;
    mood: string | null;
    created_at: Date;
    relevance: number | null;
};

export class SearchController {
    /**
     * Search entries using PostgreSQL full-text search (no extra DB columns required).
     *
     * GET /api/v1/entries/search?q=query&limit=20
     *
     * Notes:
     * - We compute `to_tsvector(...)` on-the-fly for compatibility.
     * - Later we can add a GENERATED `tsvector` column + GIN index for speed.
     */
    async searchEntries(req: Request, res: Response) {
        try {
            const userId = req.userId;
            const query = (req.query.q ?? req.query.search) as string | undefined;

            // Cap limit to avoid expensive queries / large payloads on mobile networks.
            const limitRaw = parseInt(req.query.limit as string) || 20;
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

            // Hybrid lexical + fuzzy retrieval:
            // - `ts_rank` from full-text vectors for precise matching
            // - trigram similarity for typo tolerance / natural-language phrasing
            const results = await prisma.$queryRaw<SearchRow[]>`
                WITH q AS (
                    SELECT websearch_to_tsquery('english', ${normalized}) AS tsq
                )
                SELECT
                    e.id,
                    e.title,
                    LEFT(e.content, 600) as content_preview,
                    e.mood,
                    e."createdAt" as created_at,
                    (
                        (COALESCE(ts_rank(e."content_vector", q.tsq), 0) * 0.78) +
                        (GREATEST(
                            similarity(COALESCE(e.title, ''), ${normalized}),
                            similarity(e.content, ${normalized})
                        ) * 0.22)
                    )::REAL as relevance
                FROM "Entry" e
                CROSS JOIN q
                WHERE
                    e."userId" = ${userId}
                    AND e."deletedAt" IS NULL
                    AND (
                        e."content_vector" @@ q.tsq
                        OR similarity(COALESCE(e.title, ''), ${normalized}) > 0.24
                        OR similarity(e.content, ${normalized}) > 0.09
                    )
                ORDER BY relevance DESC, e."createdAt" DESC
                LIMIT ${limit};
            `;

            // Fallback for edge cases (emoji-only, numbers, etc) where tsvector returns nothing.
            if (!results || results.length === 0) {
                const tokens = normalized
                    .split(/\s+/)
                    .map(t => t.trim())
                    .filter(t => t.length >= 2)
                    .slice(0, 10);

                const fallback = await prisma.entry.findMany({
                    where: {
                        userId,
                        deletedAt: null,
                        OR: [
                            { title: { contains: normalized, mode: 'insensitive' } },
                            { content: { contains: normalized, mode: 'insensitive' } },
                            ...(tokens.length > 0 ? [
                                { tags: { hasSome: tokens } },
                                { entryTags: { some: { tag: { normalized: { in: tokens } } } } },
                            ] : []),
                        ],
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    select: {
                        id: true,
                        title: true,
                        content: true,
                        mood: true,
                        createdAt: true,
                    },
                });

                return res.json({
                    results: fallback.map((entry: (typeof fallback)[number]) => ({
                        id: entry.id,
                        title: entry.title,
                        content: entry.content.slice(0, 600),
                        mood: entry.mood,
                        createdAt: entry.createdAt,
                        relevance: 0,
                    })),
                    count: fallback.length,
                    query: normalized,
                });
            }

            return res.json({
                results: results.map((row: SearchRow) => ({
                    id: row.id,
                    title: row.title,
                    content: row.content_preview,
                    mood: row.mood,
                    createdAt: row.created_at,
                    relevance: row.relevance ?? 0,
                })),
                count: results.length,
                query: normalized,
            });
        } catch (error: any) {
            console.error('Search error:', error);
            return res.status(500).json({
                message: 'Search failed',
            });
        }
    }

    /**
     * Get search suggestions based on tags and moods.
     *
     * GET /api/v1/entries/search/suggestions?limit=10
     */
    async getSearchSuggestions(req: Request, res: Response) {
        try {
            const userId = req.userId;

            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            const limitRaw = parseInt(req.query.limit as string) || 10;
            const limit = Math.min(Math.max(limitRaw, 1), 25);

            // Tags are stored as a PostgreSQL text[] (Prisma String[]). We can unnest for counts.
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
