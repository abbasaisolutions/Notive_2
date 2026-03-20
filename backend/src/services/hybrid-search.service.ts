import prisma from '../config/prisma';
import embeddingService from './embedding.service';
import semanticSearchService from './semantic-search.service';
import { extractSearchTerms } from '../utils/search-terms';

type SearchRow = {
    id: string;
    title: string | null;
    content_preview: string;
    mood: string | null;
    created_at: Date;
    relevance: number | null;
};

export type HybridSearchResult = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    createdAt: Date;
    relevance: number;
    strategy: 'lexical' | 'semantic' | 'hybrid' | 'fallback';
    lexicalScore: number;
    semanticScore: number;
    rerankScore: number;
    matchReasons: string[];
    debug: {
        embeddingProvider: string;
        embeddingModel: string;
        rerankerUsed: boolean;
        rerankerModel: string | null;
    };
};

export type HybridSearchResponse = {
    results: HybridSearchResult[];
    count: number;
    query: string;
    searchMode: 'lexical' | 'semantic' | 'hybrid' | 'fallback';
    debug: {
        embeddingProvider: string;
        embeddingModel: string;
        embeddingDimensions: number;
        rerankerConfigured: boolean;
        rerankerModel: string | null;
        rerankerUsed: boolean;
        candidateCounts: {
            lexical: number;
            dense: number;
            rerankPool: number;
        };
    };
};

type SearchCandidate = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    createdAt: Date;
    lexicalScore: number;
    semanticScore: number;
    rerankScore: number;
    relevance: number;
    strategy: 'lexical' | 'semantic' | 'hybrid' | 'fallback';
    matchReasons: string[];
};

const clamp01 = (value: number) => Math.max(0, Math.min(0.99, value));

const normalizeScore = (value: number | null | undefined) =>
    Number.isFinite(Number(value)) ? Number(value) : 0;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const clipContent = (value: string, maxLength: number) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const LEXICAL_TAIL_MIN_RELEVANCE = clamp01(
    Number.parseFloat(process.env.SEARCH_LEXICAL_TAIL_MIN_RELEVANCE || '0.05') || 0.05
);
const SEARCH_RERANK_POOL_LIMIT = parsePositiveInt(process.env.SEARCH_RERANK_POOL_LIMIT, 8);
const SEARCH_RERANK_SKIP_CONFIDENCE = clamp01(
    Number.parseFloat(process.env.SEARCH_RERANK_SKIP_CONFIDENCE || '0.86') || 0.86
);
const SEARCH_RERANK_SKIP_GAP = clamp01(
    Number.parseFloat(process.env.SEARCH_RERANK_SKIP_GAP || '0.08') || 0.08
);

const buildLexicalWhereTokens = (normalized: string): string[] =>
    extractSearchTerms(normalized).slice(0, 10);

const buildLexicalQuery = (normalized: string) => {
    const tokens = buildLexicalWhereTokens(normalized);
    return tokens.join(' ').trim() || normalized;
};

const fetchFallbackEntries = async ({
    userId,
    normalized,
    limit,
}: {
    userId: string;
    normalized: string;
    limit: number;
}) => {
    const tokens = buildLexicalWhereTokens(normalized);
    const lexicalQuery = buildLexicalQuery(normalized);

    return prisma.entry.findMany({
        where: {
            userId,
            deletedAt: null,
            OR: [
                { title: { contains: lexicalQuery, mode: 'insensitive' } },
                { content: { contains: lexicalQuery, mode: 'insensitive' } },
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
};

const fetchLexicalResults = async ({
    userId,
    normalized,
    limit,
}: {
    userId: string;
    normalized: string;
    limit: number;
}) => {
    const lexicalQuery = buildLexicalQuery(normalized);
    return prisma.$queryRaw<SearchRow[]>`
    WITH q AS (
        SELECT websearch_to_tsquery('english', ${lexicalQuery}) AS tsq
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
                similarity(COALESCE(e.title, ''), ${lexicalQuery}),
                similarity(e.content, ${lexicalQuery})
            ) * 0.22)
        )::REAL as relevance
    FROM "Entry" e
    CROSS JOIN q
    WHERE
        e."userId" = ${userId}
        AND e."deletedAt" IS NULL
        AND (
            e."content_vector" @@ q.tsq
            OR similarity(COALESCE(e.title, ''), ${lexicalQuery}) > 0.24
            OR similarity(e.content, ${lexicalQuery}) > 0.09
        )
    ORDER BY relevance DESC, e."createdAt" DESC
    LIMIT ${limit};
`;
};

const buildStrategy = (candidate: Pick<SearchCandidate, 'lexicalScore' | 'semanticScore' | 'strategy'>): SearchCandidate['strategy'] => {
    if (candidate.strategy === 'fallback') return 'fallback';
    if (candidate.lexicalScore > 0 && candidate.semanticScore > 0) return 'hybrid';
    if (candidate.semanticScore > 0) return 'semantic';
    return 'lexical';
};

const buildDisplayRelevance = (candidate: Pick<SearchCandidate, 'lexicalScore' | 'semanticScore' | 'rerankScore' | 'strategy'>) => {
    if (candidate.strategy === 'fallback') {
        return 0.36;
    }

    const strongest = Math.max(candidate.lexicalScore, candidate.semanticScore, candidate.rerankScore);
    if (candidate.lexicalScore > 0 && candidate.semanticScore > 0) {
        return clamp01(strongest + 0.06);
    }
    return clamp01(strongest);
};

const buildBaseConfidence = (candidate: Pick<SearchCandidate, 'lexicalScore' | 'semanticScore'>) => {
    const strongest = Math.max(candidate.lexicalScore, candidate.semanticScore);
    if (candidate.lexicalScore > 0 && candidate.semanticScore > 0) {
        return clamp01(strongest + 0.05);
    }
    return clamp01(strongest);
};

const shouldSkipRerank = (
    rerankPool: SearchCandidate[],
    preRerankFusion: Map<string, {
        lexicalRank?: number;
        denseRank?: number;
        rerankScore?: number;
        fusedScore: number;
    }>
) => {
    if (rerankPool.length < 2) return true;

    const topCandidate = rerankPool[0];
    const secondCandidate = rerankPool[1];
    const topFusion = preRerankFusion.get(topCandidate.id);
    const topConfidence = buildBaseConfidence(topCandidate);
    const secondConfidence = buildBaseConfidence(secondCandidate);
    const confidenceGap = topConfidence - secondConfidence;
    const topAgreesAcrossSignals = topCandidate.lexicalScore > 0 && topCandidate.semanticScore > 0;
    const topDominatesBothRanks = topFusion?.lexicalRank === 1 && topFusion?.denseRank === 1;

    return Boolean(
        topAgreesAcrossSignals
        && topDominatesBothRanks
        && topConfidence >= SEARCH_RERANK_SKIP_CONFIDENCE
        && confidenceGap >= SEARCH_RERANK_SKIP_GAP
    );
};

export const executeHybridSearch = async ({
    userId,
    query,
    limit,
}: {
    userId: string;
    query: string;
    limit: number;
}): Promise<HybridSearchResponse> => {
    const normalized = query.trim();
    const lexicalLimit = Math.max(limit * 2, 12);
    const activeEmbeddingConfig = embeddingService.getActiveConfig();
    const rerankerConfigured = semanticSearchService.canUseReranker();
    const rerankerModel = rerankerConfigured
        ? (process.env.RERANKER_MODEL_NAME || 'cross-encoder/ms-marco-MiniLM-L6-v2')
        : null;

    const [lexicalResults, denseMatches] = await Promise.all([
        fetchLexicalResults({ userId, normalized, limit: lexicalLimit }),
        semanticSearchService.findDenseMatches({
            userId,
            query: normalized,
            limit: lexicalLimit,
        }),
    ]);
    const denseMatchMap = new Map(denseMatches.map((match) => [match.entryId, match]));

    const candidateMap = new Map<string, SearchCandidate>();
    lexicalResults.forEach((row) => {
        candidateMap.set(row.id, {
            id: row.id,
            title: row.title,
            content: row.content_preview,
            mood: row.mood,
            createdAt: row.created_at,
            lexicalScore: clamp01(normalizeScore(row.relevance)),
            semanticScore: 0,
            rerankScore: 0,
            relevance: 0,
            strategy: 'lexical',
            matchReasons: [],
        });
    });

    const denseOnlyIds = denseMatches
        .map((match) => match.entryId)
        .filter((entryId) => !candidateMap.has(entryId));

    if (denseOnlyIds.length > 0) {
        const denseOnlyEntries = await prisma.entry.findMany({
            where: {
                userId,
                deletedAt: null,
                id: { in: denseOnlyIds },
            },
            select: {
                id: true,
                title: true,
                content: true,
                mood: true,
                createdAt: true,
            },
        });

        denseOnlyEntries.forEach((entry) => {
            const denseMatch = denseMatchMap.get(entry.id);
            candidateMap.set(entry.id, {
                id: entry.id,
                title: entry.title,
                content: clipContent(denseMatch?.contentSnippet || entry.content, 600),
                mood: entry.mood,
                createdAt: entry.createdAt,
                lexicalScore: 0,
                semanticScore: 0,
                rerankScore: 0,
                relevance: 0,
                strategy: 'semantic',
                matchReasons: [],
            });
        });
    }

    denseMatches.forEach((match) => {
        const candidate = candidateMap.get(match.entryId);
        if (!candidate) return;
        candidate.semanticScore = clamp01(match.semanticScore);
        if (match.contentSnippet) {
            candidate.content = clipContent(match.contentSnippet, 600);
        }
    });

    if (candidateMap.size === 0) {
        const fallbackEntries = await fetchFallbackEntries({
            userId,
            normalized,
            limit,
        });

        const results: HybridSearchResult[] = fallbackEntries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            content: entry.content.slice(0, 600),
            mood: entry.mood,
            createdAt: entry.createdAt,
            relevance: 0.36,
            strategy: 'fallback',
            lexicalScore: 0,
            semanticScore: 0,
            rerankScore: 0,
            matchReasons: ['Direct text fallback'],
            debug: {
                embeddingProvider: activeEmbeddingConfig.provider,
                embeddingModel: activeEmbeddingConfig.model,
                rerankerUsed: false,
                rerankerModel,
            },
        }));

        return {
            results,
            count: results.length,
            query: normalized,
            searchMode: 'fallback',
            debug: {
                embeddingProvider: activeEmbeddingConfig.provider,
                embeddingModel: activeEmbeddingConfig.model,
                embeddingDimensions: activeEmbeddingConfig.dimensions,
                rerankerConfigured,
                rerankerModel,
                rerankerUsed: false,
                candidateCounts: {
                    lexical: 0,
                    dense: 0,
                    rerankPool: 0,
                },
            },
        };
    }

    const preRerankFusion = semanticSearchService.fuseRankedIds({
        lexicalIds: lexicalResults.map((row) => row.id),
        denseIds: denseMatches.map((match) => match.entryId),
    });

    const rerankPool = [...candidateMap.values()]
        .sort((left, right) => (preRerankFusion.get(right.id)?.fusedScore || 0) - (preRerankFusion.get(left.id)?.fusedScore || 0))
        .slice(0, Math.max(limit, SEARCH_RERANK_POOL_LIMIT));

    const useReranker = rerankerConfigured && !shouldSkipRerank(rerankPool, preRerankFusion);
    const rerankResults = useReranker
        ? await semanticSearchService.rerankCandidates(
            normalized,
            rerankPool.map((candidate) => ({
                id: candidate.id,
                title: candidate.title,
                content: candidate.content,
            })),
            Math.max(1, Math.min(rerankPool.length, limit))
        )
        : [];
    const rerankMap = new Map(rerankResults.map((result) => [result.id, result.score]));

    const fused = semanticSearchService.fuseRankedIds({
        lexicalIds: lexicalResults.map((row) => row.id),
        denseIds: denseMatches.map((match) => match.entryId),
        rerankScores: rerankMap,
    });

    const mappedResults: HybridSearchResult[] = [...candidateMap.values()]
        .map((candidate) => {
            candidate.rerankScore = clamp01(rerankMap.get(candidate.id) || 0);
            candidate.strategy = buildStrategy(candidate);
            candidate.relevance = buildDisplayRelevance(candidate);
            candidate.matchReasons = semanticSearchService.buildSearchMatchReasons({
                query: normalized,
                title: candidate.title,
                content: candidate.content,
                lexicalScore: candidate.lexicalScore,
                semanticScore: candidate.semanticScore,
                rerankScore: candidate.rerankScore,
            });

            return {
                id: candidate.id,
                title: candidate.title,
                content: candidate.content,
                mood: candidate.mood,
                createdAt: candidate.createdAt,
                relevance: candidate.relevance,
                strategy: candidate.strategy,
                lexicalScore: candidate.lexicalScore,
                semanticScore: candidate.semanticScore,
                rerankScore: candidate.rerankScore,
                matchReasons: candidate.matchReasons,
                debug: {
                    embeddingProvider: activeEmbeddingConfig.provider,
                    embeddingModel: activeEmbeddingConfig.model,
                    rerankerUsed: rerankMap.has(candidate.id),
                    rerankerModel,
                },
            };
        })
        .filter((result) =>
            result.strategy !== 'lexical' || result.relevance >= LEXICAL_TAIL_MIN_RELEVANCE
        );

    const results = (mappedResults.length > 0 ? mappedResults : [...candidateMap.values()]
        .map((candidate) => ({
            id: candidate.id,
            title: candidate.title,
            content: candidate.content,
            mood: candidate.mood,
            createdAt: candidate.createdAt,
            relevance: candidate.relevance,
            strategy: candidate.strategy,
            lexicalScore: candidate.lexicalScore,
            semanticScore: candidate.semanticScore,
            rerankScore: candidate.rerankScore,
            matchReasons: candidate.matchReasons,
            debug: {
                embeddingProvider: activeEmbeddingConfig.provider,
                embeddingModel: activeEmbeddingConfig.model,
                rerankerUsed: rerankMap.has(candidate.id),
                rerankerModel,
            },
        } as HybridSearchResult)))
        .sort((left, right) => (fused.get(right.id)?.fusedScore || 0) - (fused.get(left.id)?.fusedScore || 0))
        .slice(0, limit);

    const searchMode = results.some((result) => result.strategy === 'hybrid')
        ? 'hybrid'
        : results.some((result) => result.strategy === 'semantic')
            ? 'semantic'
            : 'lexical';

    return {
        results,
        count: results.length,
        query: normalized,
        searchMode,
        debug: {
            embeddingProvider: activeEmbeddingConfig.provider,
            embeddingModel: activeEmbeddingConfig.model,
            embeddingDimensions: activeEmbeddingConfig.dimensions,
            rerankerConfigured,
            rerankerModel,
            rerankerUsed: results.some((result) => result.debug.rerankerUsed),
            candidateCounts: {
                lexical: lexicalResults.length,
                dense: denseMatches.length,
                rerankPool: rerankPool.length,
            },
        },
    };
};
