import { PrismaClient, TagSource, EntrySource } from '@prisma/client';
import { normalizeTag } from '../src/utils/normalize-tag';

const prisma = new PrismaClient();

const BATCH_SIZE = 200;
const normalizeEntries = process.argv.includes('--normalize-entry-tags');
const dryRun = process.argv.includes('--dry-run');

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

const deduplicateTags = async () => {
    console.log('\n--- Tag deduplication pass ---');
    const allTags = await prisma.tag.findMany({ select: { id: true, name: true, normalized: true } });

    const groups = new Map<string, typeof allTags>();
    for (const tag of allTags) {
        const newNormalized = normalizeTag(tag.name);
        if (!newNormalized) continue;
        const group = groups.get(newNormalized) || [];
        group.push(tag);
        groups.set(newNormalized, group);
    }

    let mergedTags = 0;
    let deletedTags = 0;
    let updatedNormalized = 0;

    for (const [canonical, group] of groups) {
        // Update normalized field for all tags in this group
        for (const tag of group) {
            if (tag.normalized !== canonical) {
                console.log(`  Renormalize: "${tag.normalized}" -> "${canonical}"`);
                if (!dryRun) {
                    await prisma.tag.update({
                        where: { id: tag.id },
                        data: { normalized: canonical, name: canonical },
                    });
                }
                updatedNormalized++;
            }
        }

        if (group.length <= 1) continue;

        // Pick the tag with the most EntryTag references as the canonical one
        const counts = await Promise.all(
            group.map(async (tag) => ({
                tag,
                count: await prisma.entryTag.count({ where: { tagId: tag.id } }),
            }))
        );
        counts.sort((a, b) => b.count - a.count);

        const keeper = counts[0].tag;
        const duplicates = counts.slice(1).map(c => c.tag);

        console.log(`  Merge "${canonical}": keep ${keeper.id} (${counts[0].count} refs), remove ${duplicates.length} duplicates`);

        if (!dryRun) {
            for (const dup of duplicates) {
                // Remap EntryTag references, skipping any that would create duplicates
                const dupEntryTags = await prisma.entryTag.findMany({ where: { tagId: dup.id } });
                for (const et of dupEntryTags) {
                    const existing = await prisma.entryTag.findUnique({
                        where: { entryId_tagId: { entryId: et.entryId, tagId: keeper.id } },
                    });
                    if (existing) {
                        await prisma.entryTag.delete({ where: { id: et.id } });
                    } else {
                        await prisma.entryTag.update({
                            where: { id: et.id },
                            data: { tagId: keeper.id },
                        });
                    }
                }
                await prisma.tag.delete({ where: { id: dup.id } });
                deletedTags++;
            }
        }

        mergedTags += duplicates.length;
    }

    console.log(`Dedup complete. Re-normalized: ${updatedNormalized}. Merged groups: ${mergedTags}. Deleted tags: ${deletedTags}.`);
};

const run = async () => {
    if (dryRun) console.log('*** DRY RUN — no changes will be written ***\n');

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
                if (!isSameTagSet(entry.tags || [], normalizedTags)) {
                    console.log(`  Entry ${entry.id}: [${(entry.tags || []).join(', ')}] -> [${normalizedTags.join(', ')}]`);
                    if (!dryRun) {
                        await prisma.entry.update({
                            where: { id: entry.id },
                            data: { tags: normalizedTags },
                        });
                    }
                    updatedEntries += 1;
                }
            }

            if (!dryRun) {
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
            }

            processedEntries += 1;
        }

        cursor = entries[entries.length - 1]?.id;
    }

    console.log(`\nBackfill complete. Processed entries: ${processedEntries}. Entry tags created: ${tagLinksCreated}.`);
    if (normalizeEntries) {
        console.log(`Entries normalized: ${updatedEntries}.`);
    }

    await deduplicateTags();
};

run()
    .catch((error) => {
        console.error('Backfill failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
