import prisma from '../config/prisma';
import embeddingService from './embedding.service';
import { getEmbeddingFacetLabel } from '../utils/embedding-facets';
import { extractSearchTerms } from '../utils/search-terms';
import { buildSearchIntentPlan, isPreferredFacetType, type SearchIntent } from '../utils/search-intent';

type DenseMatchRow = {
    entryId: string;
    contentSnippet: string | null;
    chunkIndex: number | null;
    semanticScore: number | null;
    distance: number | null;
    source: string | null;
    facetType: string | null;
};

export type DenseMatch = {
    entryId: string;
    contentSnippet: string | null;
    chunkIndex: number | null;
    semanticScore: number;
    distance: number;
    source: 'chunk' | 'entry' | 'facet';
    facetType: string | null;
};

export type RerankCandidate = {
    id: string;
    title: string | null;
    content: string;
};

export type RerankResult = {
    id: string;
    score: number;
};

type RelatedEntryRecord = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    createdAt: Date;
    coverImage: string | null;
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

const DENSE_LIMIT = parsePositiveInt(process.env.SEMANTIC_SEARCH_CANDIDATES, 24);
const DENSE_MIN_SCORE = parseScore(process.env.SEMANTIC_SEARCH_MIN_SCORE, 0.16);
const RELATED_MIN_SCORE = parseScore(process.env.RELATED_ENTRIES_MIN_SCORE, 0.18);
const RERANK_LIMIT = parsePositiveInt(process.env.SEMANTIC_SEARCH_RERANK_LIMIT, 10);
const SEMANTIC_RERANK_POOL_LIMIT = parsePositiveInt(process.env.SEMANTIC_RERANK_POOL_LIMIT, 12);
const SEMANTIC_RERANK_SKIP_CONFIDENCE = parseScore(process.env.SEMANTIC_RERANK_SKIP_CONFIDENCE, 0.88);
const SEMANTIC_RERANK_SKIP_GAP = parseScore(process.env.SEMANTIC_RERANK_SKIP_GAP, 0.08);
const RRF_K = parsePositiveInt(process.env.SEMANTIC_SEARCH_RRF_K, 60);
const SIMILARITY_SERVICE_URL = (process.env.SIMILARITY_SERVICE_URL || '').trim().replace(/\/$/, '');

const toVectorLiteral = (values: number[]) => `[${values.join(',')}]`;
const toVectorDimension = (value: number) => Math.max(1, Math.trunc(value));

const normalizeScore = (value: number | null | undefined): number =>
    Number.isFinite(Number(value)) ? Number(value) : 0;

const clamp01 = (value: number) => Math.max(0, Math.min(0.99, value));

const normalizeRerankScore = (value: number | null | undefined): number =>
    clamp01(normalizeScore(value));

const buildRelatedDisplayRelevance = (semanticScore?: number, rerankScore?: number) => {
    const boundedSemantic = clamp01(normalizeScore(semanticScore));
    const boundedRerank = normalizeRerankScore(rerankScore);
    const strongest = Math.max(boundedSemantic, boundedRerank);

    if (boundedSemantic > 0 && boundedRerank > 0) {
        return clamp01(strongest + 0.05);
    }

    return strongest;
};

const buildRerankDocument = (candidate: RerankCandidate): string => {
    const title = candidate.title?.trim();
    const content = candidate.content.trim();
    return title ? `${title}\n\n${content}`.slice(0, 3200) : content.slice(0, 3200);
};

const reciprocalRankFusion = (rank: number) => 1 / (RRF_K + rank);

const clipSnippet = (value: string | null | undefined, maxLength: number): string => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const boostDenseMatchScore = (input: {
    score: number;
    source: DenseMatch['source'];
    facetType: string | null;
    preferredFacetTypes: string[];
    intent: SearchIntent;
}) => {
    const preferredFacet = isPreferredFacetType(input.facetType, input.preferredFacetTypes);

    if (input.source === 'facet') {
        // Pure multiplicative boosts — avoids the non-linear artifacts of mixing
        // multiplicative and additive terms (which inflate weak matches disproportionately).
        const boosted = preferredFacet
            ? input.score * 1.18
            : input.intent === 'general'
                ? input.score * 0.97
                : input.score * 0.98;
        return clamp01(boosted);
    }

    if (input.source === 'chunk' && (input.intent === 'memory' || input.intent === 'action')) {
        return clamp01(input.score * 1.05);
    }

    if (input.source === 'entry' && input.intent !== 'general') {
        return clamp01(input.score * 0.97);
    }

    return clamp01(input.score);
};

const choosePreferredDenseMatch = (current: DenseMatch | undefined, next: DenseMatch) => {
    if (!current) return next;

    if (next.semanticScore !== current.semanticScore) {
        return next.semanticScore > current.semanticScore ? next : current;
    }

    if (next.distance !== current.distance) {
        return next.distance < current.distance ? next : current;
    }
    return current;
};

export class SemanticSearchService {
    isDenseSearchEnabled() {
        if (!embeddingService.isEnabled()) return false;
        // Hash-based embeddings have zero semantic meaning — cosine similarity
        // against them produces random noise.  Disable dense search entirely
        // when the active provider is local_hash.
        const config = embeddingService.getActiveConfig();
        return config.provider !== 'local_hash';
    }

    canUseReranker() {
        return SIMILARITY_SERVICE_URL.length > 0;
    }

    getDenseOnlyRerankPoolLimit(limit?: number) {
        return Math.max(limit || 0, SEMANTIC_RERANK_POOL_LIMIT);
    }

    shouldSkipDenseOnlyRerank(matches: Array<Pick<DenseMatch, 'semanticScore' | 'distance'>>) {
        if (matches.length <= 1) {
            return true;
        }

        const [topMatch, secondMatch] = matches;
        const semanticGap = topMatch.semanticScore - secondMatch.semanticScore;
        const distanceGap = secondMatch.distance - topMatch.distance;

        return topMatch.semanticScore >= SEMANTIC_RERANK_SKIP_CONFIDENCE
            && semanticGap >= SEMANTIC_RERANK_SKIP_GAP
            && distanceGap >= SEMANTIC_RERANK_SKIP_GAP / 2;
    }

    async findDenseMatches(input: {
        userId: string;
        query: string;
        limit?: number;
        excludeEntryId?: string | null;
        minScore?: number;
        intent?: SearchIntent;
    }): Promise<DenseMatch[]> {
        if (!this.isDenseSearchEnabled()) {
            return [];
        }

        const normalizedQuery = input.query.trim();
        if (normalizedQuery.length < 2) {
            return [];
        }

        const intentPlan = buildSearchIntentPlan({
            query: normalizedQuery,
            intentHint: input.intent,
        });
        const queryEmbedding = await embeddingService.embedText({
            content: intentPlan.embeddingQuery,
            purpose: 'query',
        });
        if (!queryEmbedding || queryEmbedding.length === 0) {
            return [];
        }

        const activeConfig = embeddingService.getActiveConfig();
        const vectorDimensions = toVectorDimension(activeConfig.dimensions);
        const vectorLiteral = toVectorLiteral(queryEmbedding);
        const limit = Math.max(1, Math.min(input.limit || DENSE_LIMIT, 60));
        const minScore = input.minScore ?? DENSE_MIN_SCORE;
        const candidateLimit = Math.max(limit * 4, 24);
        const combinedMatches = new Map<string, DenseMatch>();

        const [facetRows, chunkRows] = await Promise.all([
            intentPlan.intent === 'general'
                ? Promise.resolve([] as DenseMatchRow[])
                : prisma.$queryRawUnsafe<DenseMatchRow[]>(
                    `
                    WITH top_facets AS (
                        SELECT
                            facet."entryId" AS "entryId",
                            facet."facetText" AS "contentSnippet",
                            NULL::integer AS "chunkIndex",
                            GREATEST(0, 1 - ((facet.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions}))))::REAL AS "semanticScore",
                            ((facet.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions})))::REAL AS distance,
                            facet."facetType" AS "facetType"
                        FROM "EntryEmbeddingFacet" facet
                        JOIN "Entry" e ON e.id = facet."entryId"
                        WHERE facet."userId" = $2
                            AND e."userId" = $2
                            AND e."deletedAt" IS NULL
                            AND facet.model = $3
                            AND facet.dimensions = $4
                            AND ($5::text IS NULL OR facet."entryId" <> $5)
                        ORDER BY (facet.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions})) ASC, facet."updatedAt" DESC
                        LIMIT $6
                    ),
                    ranked_facets AS (
                        SELECT
                            "entryId",
                            "contentSnippet",
                            "chunkIndex",
                            "semanticScore",
                            distance,
                            "facetType",
                            ROW_NUMBER() OVER (PARTITION BY "entryId" ORDER BY distance ASC) AS entry_rank
                        FROM top_facets
                    )
                    SELECT
                        "entryId",
                        "contentSnippet",
                        "chunkIndex",
                        "semanticScore",
                        distance,
                        'facet'::text AS source,
                        "facetType"
                    FROM ranked_facets
                    WHERE entry_rank = 1
                    ORDER BY distance ASC
                    LIMIT $7
                    `,
                    vectorLiteral,
                    input.userId,
                    activeConfig.model,
                    activeConfig.dimensions,
                    input.excludeEntryId || null,
                    candidateLimit,
                    limit
                ),
            prisma.$queryRawUnsafe<DenseMatchRow[]>(
                `
                WITH top_chunks AS (
                    SELECT
                        chunk."entryId" AS "entryId",
                        chunk."chunkText" AS "contentSnippet",
                        chunk."chunkIndex" AS "chunkIndex",
                        GREATEST(0, 1 - ((chunk.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions}))))::REAL AS "semanticScore",
                        ((chunk.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions})))::REAL AS distance,
                        NULL::text AS "facetType"
                    FROM "EntryEmbeddingChunk" chunk
                    JOIN "Entry" e ON e.id = chunk."entryId"
                    WHERE chunk."userId" = $2
                        AND e."userId" = $2
                        AND e."deletedAt" IS NULL
                        AND chunk.model = $3
                        AND chunk.dimensions = $4
                        AND ($5::text IS NULL OR chunk."entryId" <> $5)
                    ORDER BY (chunk.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions})) ASC, chunk."chunkIndex" ASC
                    LIMIT $6
                ),
                ranked_chunks AS (
                    SELECT
                        "entryId",
                        "contentSnippet",
                        "chunkIndex",
                        "semanticScore",
                        distance,
                        "facetType",
                        ROW_NUMBER() OVER (PARTITION BY "entryId" ORDER BY distance ASC, "chunkIndex" ASC) AS entry_rank
                    FROM top_chunks
                )
                SELECT
                    "entryId",
                    "contentSnippet",
                    "chunkIndex",
                    "semanticScore",
                    distance,
                    'chunk'::text AS source,
                    "facetType"
                FROM ranked_chunks
                WHERE entry_rank = 1
                ORDER BY distance ASC
                LIMIT $7
                `,
                vectorLiteral,
                input.userId,
                activeConfig.model,
                activeConfig.dimensions,
                input.excludeEntryId || null,
                candidateLimit,
                limit
            ),
        ]);

        [...facetRows, ...chunkRows].forEach((row) => {
            const source = row.source === 'facet' ? 'facet' : 'chunk';
            const semanticScore = boostDenseMatchScore({
                score: normalizeScore(row.semanticScore),
                source,
                facetType: row.facetType,
                preferredFacetTypes: intentPlan.preferredFacetTypes,
                intent: intentPlan.intent,
            });
            if (semanticScore < minScore) {
                return;
            }

            const candidate: DenseMatch = {
                entryId: row.entryId,
                contentSnippet: clipSnippet(row.contentSnippet, 420) || null,
                chunkIndex: row.chunkIndex,
                semanticScore,
                distance: normalizeScore(row.distance),
                source,
                facetType: row.facetType,
            };

            combinedMatches.set(
                candidate.entryId,
                choosePreferredDenseMatch(combinedMatches.get(candidate.entryId), candidate)
            );
        });

        if (combinedMatches.size >= limit) {
            return [...combinedMatches.values()]
                .sort((left, right) => right.semanticScore - left.semanticScore || left.distance - right.distance)
                .slice(0, limit);
        }

        const entryRows = await prisma.$queryRawUnsafe<DenseMatchRow[]>(
            `
            SELECT
                emb."entryId" AS "entryId",
                NULL::text AS "contentSnippet",
                NULL::integer AS "chunkIndex",
                GREATEST(0, 1 - ((emb.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions}))))::REAL AS "semanticScore",
                ((emb.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions})))::REAL AS distance,
                'entry'::text AS source,
                NULL::text AS "facetType"
            FROM "EntryEmbedding" emb
            JOIN "Entry" e ON e.id = emb."entryId"
            WHERE emb."userId" = $2
                AND e."userId" = $2
                AND e."deletedAt" IS NULL
                AND emb.model = $3
                AND emb.dimensions = $4
                AND ($5::text IS NULL OR emb."entryId" <> $5)
            ORDER BY (emb.embedding::vector(${vectorDimensions})) <=> ($1::vector(${vectorDimensions})) ASC, e."createdAt" DESC
            LIMIT $6
            `,
            vectorLiteral,
            input.userId,
            activeConfig.model,
            activeConfig.dimensions,
            input.excludeEntryId || null,
            candidateLimit
        );

        entryRows
            .map((row) => ({
                entryId: row.entryId,
                contentSnippet: null,
                chunkIndex: null,
                semanticScore: boostDenseMatchScore({
                    score: normalizeScore(row.semanticScore),
                    source: 'entry',
                    facetType: null,
                    preferredFacetTypes: intentPlan.preferredFacetTypes,
                    intent: intentPlan.intent,
                }),
                distance: normalizeScore(row.distance),
                source: 'entry' as const,
                facetType: null,
            }))
            .filter((row) => row.semanticScore >= minScore)
            .forEach((row) => {
                combinedMatches.set(
                    row.entryId,
                    choosePreferredDenseMatch(combinedMatches.get(row.entryId), row)
                );
            });

        const results = [...combinedMatches.values()]
            .sort((left, right) => right.semanticScore - left.semanticScore || left.distance - right.distance)
            .slice(0, limit);

        if (results.length === 0) {
            // No matches found — common after an embedding model switch.
            // If users have entries but searches return nothing, run the
            // backfill-embeddings script to re-embed with the current model.
            console.warn(
                `[SemanticSearch] 0 dense matches for userId=${input.userId} model=${activeConfig.model} dims=${activeConfig.dimensions}. ` +
                `If entries exist, run backfill-embeddings to refresh embeddings for the current model.`
            );
        }

        return results;
    }

    async rerankCandidates(
        query: string,
        candidates: RerankCandidate[],
        limit = RERANK_LIMIT
    ): Promise<RerankResult[]> {
        if (!this.canUseReranker()) {
            return [];
        }

        const normalizedQuery = query.trim();
        if (!normalizedQuery || candidates.length === 0) {
            return [];
        }

        try {
            const response = await fetch(`${SIMILARITY_SERVICE_URL}/rerank`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: normalizedQuery,
                    top_k: Math.max(1, Math.min(limit, candidates.length)),
                    candidates: candidates.map((candidate) => ({
                        id: candidate.id,
                        title: candidate.title,
                        content: candidate.content,
                    })),
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new Error(`Reranker error: ${response.status} ${errorBody}`);
            }

            const data = await response.json().catch(() => null);
            if (!data || !Array.isArray(data.results)) {
                return [];
            }

            return data.results
                .filter((item: any) => typeof item?.id === 'string')
                .map((item: any) => ({
                    id: item.id,
                    score: normalizeScore(item.score),
                }));
        } catch (error) {
            console.error('Semantic reranker request failed:', error);
            return [];
        }
    }

    fuseRankedIds(input: {
        lexicalIds: string[];
        denseIds: string[];
        rerankScores?: Map<string, number>;
    }) {
        const fused = new Map<string, {
            lexicalRank?: number;
            denseRank?: number;
            rerankScore?: number;
            fusedScore: number;
        }>();

        input.lexicalIds.forEach((id, index) => {
            const existing = fused.get(id) || { fusedScore: 0 };
            existing.lexicalRank = index + 1;
            existing.fusedScore += reciprocalRankFusion(index + 1);
            fused.set(id, existing);
        });

        input.denseIds.forEach((id, index) => {
            const existing = fused.get(id) || { fusedScore: 0 };
            existing.denseRank = index + 1;
            existing.fusedScore += reciprocalRankFusion(index + 1);
            fused.set(id, existing);
        });

        if (input.rerankScores) {
            input.rerankScores.forEach((score, id) => {
                const existing = fused.get(id) || { fusedScore: 0 };
                const normalizedScore = normalizeRerankScore(score);
                existing.rerankScore = normalizedScore;
                existing.fusedScore += normalizedScore;
                fused.set(id, existing);
            });
        }

        return fused;
    }

    buildSearchMatchReasons(input: {
        query: string;
        title: string | null;
        content: string;
        lexicalScore?: number;
        semanticScore?: number;
        rerankScore?: number;
        source?: DenseMatch['source'];
        facetType?: string | null;
    }): string[] {
        const reasons = new Set<string>();
        const terms = extractSearchTerms(input.query);
        const haystack = `${input.title || ''} ${input.content}`.toLowerCase();
        const matchedTerms = terms.filter((term) => haystack.includes(term));

        if (matchedTerms.length > 0) {
            reasons.add(`Matched ${matchedTerms.slice(0, 2).join(', ')}`);
        }
        if ((input.semanticScore || 0) >= 0.28) {
            reasons.add('Strong semantic match');
        } else if ((input.semanticScore || 0) >= DENSE_MIN_SCORE) {
            reasons.add('Semantic match');
        }
        if ((input.rerankScore || 0) >= 0.5) {
            reasons.add('Locally reranked higher');
        }
        if (input.source === 'facet' && input.facetType) {
            reasons.add(`Matched ${getEmbeddingFacetLabel(input.facetType as Parameters<typeof getEmbeddingFacetLabel>[0]).toLowerCase()}`);
        }
        if ((input.lexicalScore || 0) > 0 && reasons.size === 0) {
            reasons.add('Keyword match');
        }

        return Array.from(reasons).slice(0, 3);
    }

    buildRelatedMatchReasons(input: {
        referenceMood: string | null;
        candidateMood: string | null;
        referenceTags: string[];
        candidateTags: string[];
        semanticScore?: number;
        rerankScore?: number;
    }): string[] {
        const reasons = new Set<string>();
        const overlappingTags = input.referenceTags.filter((tag) =>
            input.candidateTags.some((candidateTag) => candidateTag.toLowerCase() === tag.toLowerCase())
        );

        if (overlappingTags.length > 0) {
            reasons.add(`Shared ${overlappingTags.slice(0, 2).join(', ')}`);
        }
        if (input.referenceMood && input.candidateMood && input.referenceMood === input.candidateMood) {
            reasons.add(`Same mood: ${input.referenceMood}`);
        }
        if ((input.semanticScore || 0) >= 0.32) {
            reasons.add('Very similar theme');
        } else if ((input.semanticScore || 0) >= RELATED_MIN_SCORE) {
            reasons.add('Similar note');
        }
        if ((input.rerankScore || 0) >= 0.5) {
            reasons.add('Reranked locally');
        }

        return Array.from(reasons).slice(0, 3);
    }

    async findRelatedEntries(input: {
        userId: string;
        entryId: string;
        title: string | null;
        content: string;
        mood: string | null;
        tags: string[];
        limit?: number;
    }) {
        const denseMatches = await this.findDenseMatches({
            userId: input.userId,
            query: input.title?.trim()
                ? `${input.title}\n\n${input.content}`
                : input.content,
            excludeEntryId: input.entryId,
            limit: Math.max((input.limit || 4) * 4, 12),
            minScore: RELATED_MIN_SCORE,
        });

        if (denseMatches.length === 0) {
            return [];
        }

        const entries = await prisma.entry.findMany({
            where: {
                userId: input.userId,
                deletedAt: null,
                id: {
                    in: denseMatches.map((match) => match.entryId),
                },
            },
            select: {
                id: true,
                title: true,
                content: true,
                mood: true,
                tags: true,
                createdAt: true,
                coverImage: true,
            },
        }) as RelatedEntryRecord[];

        if (entries.length === 0) {
            return [];
        }

        const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
        const rerankPool = denseMatches.slice(0, this.getDenseOnlyRerankPoolLimit(input.limit || 4));
        const rerankCandidates = rerankPool
            .map((match) => {
                const entry = entryMap.get(match.entryId);
                if (!entry) return null;

                return {
                    id: entry.id,
                    title: entry.title,
                    content: match.contentSnippet || buildRerankDocument(entry),
                };
            })
            .filter((entry): entry is RerankCandidate => Boolean(entry));

        const rerankResults = this.shouldSkipDenseOnlyRerank(rerankPool)
            ? []
            : await this.rerankCandidates(
                input.title?.trim() ? `${input.title}\n\n${input.content}` : input.content,
                rerankCandidates,
                Math.max(1, Math.min(rerankCandidates.length, input.limit || 4, 4))
            );
        const rerankMap = new Map(rerankResults.map((result) => [result.id, result.score]));

        return denseMatches
            .map((match) => {
                const entry = entryMap.get(match.entryId);
                if (!entry) return null;

                return {
                    id: entry.id,
                    title: entry.title,
                    contentPreview: clipSnippet(match.contentSnippet || entry.content, 220),
                    mood: entry.mood,
                    tags: entry.tags,
                    coverImage: entry.coverImage,
                    createdAt: entry.createdAt,
                    semanticScore: match.semanticScore,
                    rerankScore: rerankMap.has(entry.id)
                        ? normalizeRerankScore(rerankMap.get(entry.id))
                        : null,
                    relevance: buildRelatedDisplayRelevance(
                        match.semanticScore,
                        rerankMap.get(entry.id)
                    ),
                    matchReasons: this.buildRelatedMatchReasons({
                        referenceMood: input.mood,
                        candidateMood: entry.mood,
                        referenceTags: input.tags,
                        candidateTags: entry.tags,
                        semanticScore: match.semanticScore,
                        rerankScore: normalizeRerankScore(rerankMap.get(entry.id)),
                    }),
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
            .sort((left, right) => right.relevance - left.relevance)
            .slice(0, Math.max(1, Math.min(input.limit || 4, 8)));
    }
}

export default new SemanticSearchService();
