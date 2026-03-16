import prisma from '../config/prisma';
import embeddingService from './embedding.service';
import { extractSearchTerms } from '../utils/search-terms';

type DenseMatchRow = {
    entryId: string;
    semanticScore: number | null;
    distance: number | null;
};

export type DenseMatch = {
    entryId: string;
    semanticScore: number;
    distance: number;
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
const RRF_K = parsePositiveInt(process.env.SEMANTIC_SEARCH_RRF_K, 60);
const SIMILARITY_SERVICE_URL = (process.env.SIMILARITY_SERVICE_URL || '').trim().replace(/\/$/, '');

const toVectorLiteral = (values: number[]) => `[${values.join(',')}]`;

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

export class SemanticSearchService {
    isDenseSearchEnabled() {
        return embeddingService.isEnabled();
    }

    canUseReranker() {
        return SIMILARITY_SERVICE_URL.length > 0;
    }

    async findDenseMatches(input: {
        userId: string;
        query: string;
        limit?: number;
        excludeEntryId?: string | null;
        minScore?: number;
    }): Promise<DenseMatch[]> {
        if (!this.isDenseSearchEnabled()) {
            return [];
        }

        const normalizedQuery = input.query.trim();
        if (normalizedQuery.length < 2) {
            return [];
        }

        const queryEmbedding = await embeddingService.embedText({
            content: normalizedQuery,
            purpose: 'query',
        });
        if (!queryEmbedding || queryEmbedding.length === 0) {
            return [];
        }

        const activeConfig = embeddingService.getActiveConfig();
        const vectorLiteral = toVectorLiteral(queryEmbedding);
        const limit = Math.max(1, Math.min(input.limit || DENSE_LIMIT, 60));
        const minScore = input.minScore ?? DENSE_MIN_SCORE;

        const rows = await prisma.$queryRawUnsafe<DenseMatchRow[]>(
            `
            SELECT
                emb."entryId" AS "entryId",
                GREATEST(0, 1 - (emb.embedding <=> $1::vector))::REAL AS "semanticScore",
                (emb.embedding <=> $1::vector)::REAL AS distance
            FROM "EntryEmbedding" emb
            JOIN "Entry" e ON e.id = emb."entryId"
            WHERE emb."userId" = $2
                AND e."userId" = $2
                AND e."deletedAt" IS NULL
                AND emb.model = $3
                AND emb.dimensions = $4
                AND ($5::text IS NULL OR emb."entryId" <> $5)
            ORDER BY emb.embedding <=> $1::vector ASC, e."createdAt" DESC
            LIMIT $6
            `,
            vectorLiteral,
            input.userId,
            activeConfig.model,
            activeConfig.dimensions,
            input.excludeEntryId || null,
            limit
        );

        return rows
            .map((row) => ({
                entryId: row.entryId,
                semanticScore: normalizeScore(row.semanticScore),
                distance: normalizeScore(row.distance),
            }))
            .filter((row) => row.semanticScore >= minScore);
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
        const rerankCandidates = denseMatches
            .map((match) => entryMap.get(match.entryId))
            .filter((entry): entry is RelatedEntryRecord => Boolean(entry))
            .map((entry) => ({
                id: entry.id,
                title: entry.title,
                content: buildRerankDocument(entry),
            }));

        const rerankResults = await this.rerankCandidates(
            input.title?.trim() ? `${input.title}\n\n${input.content}` : input.content,
            rerankCandidates,
            Math.max(input.limit || 4, 4)
        );
        const rerankMap = new Map(rerankResults.map((result) => [result.id, result.score]));
        const fused = this.fuseRankedIds({
            lexicalIds: [],
            denseIds: denseMatches.map((match) => match.entryId),
            rerankScores: rerankMap,
        });

        return denseMatches
            .map((match) => {
                const entry = entryMap.get(match.entryId);
                if (!entry) return null;

                const fusedData = fused.get(match.entryId);
                return {
                    id: entry.id,
                    title: entry.title,
                    contentPreview: entry.content.slice(0, 220),
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
