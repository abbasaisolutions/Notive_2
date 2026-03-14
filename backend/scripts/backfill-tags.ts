import { PrismaClient, TagSource, EntrySource } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 200;
const normalizeEntries = process.argv.includes('--normalize-entry-tags');

const normalizeTag = (tag: string) =>
    tag
        .replace(/^#+/, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\s-]/g, '')
        .slice(0, 32);

const isSameTagSet = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
};

const sourceForEntry = (source?: EntrySource | null) => {
    if (source && source !== 'NOTIVE') return TagSource.IMPORT;
    return TagSource.USER;
};

const confidenceForSource = (source: TagSource) => (source === TagSource.IMPORT ? 0.7 : 1.0);

const run = async () => {
    let cursor: string | undefined = undefined;
    let processedEntries = 0;
    let updatedEntries = 0;
    let tagLinksCreated = 0;

    while (true) {
        const entries = await prisma.entry.findMany({
            where: { tags: { isEmpty: false } },
            orderBy: { id: 'asc' },
            take: BATCH_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            select: { id: true, userId: true, tags: true, source: true },
        });

        if (entries.length === 0) break;

        for (const entry of entries) {
            const normalizedTags = Array.from(
                new Set((entry.tags || []).map(normalizeTag).filter(Boolean))
            );

            if (normalizedTags.length === 0) continue;

            if (normalizeEntries) {
                const normalizedExisting = (entry.tags || []).map(normalizeTag).filter(Boolean);
                if (!isSameTagSet(normalizedExisting, normalizedTags)) {
                    await prisma.entry.update({
                        where: { id: entry.id },
                        data: { tags: normalizedTags },
                    });
                    updatedEntries += 1;
                }
            }

            await prisma.tag.createMany({
                data: normalizedTags.map(tag => ({
                    name: tag,
                    normalized: tag,
                })),
                skipDuplicates: true,
            });

            const tagRecords = await prisma.tag.findMany({
                where: { normalized: { in: normalizedTags } },
                select: { id: true, normalized: true },
            });

            const tagSource = sourceForEntry(entry.source);
            const confidence = confidenceForSource(tagSource);

            const createResult = await prisma.entryTag.createMany({
                data: tagRecords.map(tag => ({
                    entryId: entry.id,
                    tagId: tag.id,
                    userId: entry.userId,
                    source: tagSource,
                    confidence,
                })),
                skipDuplicates: true,
            });

            tagLinksCreated += createResult.count || 0;
            processedEntries += 1;
        }

        cursor = entries[entries.length - 1]?.id;
    }

    console.log(`Backfill complete. Processed entries: ${processedEntries}. Entry tags created: ${tagLinksCreated}.`);
    if (normalizeEntries) {
        console.log(`Entries normalized: ${updatedEntries}.`);
    }
};

run()
    .catch((error) => {
        console.error('Backfill failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
