import { Prisma } from '@prisma/client';
import { normalizeTag } from '../services/tag-manager.service';
import { MOOD_ALIAS_MAP, MOOD_SCORES, normalizeMood } from './mood';

const VALID_ENTRY_SOURCES = new Set(['NOTIVE', 'INSTAGRAM', 'FACEBOOK']);
const VALID_DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const ENTRY_DAY_PART_ALIAS_MAP: Record<string, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Late night',
    'late night': 'Late night',
    'late-night': 'Late night',
};
const ENTRY_MOOD_ALIAS_MAP: Record<string, string> = MOOD_ALIAS_MAP;
const ENTRY_CANONICAL_MOODS = [...new Set([
    ...Object.keys(MOOD_SCORES),
    ...Object.values(ENTRY_MOOD_ALIAS_MAP),
])];
const buildMoodVariantMap = (): Map<string, string[]> => {
    const grouped = new Map<string, Set<string>>();

    Object.entries(ENTRY_MOOD_ALIAS_MAP).forEach(([alias, canonical]) => {
        const canonicalSet = grouped.get(canonical) || new Set<string>();
        canonicalSet.add(canonical);
        canonicalSet.add(alias);
        grouped.set(canonical, canonicalSet);
    });

    ENTRY_CANONICAL_MOODS.forEach((mood) => {
            const existing = grouped.get(mood) || new Set<string>();
            existing.add(mood);
            grouped.set(mood, existing);
        });

    return new Map([...grouped.entries()].map(([key, values]) => [key, [...values]]));
};
const ENTRY_MOOD_VARIANTS = buildMoodVariantMap();

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
const titleCase = (value: string) =>
    value
        .split(/[\s_-]+/g)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join(' ');

const buildThemeVariants = (value: string): string[] => {
    const normalized = normalizeWhitespace(value.replace(/^#+/, ''));
    const normalizedLower = normalized.toLowerCase();
    const variants = new Set<string>();

    if (normalized) variants.add(normalized);
    if (normalizedLower) variants.add(normalizedLower);
    if (normalizedLower) variants.add(titleCase(normalizedLower));

    return [...variants].filter(Boolean);
};

const buildUtcDayRange = (dateKey: string) => {
    const start = new Date(`${dateKey}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
};
const getEntryDayPart = (hour: number): string => {
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 22) return 'Evening';
    return 'Late night';
};

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

export const normalizeEntryTheme = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = normalizeWhitespace(value.replace(/^#+/, ''));
    return normalized ? normalized.slice(0, 80) : null;
};

export const normalizeEntryMood = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = normalizeMood(value);
    return normalized ? normalized.slice(0, 32) : null;
};

export const normalizeEntryDateKey = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!VALID_DATE_KEY.test(normalized)) return null;
    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
};

export const normalizeEntryDateRange = (input: {
    startDate?: unknown;
    endDate?: unknown;
}): {
    startDate: string | null;
    endDate: string | null;
} => {
    const normalizedStart = normalizeEntryDateKey(input.startDate);
    const normalizedEnd = normalizeEntryDateKey(input.endDate);

    if (!normalizedStart || !normalizedEnd) {
        return {
            startDate: normalizedStart,
            endDate: normalizedEnd,
        };
    }

    return normalizedStart <= normalizedEnd
        ? { startDate: normalizedStart, endDate: normalizedEnd }
        : { startDate: normalizedEnd, endDate: normalizedStart };
};

export const normalizeEntryWeekday = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    return ENTRY_WEEKDAY_NAMES.find((day) => day.toLowerCase() === normalized) || null;
};

export const normalizeEntryDayPart = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized) return null;
    return ENTRY_DAY_PART_ALIAS_MAP[normalized] || null;
};

export const filterEntriesByTemporalContext = <T extends { createdAt: Date | string }>(
    entries: T[],
    input: {
        weekday?: string | null;
        dayPart?: string | null;
    }
): T[] => {
    const weekday = normalizeEntryWeekday(input.weekday);
    const dayPart = normalizeEntryDayPart(input.dayPart);

    if (!weekday && !dayPart) {
        return entries;
    }

    return entries.filter((entry) => {
        const createdAt = entry.createdAt instanceof Date ? entry.createdAt : new Date(entry.createdAt);
        if (Number.isNaN(createdAt.getTime())) {
            return false;
        }

        const matchesWeekday = !weekday || ENTRY_WEEKDAY_NAMES[createdAt.getDay()] === weekday;
        const matchesDayPart = !dayPart || getEntryDayPart(createdAt.getHours()) === dayPart;
        return matchesWeekday && matchesDayPart;
    });
};

export const buildEntryListWhere = (input: {
    userId: string;
    search?: string;
    source?: 'NOTIVE' | 'INSTAGRAM' | 'FACEBOOK' | null;
    lifeArea?: string | null;
    theme?: string | null;
    mood?: string | null;
    date?: string | null;
    startDate?: string | null;
    endDate?: string | null;
}): Prisma.EntryWhereInput => {
    const {
        userId,
        search = '',
        source = null,
        lifeArea = null,
        theme = null,
        mood = null,
        date = null,
        startDate = null,
        endDate = null,
    } = input;
    const normalizedSearch = normalizeEntrySearch(search);
    const normalizedTheme = normalizeEntryTheme(theme);
    const normalizedMood = normalizeEntryMood(mood);
    const normalizedDate = normalizeEntryDateKey(date);
    const normalizedDateRange = normalizeEntryDateRange({ startDate, endDate });

    const where: Prisma.EntryWhereInput = {
        userId,
        deletedAt: null,
    };

    const andFilters: Prisma.EntryWhereInput[] = [];

    if (source) {
        andFilters.push({ source });
    }

    if (lifeArea) {
        andFilters.push({
            lifeArea: {
                equals: lifeArea,
                mode: 'insensitive',
            },
        });
    }

    if (normalizedTheme) {
        const themeVariants = buildThemeVariants(normalizedTheme);
        const normalizedTagTheme = normalizeTag(normalizedTheme);
        andFilters.push({
            OR: [
                ...(normalizedTagTheme ? [{ tags: { has: normalizedTagTheme } }] : []),
                ...themeVariants.map((variant) => ({ skills: { has: variant } })),
                ...themeVariants.map((variant) => ({ lessons: { has: variant } })),
                { title: { contains: normalizedTheme, mode: 'insensitive' } },
                { content: { contains: normalizedTheme, mode: 'insensitive' } },
            ],
        });
    }

    if (normalizedMood) {
        const moodVariants = ENTRY_MOOD_VARIANTS.get(normalizedMood) || [normalizedMood];
        andFilters.push({
            OR: moodVariants.map((variant) => ({
                mood: {
                    equals: variant,
                    mode: 'insensitive',
                },
            })),
        });
    }

    if (normalizedDate) {
        const { start, end } = buildUtcDayRange(normalizedDate);
        andFilters.push({
            createdAt: {
                gte: start,
                lt: end,
            },
        });
    }

    if (normalizedDateRange.startDate) {
        const { start } = buildUtcDayRange(normalizedDateRange.startDate);
        andFilters.push({
            createdAt: {
                gte: start,
            },
        });
    }

    if (normalizedDateRange.endDate) {
        const { end } = buildUtcDayRange(normalizedDateRange.endDate);
        andFilters.push({
            createdAt: {
                lt: end,
            },
        });
    }

    if (normalizedSearch) {
        const normalizedTagSearch = normalizeTag(normalizedSearch);
        andFilters.push({
            OR: [
            { title: { contains: normalizedSearch, mode: 'insensitive' } },
            { content: { contains: normalizedSearch, mode: 'insensitive' } },
            ...(normalizedTagSearch ? [{ tags: { has: normalizedTagSearch } }] : []),
        ],
        });
    }

    if (andFilters.length === 1) {
        return {
            ...where,
            ...andFilters[0],
        };
    }

    if (andFilters.length > 1) {
        where.AND = andFilters;
    }

    return where;
};
