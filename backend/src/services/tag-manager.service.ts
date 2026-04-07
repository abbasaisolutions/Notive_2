import prisma from '../config/prisma';
import { TagSource } from '@prisma/client';

export interface TagMetaInput {
    name: string;
    source?: TagSource;
    confidence?: number;
}

export const normalizeTag = (tag: string) =>
    tag
        .replace(/^#+/, '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s-]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32);

export const buildTagMetaList = (tags: TagMetaInput[]): TagMetaInput[] => {
    const seen = new Map<string, TagMetaInput>();

    for (const tag of tags) {
        const normalized = normalizeTag(tag.name);
        if (!normalized) continue;
        if (seen.has(normalized)) continue;
        seen.set(normalized, {
            name: normalized,
            source: tag.source || TagSource.USER,
            confidence: tag.confidence ?? 1,
        });
    }

    return Array.from(seen.values());
};

export const syncEntryTags = async ({
    entryId,
    userId,
    tags,
}: {
    entryId: string;
    userId: string;
    tags: TagMetaInput[];
}) => {
    const normalizedTags = buildTagMetaList(tags);

    await prisma.entryTag.deleteMany({ where: { entryId } });

    if (normalizedTags.length === 0) return [];

    const tagRecords = await Promise.all(
        normalizedTags.map(async (tag) => {
            return prisma.tag.upsert({
                where: { normalized: normalizeTag(tag.name) },
                update: {},
                create: {
                    name: tag.name,
                    normalized: normalizeTag(tag.name),
                },
            });
        })
    );

    const tagMap = new Map<string, string>();
    tagRecords.forEach((record: (typeof tagRecords)[number]) => {
        tagMap.set(record.normalized, record.id);
    });

    await prisma.entryTag.createMany({
        data: normalizedTags.map(tag => ({
            entryId,
            userId,
            tagId: tagMap.get(normalizeTag(tag.name)) as string,
            source: tag.source || TagSource.USER,
            confidence: tag.confidence ?? 1,
        })),
        skipDuplicates: true,
    });

    return normalizedTags.map(t => t.name);
};
