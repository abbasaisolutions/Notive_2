import prisma from '../config/prisma';
import embeddingService from './embedding.service';
import semanticSearchService from './semantic-search.service';

type RetrievalEntry = {
    id: string;
    title: string | null;
    content: string;
    mood: string | null;
    tags: string[];
    skills: string[];
    lessons: string[];
    createdAt: Date;
    analysisRecord: {
        summary: string | null;
        topics: string[];
        keywords: string[];
        suggestedMood: string | null;
    } | null;
};

type DuplicateKind = 'near_duplicate' | 'written_before';

export type DuplicateCandidate = {
    id: string;
    title: string | null;
    contentPreview: string;
    mood: string | null;
    tags: string[];
    createdAt: Date;
    semanticScore: number;
    rerankScore: number | null;
    relevance: number;
    lexicalOverlap: number;
    duplicateKind: DuplicateKind;
    matchReasons: string[];
};

export type ResurfacedMoment = {
    sourceEntry: {
        id: string;
        title: string | null;
        createdAt: Date;
    };
    matchedEntry: {
        id: string;
        title: string | null;
        contentPreview: string;
        mood: string | null;
        createdAt: Date;
    };
    relevance: number;
    matchReasons: string[];
};

export type ThemeCluster = {
    id: string;
    label: string;
    summary: string;
    entryCount: number;
    dominantMood: string | null;
    topThemes: string[];
    averageSimilarity: number;
    dateRange: {
        start: Date;
        end: Date;
    };
    representativeEntries: Array<{
        id: string;
        title: string | null;
        contentPreview: string;
        createdAt: Date;
        mood: string | null;
    }>;
};

export type OnThisDayEntry = {
    id: string;
    title: string | null;
    snippet: string;
    mood: string | null;
    createdAt: string;
    reason: 'on_this_day';
    timeLabel: string;
};

type EmbeddingRow = {
    entryId: string;
    embeddingText: string;
};

function formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays < 60) return `${diffDays} days ago`;
    const diffMonths = Math.round(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
    const diffYears = Math.round(diffDays / 365);
    return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseScore = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseFloat(String(value || ''));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(1, parsed));
};

const DUPLICATE_SEMANTIC_THRESHOLD = parseScore(process.env.DUPLICATE_ENTRY_MIN_SCORE, 0.62);
const NEAR_DUPLICATE_THRESHOLD = parseScore(process.env.NEAR_DUPLICATE_MIN_SCORE, 0.8);
const RESURFACE_MIN_SCORE = parseScore(process.env.RESURFACE_MIN_SCORE, 0.34);
const CLUSTER_SIMILARITY_THRESHOLD = parseScore(process.env.THEME_CLUSTER_MIN_SCORE, 0.42);
const CLUSTER_MAX_ENTRIES = parsePositiveInt(process.env.THEME_CLUSTER_MAX_ENTRIES, 48);
const RESURFACE_SOURCE_WINDOW = parsePositiveInt(process.env.RESURFACE_SOURCE_WINDOW, 6);

const STOPWORDS = new Set([
    'the', 'and', 'with', 'that', 'this', 'from', 'have', 'your', 'about', 'been', 'into', 'just', 'like', 'what',
    'when', 'they', 'them', 'then', 'than', 'were', 'after', 'before', 'because', 'there', 'their', 'would', 'could',
    'should', 'today', 'really', 'very', 'much', 'still', 'only', 'also', 'over', 'under', 'into', 'onto', 'while',
]);

const clip = (value: string, maxLength: number): string => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(0.99, value));

const tokenize = (value: string): string[] =>
    (value.toLowerCase().match(/[a-z0-9']+/g) || [])
        .filter((token) => token.length >= 3 && !STOPWORDS.has(token));

const unique = (values: string[], limit = values.length): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    values.forEach((value) => {
        const normalized = value.trim();
        if (!normalized) return;
        const key = normalized.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        result.push(normalized);
    });

    return result.slice(0, limit);
};

const lexicalOverlap = (left: string, right: string): number => {
    const leftTokens = new Set(tokenize(left));
    const rightTokens = new Set(tokenize(right));
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

    let shared = 0;
    leftTokens.forEach((token) => {
        if (rightTokens.has(token)) shared += 1;
    });

    return Number((shared / Math.max(1, Math.min(leftTokens.size, rightTokens.size))).toFixed(3));
};

const parseEmbedding = (value: string): number[] =>
    value
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry));

const dot = (left: number[], right: number[]): number => {
    const width = Math.min(left.length, right.length);
    let total = 0;
    for (let index = 0; index < width; index += 1) {
        total += left[index] * right[index];
    }
    return total;
};

const formatDate = (value: Date): string =>
    value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const getThemeTokens = (entry: RetrievalEntry): string[] =>
    unique([
        ...entry.tags,
        ...entry.skills,
        ...(entry.analysisRecord?.topics || []),
        ...(entry.analysisRecord?.keywords || []),
        ...entry.lessons,
    ].map((value) => value.replace(/[_-]/g, ' ').trim()), 6);

const getDominantMood = (entries: RetrievalEntry[]): string | null => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
        if (!entry.mood) return;
        counts.set(entry.mood, (counts.get(entry.mood) || 0) + 1);
    });

    let best: string | null = null;
    let bestCount = 0;
    counts.forEach((count, mood) => {
        if (count > bestCount) {
            best = mood;
            bestCount = count;
        }
    });
    return best;
};

const getTopThemes = (entries: RetrievalEntry[]): string[] => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
        getThemeTokens(entry).forEach((theme) => {
            counts.set(theme, (counts.get(theme) || 0) + 1);
        });
    });

    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 4)
        .map(([theme]) => theme);
};

class RetrievalInsightsService {
    private async getEntriesByIds(userId: string, ids: string[]): Promise<Map<string, RetrievalEntry>> {
        if (ids.length === 0) return new Map();
        const entries = await prisma.entry.findMany({
            where: {
                userId,
                deletedAt: null,
                id: { in: ids },
            },
            select: {
                id: true,
                title: true,
                content: true,
                mood: true,
                tags: true,
                skills: true,
                lessons: true,
                createdAt: true,
                analysisRecord: {
                    select: {
                        summary: true,
                        topics: true,
                        keywords: true,
                        suggestedMood: true,
                    },
                },
            },
        });

        return new Map(entries.map((entry) => [entry.id, entry]));
    }

    private buildCandidateReasons(input: {
        query: string;
        entry: RetrievalEntry;
        semanticScore: number;
        rerankScore: number;
        lexicalScore: number;
    }): string[] {
        const reasons = semanticSearchService.buildSearchMatchReasons({
            query: input.query,
            title: input.entry.title,
            content: input.entry.content,
            lexicalScore: input.lexicalScore,
            semanticScore: input.semanticScore,
            rerankScore: input.rerankScore,
        });

        if (input.lexicalScore >= 0.55) {
            reasons.unshift('Very similar wording');
        } else if (input.lexicalScore >= 0.3) {
            reasons.push('Shared wording');
        }

        return unique(reasons, 3);
    }

    async findDuplicateCandidates(input: {
        userId: string;
        content: string;
        title?: string | null;
        excludeEntryId?: string | null;
        limit?: number;
    }): Promise<DuplicateCandidate[]> {
        const normalizedContent = input.content.trim();
        if (normalizedContent.length < 60) {
            return [];
        }

        const query = input.title?.trim()
            ? `${input.title.trim()}\n\n${normalizedContent}`
            : normalizedContent;

        const denseMatches = await semanticSearchService.findDenseMatches({
            userId: input.userId,
            query,
            excludeEntryId: input.excludeEntryId || null,
            limit: Math.max((input.limit || 4) * 3, 10),
            minScore: DUPLICATE_SEMANTIC_THRESHOLD,
        });

        if (denseMatches.length === 0) {
            return [];
        }

        const entryMap = await this.getEntriesByIds(input.userId, denseMatches.map((match) => match.entryId));
        const rerankPool = denseMatches.slice(
            0,
            semanticSearchService.getDenseOnlyRerankPoolLimit(input.limit || 4)
        );
        const rerankResults = semanticSearchService.shouldSkipDenseOnlyRerank(rerankPool)
            ? []
            : await semanticSearchService.rerankCandidates(
                query,
                rerankPool
                    .map((match) => {
                        const entry = entryMap.get(match.entryId);
                        if (!entry) return null;

                        return {
                            id: entry.id,
                            title: entry.title,
                            content: match.contentSnippet || (entry.title ? `${entry.title}\n\n${entry.content}` : entry.content),
                        };
                    })
                    .filter((entry): entry is { id: string; title: string | null; content: string } => Boolean(entry)),
                Math.max(1, Math.min(rerankPool.length, input.limit || 4, 4))
            );
        const rerankMap = new Map(rerankResults.map((result) => [result.id, result.score]));

        return denseMatches
            .map((match) => {
                const entry = entryMap.get(match.entryId);
                if (!entry) return null;

                const overlap = lexicalOverlap(query, `${entry.title || ''} ${entry.content}`);
                const rerankScore = Number(clamp01(rerankMap.get(entry.id) || 0).toFixed(3));
                const relevance = Number(Math.max(match.semanticScore, rerankScore, overlap).toFixed(3));
                const duplicateKind: DuplicateKind =
                    match.semanticScore >= NEAR_DUPLICATE_THRESHOLD || rerankScore >= 0.75 || overlap >= 0.55
                        ? 'near_duplicate'
                        : 'written_before';

                return {
                    id: entry.id,
                    title: entry.title,
                    contentPreview: clip(match.contentSnippet || entry.analysisRecord?.summary || entry.content, 180),
                    mood: entry.mood,
                    tags: entry.tags,
                    createdAt: entry.createdAt,
                    semanticScore: Number(match.semanticScore.toFixed(3)),
                    rerankScore: rerankScore > 0 ? rerankScore : null,
                    relevance,
                    lexicalOverlap: overlap,
                    duplicateKind,
                    matchReasons: this.buildCandidateReasons({
                        query,
                        entry,
                        semanticScore: match.semanticScore,
                        rerankScore,
                        lexicalScore: overlap,
                    }),
                } satisfies DuplicateCandidate;
            })
            .filter((candidate): candidate is DuplicateCandidate => Boolean(candidate))
            .sort((left, right) => right.relevance - left.relevance)
            .slice(0, Math.max(1, Math.min(input.limit || 4, 6)));
    }

    async getResurfacedMoments(input: {
        userId: string;
        limit?: number;
    }): Promise<ResurfacedMoment[]> {
        const sourceEntries = await prisma.entry.findMany({
            where: {
                userId: input.userId,
                deletedAt: null,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: RESURFACE_SOURCE_WINDOW,
            select: {
                id: true,
                title: true,
                content: true,
                mood: true,
                tags: true,
                skills: true,
                lessons: true,
                createdAt: true,
                analysisRecord: {
                    select: {
                        summary: true,
                        topics: true,
                        keywords: true,
                        suggestedMood: true,
                    },
                },
            },
        });

        const results: ResurfacedMoment[] = [];
        const usedMatchIds = new Set<string>();

        for (const sourceEntry of sourceEntries) {
            if (results.length >= (input.limit || 3)) break;

            const relatedEntries = await semanticSearchService.findRelatedEntries({
                userId: input.userId,
                entryId: sourceEntry.id,
                title: sourceEntry.title,
                content: sourceEntry.content,
                mood: sourceEntry.mood,
                tags: sourceEntry.tags,
                limit: 4,
            });

            const olderMatch = relatedEntries.find((candidate) =>
                new Date(candidate.createdAt).getTime() < sourceEntry.createdAt.getTime() &&
                candidate.semanticScore >= RESURFACE_MIN_SCORE &&
                !usedMatchIds.has(candidate.id)
            );

            if (!olderMatch) continue;
            usedMatchIds.add(olderMatch.id);

            results.push({
                sourceEntry: {
                    id: sourceEntry.id,
                    title: sourceEntry.title,
                    createdAt: sourceEntry.createdAt,
                },
                matchedEntry: {
                    id: olderMatch.id,
                    title: olderMatch.title,
                    contentPreview: olderMatch.contentPreview,
                    mood: olderMatch.mood,
                    createdAt: olderMatch.createdAt,
                },
                relevance: olderMatch.relevance,
                matchReasons: olderMatch.matchReasons,
            });
        }

        return results.slice(0, Math.max(1, Math.min(input.limit || 3, 6)));
    }

    private async getClusterEntries(userId: string): Promise<RetrievalEntry[]> {
        return prisma.entry.findMany({
            where: {
                userId,
                deletedAt: null,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: CLUSTER_MAX_ENTRIES,
            select: {
                id: true,
                title: true,
                content: true,
                mood: true,
                tags: true,
                skills: true,
                lessons: true,
                createdAt: true,
                analysisRecord: {
                    select: {
                        summary: true,
                        topics: true,
                        keywords: true,
                        suggestedMood: true,
                    },
                },
            },
        });
    }

    private async getEmbeddingMap(userId: string, entryIds: string[]): Promise<Map<string, number[]>> {
        if (!embeddingService.isEnabled() || entryIds.length === 0) {
            return new Map();
        }

        const activeConfig = embeddingService.getActiveConfig();
        const placeholders = entryIds.map((_, index) => `$${index + 4}`).join(', ');
        const query = `
            SELECT "entryId", embedding::text AS "embeddingText"
            FROM "EntryEmbedding"
            WHERE "userId" = $1
              AND model = $2
              AND dimensions = $3
              AND "entryId" IN (${placeholders})
        `;
        const rows = await prisma.$queryRawUnsafe<EmbeddingRow[]>(
            query,
            userId,
            activeConfig.model,
            activeConfig.dimensions,
            ...entryIds
        );

        return new Map(rows.map((row) => [row.entryId, parseEmbedding(row.embeddingText)]));
    }

    private buildThemeClustersFromEntries(entries: RetrievalEntry[], embeddingMap: Map<string, number[]>): ThemeCluster[] {
        if (entries.length < 2) return [];

        const parent = new Map<string, string>(entries.map((entry) => [entry.id, entry.id]));

        const find = (id: string): string => {
            const current = parent.get(id);
            if (!current || current === id) return id;
            const root = find(current);
            parent.set(id, root);
            return root;
        };

        const union = (left: string, right: string) => {
            const leftRoot = find(left);
            const rightRoot = find(right);
            if (leftRoot !== rightRoot) {
                parent.set(rightRoot, leftRoot);
            }
        };

        for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
                const left = entries[leftIndex];
                const right = entries[rightIndex];
                const leftVector = embeddingMap.get(left.id);
                const rightVector = embeddingMap.get(right.id);
                const sharedThemes = getThemeTokens(left).filter((theme) =>
                    getThemeTokens(right).some((candidate) => candidate.toLowerCase() === theme.toLowerCase())
                );
                const semanticScore = leftVector && rightVector
                    ? dot(leftVector, rightVector)
                    : 0;
                const lexicalScore = lexicalOverlap(
                    `${left.title || ''} ${left.content}`,
                    `${right.title || ''} ${right.content}`
                );
                const threshold = sharedThemes.length > 0
                    ? Math.max(0.3, CLUSTER_SIMILARITY_THRESHOLD - 0.04)
                    : CLUSTER_SIMILARITY_THRESHOLD;
                const fusedScore = Math.max(semanticScore, lexicalScore * 0.8);

                if (fusedScore >= threshold || (sharedThemes.length >= 2 && lexicalScore >= 0.2)) {
                    union(left.id, right.id);
                }
            }
        }

        const clustersByRoot = new Map<string, RetrievalEntry[]>();
        entries.forEach((entry) => {
            const root = find(entry.id);
            const existing = clustersByRoot.get(root) || [];
            existing.push(entry);
            clustersByRoot.set(root, existing);
        });

        return [...clustersByRoot.values()]
            .filter((cluster) => cluster.length >= 2)
            .map((cluster, index) => {
                const sorted = [...cluster].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
                const topThemes = getTopThemes(cluster);
                const dominantMood = getDominantMood(cluster);
                const start = cluster.reduce((min, entry) => entry.createdAt < min ? entry.createdAt : min, cluster[0].createdAt);
                const end = cluster.reduce((max, entry) => entry.createdAt > max ? entry.createdAt : max, cluster[0].createdAt);

                let similarityTotal = 0;
                let similarityPairs = 0;
                for (let leftIndex = 0; leftIndex < cluster.length; leftIndex += 1) {
                    for (let rightIndex = leftIndex + 1; rightIndex < cluster.length; rightIndex += 1) {
                        const leftVector = embeddingMap.get(cluster[leftIndex].id);
                        const rightVector = embeddingMap.get(cluster[rightIndex].id);
                        if (!leftVector || !rightVector) continue;
                        similarityTotal += dot(leftVector, rightVector);
                        similarityPairs += 1;
                    }
                }

                const label = topThemes[0]
                    ? topThemes[0]
                    : dominantMood
                        ? `${dominantMood} notes`
                        : 'Recurring theme';

                return {
                    id: `theme-cluster-${index + 1}-${sorted[0].id}`,
                    label,
                    summary: topThemes[0]
                        ? `${cluster.length} notes circling around ${topThemes[0].toLowerCase()} from ${formatDate(start)} to ${formatDate(end)}.`
                        : `${cluster.length} related notes from ${formatDate(start)} to ${formatDate(end)}.`,
                    entryCount: cluster.length,
                    dominantMood,
                    topThemes,
                    averageSimilarity: Number(((similarityPairs > 0 ? similarityTotal / similarityPairs : 0.28)).toFixed(3)),
                    dateRange: {
                        start,
                        end,
                    },
                    representativeEntries: sorted.slice(0, 3).map((entry) => ({
                        id: entry.id,
                        title: entry.title,
                        contentPreview: clip(entry.analysisRecord?.summary || entry.content, 160),
                        createdAt: entry.createdAt,
                        mood: entry.mood,
                    })),
                } satisfies ThemeCluster;
            })
            .sort((left, right) => right.entryCount - left.entryCount || right.averageSimilarity - left.averageSimilarity);
    }

    async getThemeClusters(input: {
        userId: string;
        limit?: number;
    }): Promise<ThemeCluster[]> {
        const entries = await this.getClusterEntries(input.userId);
        if (entries.length < 2) return [];

        const embeddingMap = await this.getEmbeddingMap(input.userId, entries.map((entry) => entry.id));
        const clusters = this.buildThemeClustersFromEntries(entries, embeddingMap);

        return clusters.slice(0, Math.max(1, Math.min(input.limit || 4, 8)));
    }

    /**
     * Find entries written on this day in previous years/months (25+ days ago).
     * Calendar-based resurfacing — complements similarity-based ResurfacedMoment.
     */
    async getOnThisDayEntries(userId: string, timezone: string): Promise<OnThisDayEntry[]> {
        const now = new Date();
        let todayLocal: string;
        try {
            todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);
        } catch {
            todayLocal = now.toISOString().slice(0, 10);
        }
        const [, monthStr, dayStr] = todayLocal.split('-');
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);

        const entries: Array<{
            id: string;
            title: string | null;
            content: string;
            mood: string | null;
            createdAt: Date;
        }> = await prisma.$queryRawUnsafe(
            `SELECT id, title, content, mood, "createdAt"
             FROM "Entry"
             WHERE "userId" = $1
               AND "deletedAt" IS NULL
               AND EXTRACT(MONTH FROM "createdAt") = $2
               AND EXTRACT(DAY FROM "createdAt") = $3
               AND "createdAt" < NOW() - INTERVAL '25 days'
             ORDER BY "createdAt" DESC
             LIMIT 3`,
            userId,
            month,
            day,
        );

        return entries.map((e) => ({
            id: e.id,
            title: e.title,
            snippet: e.content.replace(/<[^>]*>/g, '').substring(0, 120).trim(),
            mood: e.mood,
            createdAt: e.createdAt.toISOString(),
            reason: 'on_this_day' as const,
            timeLabel: formatRelativeDate(e.createdAt),
        }));
    }
}

export default new RetrievalInsightsService();
