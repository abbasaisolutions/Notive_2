import { Prisma } from '@prisma/client';

const VALID_ENTRY_SOURCES = new Set(['NOTIVE', 'INSTAGRAM', 'FACEBOOK']);

export const normalizeEntrySource = (value: unknown): 'NOTIVE' | 'INSTAGRAM' | 'FACEBOOK' | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase();
    if (!VALID_ENTRY_SOURCES.has(normalized)) return null;
    return normalized as 'NOTIVE' | 'INSTAGRAM' | 'FACEBOOK';
};

export const normalizeLifeArea = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return null;
    return normalized.slice(0, 64);
};

export const normalizeEntrySearch = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value.trim();
};

export const buildEntryListWhere = (input: {
    userId: string;
    search?: string;
    source?: 'NOTIVE' | 'INSTAGRAM' | 'FACEBOOK' | null;
    lifeArea?: string | null;
}): Prisma.EntryWhereInput => {
    const { userId, search = '', source = null, lifeArea = null } = input;
    const normalizedSearch = normalizeEntrySearch(search);

    const where: Prisma.EntryWhereInput = {
        userId,
        deletedAt: null,
    };

    if (source) {
        where.source = source;
    }

    if (lifeArea) {
        where.lifeArea = {
            equals: lifeArea,
            mode: 'insensitive',
        };
    }

    if (normalizedSearch) {
        const normalizedTagSearch = normalizedSearch.toLowerCase();
        where.OR = [
            { title: { contains: normalizedSearch, mode: 'insensitive' } },
            { content: { contains: normalizedSearch, mode: 'insensitive' } },
            { tags: { has: normalizedTagSearch } },
        ];
    }

    return where;
};
