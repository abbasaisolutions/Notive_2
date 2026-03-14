import prisma from '../src/config/prisma';
import embeddingService from '../src/services/embedding.service';

const BATCH_SIZE = 100;
const force = process.argv.includes('--force');

const run = async () => {
    if (!embeddingService.isEnabled()) {
        console.log('Embedding backfill skipped: USE_EMBEDDINGS=true and OPENAI_API_KEY are required.');
        return;
    }

    let cursor: string | undefined;
    let scanned = 0;
    let embedded = 0;
    let skipped = 0;
    let failed = 0;

    while (true) {
        const entries = await prisma.entry.findMany({
            where: { deletedAt: null },
            orderBy: { id: 'asc' },
            take: BATCH_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            select: {
                id: true,
                userId: true,
                title: true,
                content: true,
            },
        });

        if (entries.length === 0) break;

        for (const entry of entries) {
            scanned += 1;
            const result = await embeddingService.upsertEntryEmbedding({
                entryId: entry.id,
                userId: entry.userId,
                title: entry.title,
                content: entry.content,
                force,
            });

            if (result.status === 'embedded') embedded += 1;
            else if (result.status === 'failed') failed += 1;
            else skipped += 1;
        }

        cursor = entries[entries.length - 1]?.id;
        console.log(`Backfill progress: scanned=${scanned}, embedded=${embedded}, skipped=${skipped}, failed=${failed}`);
    }

    console.log(`Backfill complete: scanned=${scanned}, embedded=${embedded}, skipped=${skipped}, failed=${failed}`);
};

run()
    .catch((error) => {
        console.error('Embedding backfill failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
