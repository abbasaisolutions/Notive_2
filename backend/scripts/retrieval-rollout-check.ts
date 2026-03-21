import { EmbeddingJobStatus } from '@prisma/client';
import prisma from '../src/config/prisma';
import { aiRuntime } from '../src/config/ai';
import embeddingService from '../src/services/embedding.service';

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const run = async () => {
    const embeddingConfig = embeddingService.getActiveConfig();
    const embeddingsEnabled = embeddingService.isEnabled();
    const entryAnnIndexName = `EntryEmbedding_embedding_${embeddingConfig.dimensions}_hnsw_idx`;
    const chunkAnnIndexName = `EntryEmbeddingChunk_embedding_${embeddingConfig.dimensions}_hnsw_idx`;
    const facetAnnIndexName = `EntryEmbeddingFacet_embedding_${embeddingConfig.dimensions}_hnsw_idx`;

    const [entryCount, embeddingRows, chunkRows, chunkEntryRows, facetRows, facetEntryRows, entryAnnIndexRows, chunkAnnIndexRows, facetAnnIndexRows, pendingJobs, processingJobs, failedJobs] = await Promise.all([
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
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*)::bigint AS count
            FROM "EntryEmbeddingFacet"
            WHERE model = ${embeddingConfig.model}
              AND dimensions = ${embeddingConfig.dimensions}
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(DISTINCT "entryId")::bigint AS count
            FROM "EntryEmbeddingFacet"
            WHERE model = ${embeddingConfig.model}
              AND dimensions = ${embeddingConfig.dimensions}
        `,
        prisma.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = current_schema()
                  AND indexname = ${entryAnnIndexName}
            ) AS exists
        `,
        prisma.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = current_schema()
                  AND indexname = ${chunkAnnIndexName}
            ) AS exists
        `,
        prisma.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = current_schema()
                  AND indexname = ${facetAnnIndexName}
            ) AS exists
        `,
        prisma.embeddingJob.count({
            where: {
                status: EmbeddingJobStatus.PENDING,
            },
        }),
        prisma.embeddingJob.count({
            where: {
                status: EmbeddingJobStatus.PROCESSING,
            },
        }),
        prisma.embeddingJob.count({
            where: {
                status: EmbeddingJobStatus.FAILED,
            },
        }),
    ]);

    const activeEmbeddingCount = Number(embeddingRows[0]?.count || 0);
    const activeChunkCount = Number(chunkRows[0]?.count || 0);
    const entriesWithChunks = Number(chunkEntryRows[0]?.count || 0);
    const activeFacetCount = Number(facetRows[0]?.count || 0);
    const entriesWithFacets = Number(facetEntryRows[0]?.count || 0);
    const coverage = entryCount > 0 ? activeEmbeddingCount / entryCount : 0;
    const chunkCoverage = entryCount > 0 ? entriesWithChunks / entryCount : 0;
    const facetCoverage = entryCount > 0 ? entriesWithFacets / entryCount : 0;
    const entryAnnIndexReady = Boolean(entryAnnIndexRows[0]?.exists);
    const chunkAnnIndexReady = Boolean(chunkAnnIndexRows[0]?.exists);
    const facetAnnIndexReady = Boolean(facetAnnIndexRows[0]?.exists);
    const exceedsPgvectorHnswVectorLimit = embeddingConfig.dimensions > 2000;

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
    console.log(`- active facet rows: ${activeFacetCount}`);
    console.log(`- entries with facet embeddings: ${entriesWithFacets}`);
    console.log(`- facet coverage: ${entryCount > 0 ? formatPercent(facetCoverage) : 'n/a'}`);
    console.log(`- entry ANN index ready: ${entryAnnIndexReady ? 'yes' : `no (${entryAnnIndexName})`}`);
    console.log(`- chunk ANN index ready: ${chunkAnnIndexReady ? 'yes' : `no (${chunkAnnIndexName})`}`);
    console.log(`- facet ANN index ready: ${facetAnnIndexReady ? 'yes' : `no (${facetAnnIndexName})`}`);
    console.log(`- embedding jobs pending: ${pendingJobs}`);
    console.log(`- embedding jobs processing: ${processingJobs}`);
    console.log(`- embedding jobs failed: ${failedJobs}`);
    if (exceedsPgvectorHnswVectorLimit) {
        console.log('- ANN note: pgvector HNSW indexes on vector columns top out at 2000 dimensions; use <=2000 dims or refactor to halfvec for larger embeddings.');
    }

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
    } else if (exceedsPgvectorHnswVectorLimit) {
        console.log('\nNext step: lower EMBEDDING_DIMS to an ANN-friendly value, or migrate the storage/index layer to halfvec before using larger vectors.');
    } else if (!entryAnnIndexReady || !chunkAnnIndexReady || !facetAnnIndexReady) {
        console.log('\nNext step: run the latest Prisma migration so the active embedding dimensions have matching pgvector HNSW indexes.');
    } else if (failedJobs > 0) {
        console.log('\nNext step: inspect failed embedding jobs and requeue them after fixing the underlying payload or model issue.');
    } else if (pendingJobs > 0 || processingJobs > 0) {
        console.log('\nNext step: let the embedding worker drain the pending queue, then re-run this doctor to confirm steady-state coverage.');
    } else if (entryCount > activeEmbeddingCount || entryCount > entriesWithChunks || entryCount > entriesWithFacets) {
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
