import prisma from '../src/config/prisma';
import { aiRuntime } from '../src/config/ai';
import embeddingService from '../src/services/embedding.service';

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const run = async () => {
    const embeddingConfig = embeddingService.getActiveConfig();
    const embeddingsEnabled = embeddingService.isEnabled();

    const [entryCount, embeddingRows, chunkRows, chunkEntryRows] = await Promise.all([
        prisma.entry.count({
            where: {
                deletedAt: null,
            },
        }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "EntryEmbedding"
            WHERE model = ${embeddingConfig.model}
              AND dimensions = ${embeddingConfig.dimensions}
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "EntryEmbeddingChunk"
            WHERE model = ${embeddingConfig.model}
              AND dimensions = ${embeddingConfig.dimensions}
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(DISTINCT "entryId")::bigint AS count
            FROM "EntryEmbeddingChunk"
            WHERE model = ${embeddingConfig.model}
              AND dimensions = ${embeddingConfig.dimensions}
        `,
    ]);

    const activeEmbeddingCount = Number(embeddingRows[0]?.count || 0);
    const activeChunkCount = Number(chunkRows[0]?.count || 0);
    const entriesWithChunks = Number(chunkEntryRows[0]?.count || 0);
    const coverage = entryCount > 0 ? activeEmbeddingCount / entryCount : 0;
    const chunkCoverage = entryCount > 0 ? entriesWithChunks / entryCount : 0;

    console.log('Retrieval rollout status');
    console.log(`- embeddings enabled: ${embeddingsEnabled ? 'yes' : 'no'}`);
    console.log(`- embedding provider: ${embeddingConfig.provider}`);
    console.log(`- embedding model: ${embeddingConfig.model}`);
    console.log(`- embedding dimensions: ${embeddingConfig.dimensions}`);
    console.log(`- embedding service url: ${aiRuntime.embeddingServiceUrl || 'not configured'}`);
    console.log(`- live entries: ${entryCount}`);
    console.log(`- active embeddings: ${activeEmbeddingCount}`);
    console.log(`- coverage: ${entryCount > 0 ? formatPercent(coverage) : 'n/a'}`);
    console.log(`- active chunk rows: ${activeChunkCount}`);
    console.log(`- entries with chunk embeddings: ${entriesWithChunks}`);
    console.log(`- chunk coverage: ${entryCount > 0 ? formatPercent(chunkCoverage) : 'n/a'}`);

    if (aiRuntime.embeddingServiceUrl) {
        try {
            const response = await fetch(`${aiRuntime.embeddingServiceUrl}/health`);
            const payload = await response.json().catch(() => null);
            if (!response.ok) {
                console.log(`- similarity service: error ${response.status}`);
            } else {
                console.log(`- similarity service: ${payload?.status || 'healthy'}`);
                if (payload?.embedding_model) {
                    console.log(`- similarity encoder: ${payload.embedding_model}`);
                }
                if (payload?.reranker_model) {
                    console.log(`- local reranker: ${payload.reranker_model}`);
                }
            }
        } catch (error: any) {
            console.log(`- similarity service: unavailable (${error?.message || 'request failed'})`);
        }
    }

    if (!embeddingsEnabled) {
        console.log('\nNext step: enable USE_EMBEDDINGS and point EMBEDDING_SERVICE_URL or SIMILARITY_SERVICE_URL at the local service.');
    } else if (entryCount > activeEmbeddingCount || entryCount > entriesWithChunks) {
        console.log('\nNext step: run `npm run backfill:embeddings` to fill missing embeddings, or `npm run backfill:embeddings:force` after a model change.');
    } else {
        console.log('\nNext step: run the retrieval benchmark and spot-check search quality with live notes.');
    }
};

run()
    .catch((error) => {
        console.error('Retrieval rollout check failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
