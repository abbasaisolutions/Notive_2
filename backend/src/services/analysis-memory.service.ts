import prisma from '../config/prisma';
import embeddingService from './embedding.service';
import { getEmbeddingFacetLabel, type EmbeddingFacetType } from '../utils/embedding-facets';

type FacetMatchRow = {
    entryId: string;
    facetType: EmbeddingFacetType;
    facetText: string;
    semanticScore: number | null;
    distance: number | null;
    title: string | null;
    mood: string | null;
    createdAt: Date;
    tags: string[] | null;
};

export type AnalysisMemoryMatch = {
    entryId: string;
    title: string | null;
    mood: string | null;
    createdAt: Date;
    facetType: EmbeddingFacetType;
    facetLabel: string;
    facetText: string;
    semanticScore: number;
};

export type AnalysisMemoryContext = {
    topSimilarity: number;
    relatedEntryCount: number;
    familiarity: 'new' | 'related' | 'repeat';
    recurringThemes: string[];
    recurringSkills: string[];
    recurringLessons: string[];
    topMatches: AnalysisMemoryMatch[];
    summary: string;
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseScore = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseFloat(String(value || ''));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(1, parsed));
};

const ANALYSIS_MEMORY_LIMIT = parsePositiveInt(process.env.ANALYSIS_MEMORY_LIMIT, 6);
const ANALYSIS_MEMORY_MIN_SCORE = parseScore(process.env.ANALYSIS_MEMORY_MIN_SCORE, 0.24);
const ANALYSIS_MEMORY_REPEAT_SCORE = parseScore(process.env.ANALYSIS_MEMORY_REPEAT_SCORE, 0.82);
const ANALYSIS_MEMORY_RELATED_SCORE = parseScore(process.env.ANALYSIS_MEMORY_RELATED_SCORE, 0.62);

const toVectorLiteral = (values: number[]) => `[${values.join(',')}]`;
const toVectorDimension = (value: number) => Math.max(1, Math.trunc(value));

const normalizeScore = (value: number | null | undefined): number =>
    Number.isFinite(Number(value)) ? Number(value) : 0;

const normalizeQuery = (content: string, title?: string | null) => {
    const normalizedTitle = String(title || '').trim();
    const normalizedContent = String(content || '').trim();
    if (normalizedTitle) {
        return `${normalizedTitle}\n\n${normalizedContent}`.trim();
    }
    return normalizedContent;
};

const countTopStrings = (values: string[], limit: number): string[] => {
    const counts = new Map<string, number>();

    values.forEach((value) => {
        const normalized = value.replace(/\s+/g, ' ').trim();
        if (!normalized) return;
        const key = normalized.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([value]) =>
            value
                .split(' ')
                .filter(Boolean)
                .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
                .join(' ')
        );
};

const buildMemorySummary = (context: {
    relatedEntryCount: number;
    recurringThemes: string[];
    recurringSkills: string[];
    recurringLessons: string[];
    familiarity: AnalysisMemoryContext['familiarity'];
}) => {
    if (context.relatedEntryCount === 0) return '';

    const parts: string[] = [];
    parts.push(
        context.familiarity === 'repeat'
            ? `Very close to ${context.relatedEntryCount} earlier ${context.relatedEntryCount === 1 ? 'entry' : 'entries'}`
            : `Related to ${context.relatedEntryCount} earlier ${context.relatedEntryCount === 1 ? 'entry' : 'entries'}`
    );

    if (context.recurringThemes.length > 0) {
        parts.push(`often around ${context.recurringThemes.slice(0, 2).join(', ')}`);
    }
    if (context.recurringSkills.length > 0) {
        parts.push(`with recurring strengths like ${context.recurringSkills.slice(0, 2).join(', ')}`);
    } else if (context.recurringLessons.length > 0) {
        parts.push(`and lessons like ${context.recurringLessons.slice(0, 1).join(', ')}`);
    }

    return `${parts.join(' ')}.`;
};

class AnalysisMemoryService {
    async buildContext(input: {
        userId: string;
        content: string;
        title?: string | null;
        excludeEntryId?: string | null;
        limit?: number;
    }): Promise<AnalysisMemoryContext | null> {
        if (!embeddingService.isEnabled()) {
            return null;
        }

        const query = normalizeQuery(input.content, input.title);
        if (query.length < 10) {
            return null;
        }

        try {
            const queryEmbedding = await embeddingService.embedText({
                content: query,
                purpose: 'query',
            });
            if (!queryEmbedding || queryEmbedding.length === 0) {
                return null;
            }

            const activeConfig = embeddingService.getActiveConfig();
            const vectorDimensions = toVectorDimension(activeConfig.dimensions);
            const vectorLiteral = toVectorLiteral(queryEmbedding);
            const limit = Math.max(1, Math.min(input.limit || ANALYSIS_MEMORY_LIMIT, 10));
            const candidateLimit = Math.max(limit * 4, 20);

            const rows = await prisma.$queryRawUnsafe<FacetMatchRow[]>(
                `
                SELECT
                    facet."entryId" AS "entryId",
                    facet."facetType" AS "facetType",
                    facet."facetText" AS "facetText",
                    GREATEST(0, 1 - ((facet.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions}))))::REAL AS "semanticScore",
                    ((facet.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions})))::REAL AS distance,
                    e.title AS title,
                    e.mood AS mood,
                    e."createdAt" AS "createdAt",
                    e.tags AS tags
                FROM "EntryEmbeddingFacet" facet
                JOIN "Entry" e ON e.id = facet."entryId"
                WHERE facet."userId" = $2
                    AND e."userId" = $2
                    AND e."deletedAt" IS NULL
                    AND facet.model = $3
                    AND facet.dimensions = $4
                    AND ($5::text IS NULL OR facet."entryId" <> $5)
                ORDER BY (facet.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions})) ASC, e."createdAt" DESC
                LIMIT $6
                `,
                vectorLiteral,
                input.userId,
                activeConfig.model,
                activeConfig.dimensions,
                input.excludeEntryId || null,
                candidateLimit
            );

            const matches: AnalysisMemoryMatch[] = [];
            const perEntryCount = new Map<string, number>();
            const seenFacetTexts = new Set<string>();

            for (const row of rows) {
                const semanticScore = normalizeScore(row.semanticScore);
                if (semanticScore < ANALYSIS_MEMORY_MIN_SCORE) continue;

                const dedupeKey = `${row.entryId}:${row.facetType}:${String(row.facetText || '').toLowerCase()}`;
                if (seenFacetTexts.has(dedupeKey)) continue;

                const currentEntryCount = perEntryCount.get(row.entryId) || 0;
                if (currentEntryCount >= 2) continue;

                seenFacetTexts.add(dedupeKey);
                perEntryCount.set(row.entryId, currentEntryCount + 1);
                matches.push({
                    entryId: row.entryId,
                    title: row.title,
                    mood: row.mood,
                    createdAt: row.createdAt,
                    facetType: row.facetType,
                    facetLabel: getEmbeddingFacetLabel(row.facetType),
                    facetText: row.facetText,
                    semanticScore: Number(semanticScore.toFixed(3)),
                });

                if (matches.length >= limit) break;
            }

            if (matches.length === 0) {
                return null;
            }

            const matchedEntryIds = new Set(matches.map((match) => match.entryId));
            const topSimilarity = matches[0]?.semanticScore || 0;
            const familiarity: AnalysisMemoryContext['familiarity'] =
                topSimilarity >= ANALYSIS_MEMORY_REPEAT_SCORE
                    ? 'repeat'
                    : topSimilarity >= ANALYSIS_MEMORY_RELATED_SCORE
                        ? 'related'
                        : 'new';

            const recurringThemes = countTopStrings(
                rows
                    .filter((row) => matchedEntryIds.has(row.entryId))
                    .flatMap((row) => Array.isArray(row.tags) ? row.tags : []),
                5
            );
            const recurringSkills = countTopStrings(
                matches
                    .filter((match) => match.facetType === 'skill')
                    .map((match) => match.facetText),
                4
            );
            const recurringLessons = countTopStrings(
                matches
                    .filter((match) => match.facetType === 'lesson' || match.facetType === 'opportunity_lesson')
                    .map((match) => match.facetText),
                3
            );

            return {
                topSimilarity: Number(topSimilarity.toFixed(3)),
                relatedEntryCount: matchedEntryIds.size,
                familiarity,
                recurringThemes,
                recurringSkills,
                recurringLessons,
                topMatches: matches,
                summary: buildMemorySummary({
                    relatedEntryCount: matchedEntryIds.size,
                    recurringThemes,
                    recurringSkills,
                    recurringLessons,
                    familiarity,
                }),
            };
        } catch (error) {
            console.error('Analysis memory retrieval failed:', error);
            return null;
        }
    }
}

export default new AnalysisMemoryService();
