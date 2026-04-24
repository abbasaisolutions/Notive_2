export type ProfileHighlightEntry = {
    id: string;
    title: string | null;
    content: string;
    reflection?: string | null;
    createdAt: string;
    coverImage?: string | null;
};

export type ProfileFavoriteLine = {
    text: string;
    entryId: string;
    entryTitle: string | null;
};

export type ProfileHighlights = {
    coverImage: string | null;
    favoriteLine: ProfileFavoriteLine | null;
    monthsReflected: number;
};

const normalizeText = (value: string | null | undefined) =>
    String(value || '')
        .replace(/\s+/g, ' ')
        .trim();

const sentenceCandidates = (value: string | null | undefined) => {
    const normalized = normalizeText(value);
    if (!normalized) return [];

    return normalized
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
};

const isFavoriteLineCandidate = (value: string) => {
    if (value.length < 40 || value.length > 180) return false;
    if (value.split(/\s+/).length < 6) return false;
    if (/https?:\/\//i.test(value)) return false;
    if (!/[a-z]/i.test(value)) return false;
    return true;
};

const scoreFavoriteLine = (value: string, entryIndex: number, fromReflection: boolean) => {
    const idealLengthDistance = Math.abs(96 - value.length);
    const reflectionBonus = fromReflection ? 45 : 0;
    const recencyBonus = Math.max(0, 18 - entryIndex);
    return reflectionBonus + recencyBonus - idealLengthDistance;
};

export function countReflectedMonths(entries: ProfileHighlightEntry[]): number {
    return new Set(
        entries
            .map((entry) => {
                const createdAt = new Date(entry.createdAt);
                if (Number.isNaN(createdAt.getTime())) return null;
                return `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}`;
            })
            .filter((value): value is string => Boolean(value))
    ).size;
}

export function pickFavoriteLine(entries: ProfileHighlightEntry[]): ProfileFavoriteLine | null {
    let best: { score: number; line: ProfileFavoriteLine } | null = null;

    for (const [entryIndex, entry] of entries.entries()) {
        const candidateGroups = [
            { source: sentenceCandidates(entry.reflection), fromReflection: true },
            { source: sentenceCandidates(entry.content), fromReflection: false },
        ];

        for (const { source, fromReflection } of candidateGroups) {
            for (const candidate of source) {
                if (!isFavoriteLineCandidate(candidate)) continue;

                const score = scoreFavoriteLine(candidate, entryIndex, fromReflection);
                if (!best || score > best.score) {
                    best = {
                        score,
                        line: {
                            text: candidate,
                            entryId: entry.id,
                            entryTitle: entry.title,
                        },
                    };
                }
            }
        }
    }

    return best ? best.line : null;
}

export function buildProfileHighlights(entries: ProfileHighlightEntry[]): ProfileHighlights {
    const sortedEntries = [...entries].sort((left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );

    return {
        coverImage: sortedEntries.find((entry) => Boolean(entry.coverImage))?.coverImage ?? null,
        favoriteLine: pickFavoriteLine(sortedEntries),
        monthsReflected: countReflectedMonths(sortedEntries),
    };
}
