import crypto from 'crypto';
import { aiRuntime, createEmbedding, hasEmbeddingProvider } from '../config/ai';
import prisma from '../config/prisma';
import { buildPassageChunks } from '../utils/passage-chunking';

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
    category?: string | null;
    lifeArea?: string | null;
    force?: boolean;
};

type UpsertEntryEmbeddingResult =
    | { status: 'disabled' | 'skipped'; reason: string }
    | { status: 'embedded'; dimensions: number }
    | { status: 'failed'; reason: string };

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
    // Keep the large model's default projection pgvector-safe for the current storage layer.
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

const hashText = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

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

        try {
            const [existingEntry, existingChunks] = await Promise.all([
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
                        contentHash: true,
                    },
                }),
            ]);

            const isEntryCurrent = existingEntry?.contentHash === contentHash;
            const isChunkSetCurrent = existingChunks.length === chunkCount
                && existingChunks.every((chunk) => chunk.contentHash === contentHash);

            if (!input.force && isEntryCurrent && isChunkSetCurrent) {
                return { status: 'skipped', reason: 'Embedding already up to date for current content hash.' };
            }

            const needsEntryRefresh = input.force || !isEntryCurrent;
            const needsChunkRefresh = input.force || !isChunkSetCurrent;
            const embeddingTasks: Array<
                | { kind: 'entry'; embeddingText: string }
                | { kind: 'chunk'; chunkIndex: number; chunkText: string; embeddingText: string }
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

            const generatedEmbeddings = await this.generateEmbeddings(
                embeddingTasks.map((task) => task.embeddingText),
                'document'
            );

            const chunkVectorLiterals = new Map<number, string>();
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
                } else {
                    chunkVectorLiterals.set(task.chunkIndex, toVectorLiteral(normalized));
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

    enqueueEntryEmbedding(input: UpsertEntryEmbeddingInput) {
        if (!this.isEnabled()) return;
        setImmediate(() => {
            this.upsertEntryEmbedding(input).catch((error) => {
                console.error('Queued embedding task failed:', error);
            });
        });
    }
}

export default new EmbeddingService();
