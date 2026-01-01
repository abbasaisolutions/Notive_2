// Search Controller - Full-text search endpoint
// File: backend/src/controllers/search.controller.ts

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SearchController {
    /**
     * Search entries using PostgreSQL full-text search
     * GET /api/v1/entries/search?q=query&limit=20
     */
    async searchEntries(req: Request, res: Response) {
        try {
            const userId = (req as any).userId;
            const query = req.query.q as string;
            const limit = parseInt(req.query.limit as string) || 20;

            if (!query || query.trim().length < 2) {
                return res.status(400).json({
                    message: 'Search query must be at least 2 characters',
                });
            }

            // Use raw SQL for full-text search with relevance ranking
            const results = await prisma.$queryRaw<any[]>`
        SELECT 
          id,
          title,
          content,
          mood,
          "createdAt" as created_at,
          ts_rank(
            content_vector,
            websearch_to_tsquery('english', ${query})
          )::REAL as relevance
        FROM "Entry"
        WHERE 
          user_id = ${userId}
          AND content_vector @@ websearch_to_tsquery('english', ${query})
        ORDER BY relevance DESC, "createdAt" DESC
        LIMIT ${limit}
      `;

            // Format results
            const formattedResults = results.map(result => ({
                id: result.id,
                title: result.title,
                content: result.content,
                mood: result.mood,
                createdAt: result.created_at,
                relevance: result.relevance,
            }));

            return res.json({
                results: formattedResults,
                count: formattedResults.length,
                query,
            });
        } catch (error: any) {
            console.error('Search error:', error);
            return res.status(500).json({
                message: 'Search failed',
                error: error.message,
            });
        }
    }

    /**
     * Get search suggestions based on tags and past searches
     * GET /api/v1/entries/search/suggestions
     */
    async getSearchSuggestions(req: Request, res: Response) {
        try {
            const userId = (req as any).userId;

            // Get top tags for suggestions
            const topTags = await prisma.$queryRaw<any[]>`
        SELECT t.name, COUNT(*) as count
        FROM "Tag" t
        JOIN "_EntryToTag" et ON et."B" = t.id
        JOIN "Entry" e ON e.id = et."A"
        WHERE e.user_id = ${userId}
        GROUP BY t.name
        ORDER BY count DESC
        LIMIT 10
      `;

            // Get common moods
            const topMoods = await prisma.$queryRaw<any[]>`
        SELECT mood, COUNT(*) as count
        FROM "Entry"
        WHERE user_id = ${userId}
          AND mood IS NOT NULL
        GROUP BY mood
        ORDER BY count DESC
        LIMIT 5
      `;

            return res.json({
                suggestions: {
                    tags: topTags.map(t => t.name),
                    moods: topMoods.map(m => m.mood),
                },
            });
        } catch (error: any) {
            console.error('Suggestions error:', error);
            return res.status(500).json({
                message: 'Failed to get suggestions',
                error: error.message,
            });
        }
    }
}

export default new SearchController();
