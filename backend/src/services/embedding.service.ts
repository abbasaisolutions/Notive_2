import crypto from 'crypto';
import { EmbeddingJobStatus, Prisma } from '@prisma/client';
import { aiRuntime, createEmbedding, hasEmbeddingProvider } from '../config/ai';
import prisma from '../config/prisma';
import { buildPassageChunks } from '../utils/passage-chunking';
import {
    buildEntryEmbeddingFacets,
    getEmbeddingFacetLabel,
    type EntryEmbeddingFacetRecord,
} from '../utils/embedding-facets';

type UpsertEntryEmbeddingInput = {
    entryId: string;
    userId: string;
    content: string;
    title?: string | null;
    mood?: string | null;
    tags?: string[];
    skills?: string[];
    lessons?: string[];
    reflection?: string | null;
    analysis?: unknown;
    category?: string | null;
    lifeArea?: string | null;
    force?: boolean;
};

type UpsertEntryEmbeddingResult =
    | { status: 'disabled' | 'skipped'; reason: string }
    | { status: 'embedded'; dimensions: number }
    | { status: 'failed'; reason: string };

type ExistingFacetRow = {
    facetType: string;
    facetKey: string;
    contentHash: string;
};

type ExistingChunkRow = {
    id: string;
    chunkIndex: number;
    contentHash: string;
    chunkText: string;
};

type EmbeddingJobPayload = UpsertEntryEmbeddingInput;

type EmbeddingJobRecord = {
    id: string;
    attemptCount: number;
    maxAttempts: number;
    payload: Prisma.JsonValue;
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const configuredDims = parsePositiveInt(process.env.EMBEDDING_DIMS, 0);

const embeddingProvider = aiRuntime.embeddingVendor;

const OPENAI_EMBEDDING_MODEL = aiRuntime.embeddingModel;
const LOCAL_SERVICE_EMBEDDING_MODEL = aiRuntime.embeddingModel;
const LOCAL_EMBEDDING_MODEL = 'local-hash-v1';
const ACTIVE_EMBEDDING_MODEL =
    embeddingProvider === 'openai'
        ? OPENAI_EMBEDDING_MODEL
        : embeddingProvider === 'local_service'
            ? LOCAL_SERVICE_EMBEDDING_MODEL
            : LOCAL_EMBEDDING_MODEL;

const OPENAI_MODEL_DIMS: Record<string, number> = {
    'text-embedding-3-small': 1536,
    // Keep this under pgvector's HNSW/vector indexing ceiling (2,000 dims).
    // A full 3,072-dim rollout would require a storage/index refactor such as halfvec.
    'text-embedding-3-large': 1536,
};

const LOCAL_MODEL_DIMS: Record<string, number> = {
    'baai/bge-small-en-v1.5': 384,
    'sentence-transformers/all-minilm-l6-v2': 384,
    'all-minilm-l6-v2': 384,
    'all-mpnet-base-v2': 768,
    'sentence-transformers/all-mpnet-base-v2': 768,
    'baai/bge-base-en-v1.5': 768,
};

const DEFAULT_LOCAL_EMBEDDING_DIMS = 384;
const DEFAULT_LOCAL_HASH_DIMS = 384;

const resolveEmbeddingDimensions = (): number => {
    if (configuredDims > 0) return configuredDims;

    if (embeddingProvider === 'openai') {
        return OPENAI_MODEL_DIMS[OPENAI_EMBEDDING_MODEL] || OPENAI_MODEL_DIMS['text-embedding-3-small'];
    }

    if (embeddingProvider === 'local_service') {
        return LOCAL_MODEL_DIMS[LOCAL_SERVICE_EMBEDDING_MODEL.toLowerCase()] || DEFAULT_LOCAL_EMBEDDING_DIMS;
    }

    return DEFAULT_LOCAL_HASH_DIMS;
};

const EMBEDDING_DIMS = resolveEmbeddingDimensions();

const USE_EMBEDDINGS = process.env.USE_EMBEDDINGS === 'true';
const EMBEDDING_JOB_BATCH_SIZE = parsePositiveInt(process.env.EMBEDDING_JOB_BATCH_SIZE, 2);
const EMBEDDING_JOB_POLL_MS = parsePositiveInt(process.env.EMBEDDING_JOB_POLL_MS, 12000);
const EMBEDDING_JOB_MAX_ATTEMPTS = parsePositiveInt(process.env.EMBEDDING_JOB_MAX_ATTEMPTS, 4);
const EMBEDDING_JOB_STALE_MINUTES = parsePositiveInt(process.env.EMBEDDING_JOB_STALE_MINUTES, 10);
const EMBEDDING_JOB_WORKER_ID = `embed-worker-${process.pid}`;

type EmbeddingContextInput = Pick<
    UpsertEntryEmbeddingInput,
    'title' | 'mood' | 'tags' | 'skills' | 'lessons' | 'reflection' | 'category' | 'lifeArea'
>;

const normalizeContextList = (values: string[] | undefined, limit: number) =>
    Array.from(
        new Set(
            (values || [])
                .filter((value): value is string => typeof value === 'string')
                .map((value) => value.replace(/\s+/g, ' ').trim())
                .filter(Boolean)
        )
    ).slice(0, limit);

const clipContextText = (value: string | null | undefined, limit: number) => {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    return normalized.length <= limit ? normalized : `${normalized.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
};

const buildEmbeddingHeader = (input: EmbeddingContextInput) => {
    const lines: string[] = [];
    const safeTitle = typeof input.title === 'string' ? input.title.trim() : '';
    const safeMood = typeof input.mood === 'string' ? input.mood.trim() : '';
    const safeCategory = typeof input.category === 'string' ? input.category.trim() : '';
    const safeLifeArea = typeof input.lifeArea === 'string' ? input.lifeArea.trim() : '';
    const tags = normalizeContextList(input.tags, 6);
    const skills = normalizeContextList(input.skills, 6);
    const lessons = normalizeContextList(input.lessons, 3);
    const reflection = clipContextText(input.reflection, 220);

    if (safeTitle) lines.push(`Title: ${safeTitle}`);
    if (safeMood) lines.push(`Mood: ${safeMood}`);
    if (safeCategory) lines.push(`Category: ${safeCategory}`);
    if (safeLifeArea) lines.push(`Life Area: ${safeLifeArea}`);
    if (tags.length > 0) lines.push(`Themes: ${tags.join(', ')}`);
    if (skills.length > 0) lines.push(`Strengths: ${skills.join(', ')}`);
    if (lessons.length > 0) lines.push(`Lessons: ${lessons.join(' | ')}`);
    if (reflection) lines.push(`Reflection: ${reflection}`);

    return lines.join('\n');
};

const buildEmbeddingText = (content: string, context: EmbeddingContextInput = {}) => {
    const safeContent = String(content || '').trim();
    const header = buildEmbeddingHeader(context);
    if (!header) return safeContent;
    return `${header}\n\nEntry:\n${safeContent}`.trim();
};

const buildChunkEmbeddingText = (
    chunkText: string,
    context: EmbeddingContextInput,
    chunkIndex: number,
    chunkCount: number
) => {
    const safeChunkText = String(chunkText || '').trim();
    const heading = chunkCount > 1
        ? `Passage ${chunkIndex + 1} of ${chunkCount}`
        : 'Passage';
    const header = buildEmbeddingHeader({
        title: context.title,
        mood: context.mood,
        tags: context.tags,
        skills: context.skills,
        category: context.category,
        lifeArea: context.lifeArea,
    });

    return [header, heading, safeChunkText].filter(Boolean).join('\n\n').trim();
};

const buildFacetEmbeddingText = (
    facet: EntryEmbeddingFacetRecord,
    context: EmbeddingContextInput
) => {
    const header = buildEmbeddingHeader({
        title: context.title,
        mood: context.mood,
        tags: context.tags,
        category: context.category,
        lifeArea: context.lifeArea,
    });

    return [
        header,
        `${getEmbeddingFacetLabel(facet.facetType)}:\n${facet.facetText}`.trim(),
    ].filter(Boolean).join('\n\n').trim();
};

const hashText = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const cloneJsonValue = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value ?? null)) as T;

const asStringArray = (value: unknown): string[] | undefined =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : undefined;

const parseJobPayload = (value: Prisma.JsonValue): EmbeddingJobPayload | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    const record = value as Record<string, unknown>;
    if (typeof record.entryId !== 'string' || typeof record.userId !== 'string' || typeof record.content !== 'string') {
        return null;
    }

    return {
        entryId: record.entryId,
        userId: record.userId,
        content: record.content,
        title: typeof record.title === 'string' ? record.title : null,
        mood: typeof record.mood === 'string' ? record.mood : null,
        tags: asStringArray(record.tags),
        skills: asStringArray(record.skills),
        lessons: asStringArray(record.lessons),
        reflection: typeof record.reflection === 'string' ? record.reflection : null,
        analysis: record.analysis,
        category: typeof record.category === 'string' ? record.category : null,
        lifeArea: typeof record.lifeArea === 'string' ? record.lifeArea : null,
        force: Boolean(record.force),
    };
};

const normalizeVector = (values: number[]) => {
    const magnitude = Math.sqrt(values.reduce((sum, value) => sum + (value * value), 0));
    if (!Number.isFinite(magnitude) || magnitude <= 0) return values;
    return values.map((value) => Number((value / magnitude).toFixed(8)));
};

const toVectorLiteral = (values: number[]) => `[${values.join(',')}]`;

const fnv1a = (input: string) => {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const localHashEmbedding = (text: string, dimensions: number) => {
    const tokens = (text.toLowerCase().match(/\b[a-z0-9']+\b/g) || []).filter(Boolean);
    const vector = new Array<number>(dimensions).fill(0);
    const counts = new Map<string, number>();

    tokens.forEach((token) => {
        counts.set(token, (counts.get(token) || 0) + 1);
    });
    for (let i = 0; i < tokens.length - 1; i++) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        counts.set(bigram, (counts.get(bigram) || 0) + 1);
    }

    counts.forEach((count, feature) => {
        const weight = 1 + Math.log(count);
        const h1 = fnv1a(feature);
        const h2 = fnv1a(`${feature}|sign`);
        const index = h1 % dimensions;
        const sign = (h2 & 1) === 0 ? 1 : -1;
        vector[index] += weight * sign;
    });

    return normalizeVector(vector);
};

export class EmbeddingService {
    private workerTimer: NodeJS.Timeout | null = null;
    private isDrainingJobs = false;

    isEnabled() {
        if (!USE_EMBEDDINGS) return false;
        if (embeddingProvider === 'local_hash') return true;
        return hasEmbeddingProvider();
    }

    getActiveConfig() {
        return {
            provider: embeddingProvider,
            model: ACTIVE_EMBEDDING_MODEL,
            dimensions: EMBEDDING_DIMS,
        };
    }

    private async generateEmbedding(
        embeddingText: string,
        purpose: 'query' | 'document' = 'document'
    ): Promise<number[] | null> {
        const [embedding] = await this.generateEmbeddings([embeddingText], purpose);
        return embedding || null;
    }

    private normalizeEmbedding(rawEmbedding: unknown): number[] | null {
        if (!Array.isArray(rawEmbedding) || rawEmbedding.length !== EMBEDDING_DIMS) {
            return null;
        }

        const values = rawEmbedding.map((value) => Number(value));
        if (values.some((value) => !Number.isFinite(value))) {
            return null;
        }

        return normalizeVector(values);
    }

    private async generateEmbeddings(
        embeddingTexts: string[],
        purpose: 'query' | 'document' = 'document'
    ): Promise<Array<number[] | null>> {
        if (embeddingTexts.length === 0) {
            return [];
        }

        if (embeddingProvider === 'openai') {
            const response = await createEmbedding({
                model: OPENAI_EMBEDDING_MODEL,
                input: embeddingTexts,
                dimensions: EMBEDDING_DIMS,
            });
            if (!response) return embeddingTexts.map(() => null);

            return embeddingTexts.map((_, index) =>
                this.normalizeEmbedding(response.data?.[index]?.embedding)
            );
        }

        if (embeddingProvider === 'local_service') {
            if (!aiRuntime.embeddingServiceUrl) return embeddingTexts.map(() => null);

            const response = await fetch(`${aiRuntime.embeddingServiceUrl}/embed`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    texts: embeddingTexts,
                    mode: purpose,
                    normalize: true,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                throw new Error(`Local embedding service error: ${response.status} ${errorBody}`);
            }

            const data = await response.json().catch(() => null);
            return embeddingTexts.map((_, index) =>
                this.normalizeEmbedding(data?.embeddings?.[index])
            );
        }

        return embeddingTexts.map((embeddingText) => localHashEmbedding(embeddingText, EMBEDDING_DIMS));
    }

    async embedText(input: {
        content: string;
        title?: string | null;
        mood?: string | null;
        tags?: string[];
        skills?: string[];
        lessons?: string[];
        reflection?: string | null;
        category?: string | null;
        lifeArea?: string | null;
        purpose?: 'query' | 'document';
    }): Promise<number[] | null> {
        if (!this.isEnabled()) return null;

        const purpose = input.purpose || 'document';
        const embeddingText = purpose === 'query'
            ? String(input.content || '').trim()
            : buildEmbeddingText(input.content, input);
        if (embeddingText.length < 5) {
            return null;
        }

        return this.generateEmbedding(embeddingText, purpose);
    }

    async upsertEntryEmbedding(input: UpsertEntryEmbeddingInput): Promise<UpsertEntryEmbeddingResult> {
        if (!this.isEnabled()) {
            return { status: 'disabled', reason: 'Embeddings are disabled by configuration.' };
        }

        const embeddingText = buildEmbeddingText(input.content, input);
        if (embeddingText.length < 5) {
            return { status: 'skipped', reason: 'Content too short for embedding.' };
        }

        const contentHash = hashText(embeddingText);
        const passageSource = [String(input.content || '').trim(), String(input.reflection || '').trim()]
            .filter(Boolean)
            .join('\n\n')
            || String(input.title || '').trim();
        const passageChunks = buildPassageChunks(passageSource);
        if (passageChunks.length === 0) {
            return { status: 'skipped', reason: 'Content too short for passage embeddings.' };
        }
        const chunkCount = passageChunks.length;
        const entryFacets = buildEntryEmbeddingFacets({
            title: input.title,
            reflection: input.reflection,
            lessons: input.lessons,
            skills: input.skills,
            analysis: input.analysis,
        });

        try {
            const [existingEntry, existingChunks, existingFacets] = await Promise.all([
                prisma.entryEmbedding.findFirst({
                    where: {
                        entryId: input.entryId,
                        model: ACTIVE_EMBEDDING_MODEL,
                        dimensions: EMBEDDING_DIMS,
                    },
                    select: {
                        id: true,
                        contentHash: true,
                    },
                }),
                prisma.entryEmbeddingChunk.findMany({
                    where: {
                        entryId: input.entryId,
                        model: ACTIVE_EMBEDDING_MODEL,
                        dimensions: EMBEDDING_DIMS,
                    },
                    select: {
                        id: true,
                        chunkIndex: true,
                        contentHash: true,
                        chunkText: true,
                    },
                    orderBy: {
                        chunkIndex: 'asc',
                    },
                }),
                prisma.$queryRawUnsafe<ExistingFacetRow[]>(
                    `
                    SELECT
                        "facetType" AS "facetType",
                        "facetKey" AS "facetKey",
                        "contentHash" AS "contentHash"
                    FROM "EntryEmbeddingFacet"
                    WHERE "entryId" = $1
                      AND model = $2
                      AND dimensions = $3
                    `,
                    input.entryId,
                    ACTIVE_EMBEDDING_MODEL,
                    EMBEDDING_DIMS
                ),
            ]);

            const isEntryCurrent = existingEntry?.contentHash === contentHash;
            const isChunkSetCurrent = existingChunks.length === chunkCount
                && existingChunks.every((chunk, index) =>
                    chunk.contentHash === contentHash
                    && chunk.chunkIndex === passageChunks[index]?.index
                    && chunk.chunkText === passageChunks[index]?.text
                );
            const facetHashMap = new Map(
                entryFacets.map((facet) => [`${facet.facetType}:${facet.facetKey}`, facet.contentHash])
            );
            const isFacetSetCurrent = existingFacets.length === entryFacets.length
                && existingFacets.every((facet) =>
                    facetHashMap.get(`${facet.facetType}:${facet.facetKey}`) === facet.contentHash
                );

            if (!input.force && isEntryCurrent && isChunkSetCurrent && isFacetSetCurrent) {
                return { status: 'skipped', reason: 'Embedding already up to date for current content hash.' };
            }

            const needsEntryRefresh = input.force || !isEntryCurrent;
            const needsChunkRefresh = input.force || !isChunkSetCurrent;
            const needsFacetRefresh = input.force || !isFacetSetCurrent;
            const embeddingTasks: Array<
                | { kind: 'entry'; embeddingText: string }
                | { kind: 'chunk'; chunkIndex: number; chunkText: string; embeddingText: string }
                | { kind: 'facet'; facet: EntryEmbeddingFacetRecord; embeddingText: string }
            > = [];

            if (needsEntryRefresh) {
                embeddingTasks.push({ kind: 'entry', embeddingText });
            }

            if (needsChunkRefresh) {
                passageChunks.forEach((chunk) => {
                    embeddingTasks.push({
                        kind: 'chunk',
                        chunkIndex: chunk.index,
                        chunkText: chunk.text,
                        embeddingText: buildChunkEmbeddingText(chunk.text, input, chunk.index, chunkCount),
                    });
                });
            }

            if (needsFacetRefresh && entryFacets.length > 0) {
                entryFacets.forEach((facet) => {
                    embeddingTasks.push({
                        kind: 'facet',
                        facet,
                        embeddingText: buildFacetEmbeddingText(facet, input),
                    });
                });
            }

            const generatedEmbeddings = await this.generateEmbeddings(
                embeddingTasks.map((task) => task.embeddingText),
                'document'
            );

            const chunkVectorLiterals = new Map<number, string>();
            const facetVectorLiterals = new Map<string, string>();
            let entryVectorLiteral: string | null = null;

            for (let index = 0; index < embeddingTasks.length; index += 1) {
                const task = embeddingTasks[index];
                const normalized = generatedEmbeddings[index];

                if (!normalized || normalized.length === 0) {
                    return { status: 'failed', reason: 'Embedding API returned an empty vector.' };
                }

                if (normalized.length !== EMBEDDING_DIMS) {
                    return {
                        status: 'failed',
                        reason: `Embedding dimension mismatch. Expected ${EMBEDDING_DIMS}, received ${normalized.length}.`,
                    };
                }

                if (task.kind === 'entry') {
                    entryVectorLiteral = toVectorLiteral(normalized);
                } else if (task.kind === 'chunk') {
                    chunkVectorLiterals.set(task.chunkIndex, toVectorLiteral(normalized));
                } else {
                    facetVectorLiterals.set(
                        `${task.facet.facetType}:${task.facet.facetKey}`,
                        toVectorLiteral(normalized)
                    );
                }
            }

            if (needsEntryRefresh && !entryVectorLiteral) {
                return {
                    status: 'failed',
                    reason: 'Failed to generate the primary entry embedding.',
                };
            }

            if (needsChunkRefresh && chunkVectorLiterals.size !== chunkCount) {
                return {
                    status: 'failed',
                    reason: `Chunk embedding count mismatch. Expected ${chunkCount}, received ${chunkVectorLiterals.size}.`,
                };
            }

            if (needsFacetRefresh && facetVectorLiterals.size !== entryFacets.length) {
                return {
                    status: 'failed',
                    reason: `Facet embedding count mismatch. Expected ${entryFacets.length}, received ${facetVectorLiterals.size}.`,
                };
            }

            await prisma.$transaction(async (tx) => {
                if (needsEntryRefresh && entryVectorLiteral) {
                    const recordId = existingEntry?.id || crypto.randomUUID();

                    await tx.$executeRawUnsafe(
                        `
                        INSERT INTO "EntryEmbedding"
                            (id, "entryId", "userId", model, dimensions, "contentHash", embedding, "createdAt", "updatedAt")
                        VALUES
                            ($1, $2, $3, $4, $5, $6, $7::vector, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT ("entryId", model, dimensions)
                        DO UPDATE SET
                            "userId" = EXCLUDED."userId",
                            "contentHash" = EXCLUDED."contentHash",
                            embedding = EXCLUDED.embedding,
                            "updatedAt" = CURRENT_TIMESTAMP
                        `,
                        recordId,
                        input.entryId,
                        input.userId,
                        ACTIVE_EMBEDDING_MODEL,
                        EMBEDDING_DIMS,
                        contentHash,
                        entryVectorLiteral
                    );
                }

                if (needsChunkRefresh) {
                    await tx.entryEmbeddingChunk.deleteMany({
                        where: {
                            entryId: input.entryId,
                            model: ACTIVE_EMBEDDING_MODEL,
                            dimensions: EMBEDDING_DIMS,
                        },
                    });

                    const chunkRows = passageChunks.map((chunk) => ({
                        id: crypto.randomUUID(),
                        chunkIndex: chunk.index,
                        chunkText: chunk.text,
                        vectorLiteral: chunkVectorLiterals.get(chunk.index) || null,
                    }));

                    if (chunkRows.some((chunk) => !chunk.vectorLiteral)) {
                        throw new Error('Failed to generate one or more chunk embeddings.');
                    }

                    const placeholders = chunkRows
                        .map((_, index) => {
                            const offset = index * 10;
                            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}::vector, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
                        })
                        .join(', ');

                    const values = chunkRows.flatMap((chunk) => [
                        chunk.id,
                        input.entryId,
                        input.userId,
                        ACTIVE_EMBEDDING_MODEL,
                        EMBEDDING_DIMS,
                        contentHash,
                        chunk.chunkIndex,
                        chunkCount,
                        chunk.chunkText,
                        chunk.vectorLiteral,
                    ]);

                    await tx.$executeRawUnsafe(
                        `
                        INSERT INTO "EntryEmbeddingChunk"
                            (id, "entryId", "userId", model, dimensions, "contentHash", "chunkIndex", "chunkCount", "chunkText", embedding, "createdAt", "updatedAt")
                        VALUES
                            ${placeholders}
                        `,
                        ...values
                    );
                }

                if (needsFacetRefresh) {
                    await tx.$executeRawUnsafe(
                        `
                        DELETE FROM "EntryEmbeddingFacet"
                        WHERE "entryId" = $1
                          AND model = $2
                          AND dimensions = $3
                        `,
                        input.entryId,
                        ACTIVE_EMBEDDING_MODEL,
                        EMBEDDING_DIMS
                    );

                    if (entryFacets.length > 0) {
                        const facetRows = entryFacets.map((facet) => ({
                            id: crypto.randomUUID(),
                            facet,
                            vectorLiteral: facetVectorLiterals.get(`${facet.facetType}:${facet.facetKey}`) || null,
                        }));

                        if (facetRows.some((facetRow) => !facetRow.vectorLiteral)) {
                            throw new Error('Failed to generate one or more facet embeddings.');
                        }

                        const placeholders = facetRows
                            .map((_, index) => {
                                const offset = index * 10;
                                return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}::vector, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
                            })
                            .join(', ');

                        const values = facetRows.flatMap((facetRow) => [
                            facetRow.id,
                            input.entryId,
                            input.userId,
                            ACTIVE_EMBEDDING_MODEL,
                            EMBEDDING_DIMS,
                            facetRow.facet.contentHash,
                            facetRow.facet.facetType,
                            facetRow.facet.facetKey,
                            facetRow.facet.facetText,
                            facetRow.vectorLiteral,
                        ]);

                        await tx.$executeRawUnsafe(
                            `
                            INSERT INTO "EntryEmbeddingFacet"
                                (id, "entryId", "userId", model, dimensions, "contentHash", "facetType", "facetKey", "facetText", embedding, "createdAt", "updatedAt")
                            VALUES
                                ${placeholders}
                            `,
                            ...values
                        );
                    }
                }
            });

            return { status: 'embedded', dimensions: EMBEDDING_DIMS };
        } catch (error: any) {
            console.error('Embedding generation failed:', error);
            return {
                status: 'failed',
                reason: error?.message || 'Unknown embedding failure',
            };
        }
    }

    startJobWorker() {
        if (!this.isEnabled() || this.workerTimer) {
            return;
        }

        const tick = () => {
            void this.drainEmbeddingJobs();
        };

        this.workerTimer = setInterval(tick, EMBEDDING_JOB_POLL_MS);
        this.workerTimer.unref?.();
        tick();
    }

    private async claimPendingJobs(batchSize: number): Promise<EmbeddingJobRecord[]> {
        const now = new Date();
        const staleBefore = new Date(Date.now() - (EMBEDDING_JOB_STALE_MINUTES * 60 * 1000));
        const candidates = await prisma.embeddingJob.findMany({
            where: {
                OR: [
                    {
                        status: EmbeddingJobStatus.PENDING,
                        runAfter: { lte: now },
                    },
                    {
                        status: EmbeddingJobStatus.PROCESSING,
                        lockedAt: { lt: staleBefore },
                    },
                ],
            },
            orderBy: [
                { runAfter: 'asc' },
                { createdAt: 'asc' },
            ],
            take: batchSize,
            select: {
                id: true,
                attemptCount: true,
                maxAttempts: true,
                payload: true,
            },
        });

        const claimed: EmbeddingJobRecord[] = [];
        for (const candidate of candidates) {
            const updated = await prisma.embeddingJob.updateMany({
                where: {
                    id: candidate.id,
                    OR: [
                        {
                            status: EmbeddingJobStatus.PENDING,
                            runAfter: { lte: now },
                        },
                        {
                            status: EmbeddingJobStatus.PROCESSING,
                            lockedAt: { lt: staleBefore },
                        },
                    ],
                },
                data: {
                    status: EmbeddingJobStatus.PROCESSING,
                    lockedAt: now,
                    lockedBy: EMBEDDING_JOB_WORKER_ID,
                    lastError: null,
                },
            });

            if (updated.count > 0) {
                claimed.push(candidate);
            }
        }

        return claimed;
    }

    private async finalizeJob(jobId: string, data: Prisma.EmbeddingJobUpdateManyMutationInput) {
        await prisma.embeddingJob.updateMany({
            where: {
                id: jobId,
                status: EmbeddingJobStatus.PROCESSING,
                lockedBy: EMBEDDING_JOB_WORKER_ID,
            },
            data,
        });
    }

    private async rescheduleJob(job: EmbeddingJobRecord, reason: string) {
        const attemptCount = job.attemptCount + 1;
        const maxAttempts = Math.max(1, job.maxAttempts || EMBEDDING_JOB_MAX_ATTEMPTS);
        const exhausted = attemptCount >= maxAttempts;

        if (exhausted) {
            await this.finalizeJob(job.id, {
                status: EmbeddingJobStatus.FAILED,
                attemptCount,
                lastError: reason.slice(0, 4000),
                lockedAt: null,
                lockedBy: null,
            });
            return;
        }

        const retryDelayMs = Math.min(15 * 60 * 1000, Math.pow(2, Math.max(0, attemptCount - 1)) * 15000);
        await this.finalizeJob(job.id, {
            status: EmbeddingJobStatus.PENDING,
            attemptCount,
            runAfter: new Date(Date.now() + retryDelayMs),
            lastError: reason.slice(0, 4000),
            lockedAt: null,
            lockedBy: null,
        });
    }

    private async processEmbeddingJob(job: EmbeddingJobRecord) {
        const payload = parseJobPayload(job.payload);
        if (!payload) {
            await this.finalizeJob(job.id, {
                status: EmbeddingJobStatus.FAILED,
                attemptCount: job.attemptCount + 1,
                lastError: 'Invalid embedding job payload.',
                lockedAt: null,
                lockedBy: null,
            });
            return;
        }

        try {
            const result = await this.upsertEntryEmbedding(payload);
            if (result.status === 'failed') {
                await this.rescheduleJob(job, result.reason);
                return;
            }

            await this.finalizeJob(job.id, {
                status: EmbeddingJobStatus.COMPLETED,
                completedAt: new Date(),
                lastError: null,
                lockedAt: null,
                lockedBy: null,
            });
        } catch (error: any) {
            await this.rescheduleJob(job, error?.message || 'Unknown embedding job failure');
        }
    }

    private async drainEmbeddingJobs() {
        if (!this.isEnabled() || this.isDrainingJobs) {
            return;
        }

        this.isDrainingJobs = true;
        try {
            while (true) {
                const jobs = await this.claimPendingJobs(EMBEDDING_JOB_BATCH_SIZE);
                if (jobs.length === 0) {
                    break;
                }

                for (const job of jobs) {
                    await this.processEmbeddingJob(job);
                }
            }
        } finally {
            this.isDrainingJobs = false;
        }
    }

    enqueueEntryEmbedding(input: UpsertEntryEmbeddingInput) {
        if (!this.isEnabled()) return;

        const payload = cloneJsonValue(input) as Prisma.InputJsonValue;
        const now = new Date();

        void prisma.embeddingJob.upsert({
            where: {
                entryId_model_dimensions: {
                    entryId: input.entryId,
                    model: ACTIVE_EMBEDDING_MODEL,
                    dimensions: EMBEDDING_DIMS,
                },
            },
            create: {
                entryId: input.entryId,
                userId: input.userId,
                model: ACTIVE_EMBEDDING_MODEL,
                dimensions: EMBEDDING_DIMS,
                payload,
                status: EmbeddingJobStatus.PENDING,
                attemptCount: 0,
                maxAttempts: EMBEDDING_JOB_MAX_ATTEMPTS,
                runAfter: now,
            },
            update: {
                userId: input.userId,
                payload,
                status: EmbeddingJobStatus.PENDING,
                attemptCount: 0,
                maxAttempts: EMBEDDING_JOB_MAX_ATTEMPTS,
                runAfter: now,
                lockedAt: null,
                lockedBy: null,
                lastError: null,
                completedAt: null,
            },
        }).then(() => {
            this.startJobWorker();
            void this.drainEmbeddingJobs();
        }).catch((error) => {
            console.error('Failed to enqueue embedding job:', error);
        });
    }
}

export default new EmbeddingService();
