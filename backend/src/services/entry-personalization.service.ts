import prisma from '../config/prisma';
import semanticSearchService from './semantic-search.service';

export type PersonalizedValueSuggestion<T = string> = {
    value: T;
    confidence: number;
    support: number;
};

export type PersonalizedTagSuggestion = PersonalizedValueSuggestion<string>;

export type PersonalizedChapterSuggestion = {
    id: string;
    name: string;
    color: string;
    confidence: number;
    support: number;
};

export type EntryPersonalizationSuggestions = {
    basedOnEntries: number;
    tags: PersonalizedTagSuggestion[];
    mood: PersonalizedValueSuggestion<string> | null;
    lifeArea: PersonalizedValueSuggestion<string> | null;
    chapter: PersonalizedChapterSuggestion | null;
    topMatches: Array<{
        id: string;
        title: string | null;
        relevance: number;
    }>;
    summary: string | null;
};

type SimilarEntryRecord = {
    id: string;
    title: string | null;
    mood: string | null;
    lifeArea: string | null;
    tags: string[];
    createdAt: Date;
    chapter: {
        id: string;
        name: string;
        color: string;
    } | null;
};

const normalizeTag = (value: string): string =>
    value
        .replace(/^#+/, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\s-]/g, '')
        .slice(0, 32);

const roundConfidence = (value: number) =>
    Number(Math.max(0, Math.min(0.98, value)).toFixed(3));

const buildRecencyWeight = (createdAt: Date) => {
    const ageDays = Math.max(0, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    if (ageDays <= 14) return 1.08;
    if (ageDays <= 45) return 1.04;
    if (ageDays <= 120) return 1;
    if (ageDays <= 365) return 0.96;
    return 0.92;
};

const selectTopValueSuggestion = (
    values: Map<string, { score: number; support: number }>
): PersonalizedValueSuggestion<string> | null => {
    const ranked = [...values.entries()]
        .map(([value, meta]) => ({
            value,
            score: meta.score,
            support: meta.support,
        }))
        .sort((left, right) => right.score - left.score || right.support - left.support);

    if (ranked.length === 0) return null;

    const top = ranked[0];
    const second = ranked[1];
    const totalScore = ranked.reduce((sum, item) => sum + item.score, 0) || top.score;
    const margin = second ? Math.max(0, top.score - second.score) : top.score;
    const confidence = roundConfidence(
        (top.score / totalScore) * 0.7
        + Math.min(0.2, top.support * 0.05)
        + Math.min(0.12, margin * 0.2)
    );

    return {
        value: top.value,
        confidence,
        support: top.support,
    };
};

const buildSummary = (input: {
    tags: PersonalizedTagSuggestion[];
    lifeArea: PersonalizedValueSuggestion<string> | null;
    mood: PersonalizedValueSuggestion<string> | null;
    chapter: PersonalizedChapterSuggestion | null;
}): string | null => {
    const parts: string[] = [];

    if (input.tags.length > 0) {
        parts.push(`Similar notes often center on ${input.tags.slice(0, 2).map((tag) => tag.value).join(', ')}`);
    }
    if (input.lifeArea?.value) {
        parts.push(`they usually land in ${input.lifeArea.value}`);
    }
    if (input.mood?.value) {
        parts.push(`and often carry a ${input.mood.value} tone`);
    }
    if (input.chapter?.name) {
        parts.push(`with a strong pull toward the chapter "${input.chapter.name}"`);
    }

    if (parts.length === 0) return null;

    return `${parts.join(' ')}.`;
};

class EntryPersonalizationService {
    async suggestForDraft(input: {
        userId: string;
        content: string;
        title?: string;
        excludeEntryId?: string | null;
    }): Promise<EntryPersonalizationSuggestions | null> {
        const normalizedContent = input.content.trim();
        const title = input.title?.trim();
        const query = title ? `${title}\n\n${normalizedContent}` : normalizedContent;

        if (query.length < 40 || !semanticSearchService.isDenseSearchEnabled()) {
            return null;
        }

        const denseMatches = await semanticSearchService.findDenseMatches({
            userId: input.userId,
            query,
            excludeEntryId: input.excludeEntryId || null,
            limit: 8,
            minScore: 0.18,
        });

        if (denseMatches.length === 0) {
            return null;
        }

        const matchMap = new Map(denseMatches.map((match) => [match.entryId, match]));
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
                mood: true,
                lifeArea: true,
                tags: true,
                createdAt: true,
                chapter: {
                    select: {
                        id: true,
                        name: true,
                        color: true,
                    },
                },
            },
        }) as SimilarEntryRecord[];

        if (entries.length === 0) {
            return null;
        }

        const moodScores = new Map<string, { score: number; support: number }>();
        const lifeAreaScores = new Map<string, { score: number; support: number }>();
        const tagScores = new Map<string, { score: number; support: number }>();
        const chapterScores = new Map<string, { score: number; support: number; chapter: SimilarEntryRecord['chapter'] }>();

        entries.forEach((entry) => {
            const match = matchMap.get(entry.id);
            const baseScore = Math.max(0.12, match?.semanticScore || 0);
            const weightedScore = baseScore * buildRecencyWeight(entry.createdAt);

            if (entry.mood) {
                const existing = moodScores.get(entry.mood) || { score: 0, support: 0 };
                existing.score += weightedScore;
                existing.support += 1;
                moodScores.set(entry.mood, existing);
            }

            if (entry.lifeArea) {
                const existing = lifeAreaScores.get(entry.lifeArea) || { score: 0, support: 0 };
                existing.score += weightedScore;
                existing.support += 1;
                lifeAreaScores.set(entry.lifeArea, existing);
            }

            entry.tags.forEach((tag) => {
                const normalizedTag = normalizeTag(tag);
                if (!normalizedTag) return;
                const existing = tagScores.get(normalizedTag) || { score: 0, support: 0 };
                existing.score += weightedScore;
                existing.support += 1;
                tagScores.set(normalizedTag, existing);
            });

            if (entry.chapter) {
                const existing = chapterScores.get(entry.chapter.id) || {
                    score: 0,
                    support: 0,
                    chapter: entry.chapter,
                };
                existing.score += weightedScore;
                existing.support += 1;
                chapterScores.set(entry.chapter.id, existing);
            }
        });

        const tags = [...tagScores.entries()]
            .map(([value, meta]) => ({
                value,
                confidence: roundConfidence(
                    Math.min(0.92, (meta.score / Math.max(0.001, entries.length)) * 0.85 + meta.support * 0.04)
                ),
                support: meta.support,
            }))
            .sort((left, right) => right.confidence - left.confidence || right.support - left.support)
            .slice(0, 5);

        const mood = selectTopValueSuggestion(moodScores);
        const lifeArea = selectTopValueSuggestion(lifeAreaScores);
        const topChapter = [...chapterScores.entries()]
            .map(([id, meta]) => ({
                id,
                name: meta.chapter?.name || 'Untitled chapter',
                color: meta.chapter?.color || '#6366f1',
                score: meta.score,
                support: meta.support,
            }))
            .sort((left, right) => right.score - left.score || right.support - left.support)[0] || null;

        const chapter = topChapter
            ? {
                id: topChapter.id,
                name: topChapter.name,
                color: topChapter.color,
                confidence: roundConfidence(
                    Math.min(0.96, topChapter.score / Math.max(0.001, entries.length) + topChapter.support * 0.06)
                ),
                support: topChapter.support,
            }
            : null;

        const topMatches = denseMatches
            .map((match) => {
                const entry = entries.find((candidate) => candidate.id === match.entryId);
                if (!entry) return null;

                return {
                    id: entry.id,
                    title: entry.title,
                    relevance: roundConfidence(match.semanticScore),
                };
            })
            .filter((match): match is NonNullable<typeof match> => Boolean(match))
            .slice(0, 4);

        return {
            basedOnEntries: entries.length,
            tags,
            mood,
            lifeArea,
            chapter,
            topMatches,
            summary: buildSummary({
                tags,
                lifeArea,
                mood,
                chapter,
            }),
        };
    }
}

export default new EntryPersonalizationService();
