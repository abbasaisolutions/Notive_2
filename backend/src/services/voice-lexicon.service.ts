import prisma from '../config/prisma';

export type VoiceLexiconHint = {
    canonical: string;
    aliases: string[];
    locale: string | null;
    itemType: string | null;
    boost: number;
};

type UpsertVoiceLexiconItemInput = {
    userId: string;
    canonical: string;
    aliases?: string[];
    locale?: string | null;
    itemType?: string | null;
    boost?: number | null;
};

const normalizeShortText = (value: unknown, maxLength: number): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized ? normalized.slice(0, maxLength) : null;
};

const normalizeAliases = (aliases: unknown, canonical: string): string[] => {
    if (!Array.isArray(aliases)) {
        return [];
    }

    return Array.from(
        new Set(
            aliases
                .filter((value): value is string => typeof value === 'string')
                .map((value) => value.replace(/\s+/g, ' ').trim())
                .filter((value) => value.length > 0 && value.toLowerCase() !== canonical.toLowerCase())
                .slice(0, 12)
        )
    );
};

const normalizeBoost = (value: number | null | undefined) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.6;
    return Math.min(Math.max(numeric, 0.1), 1);
};

const normalizeLocale = (value: unknown) => normalizeShortText(value, 32);
const normalizeItemType = (value: unknown) => normalizeShortText(value, 40);
const normalizeCanonical = (value: unknown) => normalizeShortText(value, 120);

const normalizeKey = (value: string) => value.toLowerCase();

class VoiceLexiconService {
    async listForUser(userId: string) {
        return prisma.voiceLexiconItem.findMany({
            where: { userId },
            orderBy: [
                { usageCount: 'desc' },
                { updatedAt: 'desc' },
            ],
        });
    }

    async upsert(input: UpsertVoiceLexiconItemInput) {
        const canonical = normalizeCanonical(input.canonical);
        if (!canonical) {
            throw new Error('Canonical term is required.');
        }

        const normalized = normalizeKey(canonical);
        const aliases = normalizeAliases(input.aliases, canonical);

        return prisma.voiceLexiconItem.upsert({
            where: {
                userId_normalized: {
                    userId: input.userId,
                    normalized,
                },
            },
            create: {
                userId: input.userId,
                canonical,
                normalized,
                aliases,
                locale: normalizeLocale(input.locale),
                itemType: normalizeItemType(input.itemType),
                boost: normalizeBoost(input.boost),
            },
            update: {
                canonical,
                aliases,
                locale: normalizeLocale(input.locale),
                itemType: normalizeItemType(input.itemType),
                boost: normalizeBoost(input.boost),
            },
        });
    }

    async delete(userId: string, id: string) {
        return prisma.voiceLexiconItem.deleteMany({
            where: {
                id,
                userId,
            },
        });
    }

    async getHintsForUser(userId: string, candidateLanguages: string[] = [], limit = 24): Promise<VoiceLexiconHint[]> {
        const uniqueLanguages = Array.from(
            new Set(
                candidateLanguages
                    .map((value) => String(value || '').trim().toLowerCase())
                    .filter(Boolean)
            )
        );

        const items = await prisma.voiceLexiconItem.findMany({
            where: {
                userId,
                ...(uniqueLanguages.length > 0
                    ? {
                        OR: [
                            { locale: null },
                            { locale: { in: uniqueLanguages } },
                        ],
                    }
                    : {}),
            },
            orderBy: [
                { usageCount: 'desc' },
                { boost: 'desc' },
                { updatedAt: 'desc' },
            ],
            take: limit,
        });

        return items.map((item) => ({
            canonical: item.canonical,
            aliases: item.aliases,
            locale: item.locale,
            itemType: item.itemType,
            boost: item.boost,
        }));
    }

    async markHintsUsed(userId: string, hints: VoiceLexiconHint[]) {
        const canonicalValues = Array.from(
            new Set(
                hints
                    .map((hint) => normalizeCanonical(hint.canonical))
                    .filter((value): value is string => Boolean(value))
                    .map(normalizeKey)
            )
        );

        if (canonicalValues.length === 0) {
            return;
        }

        await prisma.voiceLexiconItem.updateMany({
            where: {
                userId,
                normalized: {
                    in: canonicalValues,
                },
            },
            data: {
                usageCount: {
                    increment: 1,
                },
                lastUsedAt: new Date(),
            },
        });
    }
}

export const voiceLexiconService = new VoiceLexiconService();

export default voiceLexiconService;
