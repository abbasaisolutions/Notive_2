import crypto from 'crypto';
import { aiRuntime, createEmbedding, hasEmbeddingProvider } from '../config/ai';
import prisma from '../config/prisma';

type UpsertEntryEmbeddingInput = {
    entryId: string;
    userId: string;
    content: string;
    title?: string | null;
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

const SCHEMA_EMBEDDING_DIMS = 1536;
const configuredDims = parsePositiveInt(process.env.EMBEDDING_DIMS, SCHEMA_EMBEDDING_DIMS);
const EMBEDDING_DIMS = configuredDims === SCHEMA_EMBEDDING_DIMS ? configuredDims : SCHEMA_EMBEDDING_DIMS;

const embeddingProvider = aiRuntime.embeddingVendor;

const OPENAI_EMBEDDING_MODEL = aiRuntime.embeddingModel;
const LOCAL_EMBEDDING_MODEL = 'local-hash-v1';
const ACTIVE_EMBEDDING_MODEL = embeddingProvider === 'openai' ? OPENAI_EMBEDDING_MODEL : LOCAL_EMBEDDING_MODEL;

const USE_EMBEDDINGS = process.env.USE_EMBEDDINGS === 'true';

const buildEmbeddingText = (content: string, title?: string | null) => {
    const safeContent = String(content || '').trim();
    const safeTitle = typeof title === 'string' ? title.trim() : '';
    if (!safeTitle) return safeContent;
    return `Title: ${safeTitle}\n\n${safeContent}`;
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
        if (embeddingProvider === 'openai') return hasEmbeddingProvider();
        return true;
    }

    private async generateEmbedding(embeddingText: string): Promise<number[] | null> {
        if (embeddingProvider === 'openai') {
            const response = await createEmbedding({
                model: OPENAI_EMBEDDING_MODEL,
                input: embeddingText,
                dimensions: EMBEDDING_DIMS,
            });
            if (!response) return null;
            const rawEmbedding = response.data?.[0]?.embedding;
            if (!Array.isArray(rawEmbedding) || rawEmbedding.length !== EMBEDDING_DIMS) {
                return null;
            }
            return normalizeVector(rawEmbedding.map((value) => Number(value)));
        }

        return localHashEmbedding(embeddingText, EMBEDDING_DIMS);
    }

    async upsertEntryEmbedding(input: UpsertEntryEmbeddingInput): Promise<UpsertEntryEmbeddingResult> {
        if (!this.isEnabled()) {
            return { status: 'disabled', reason: 'Embeddings are disabled by configuration.' };
        }

        const embeddingText = buildEmbeddingText(input.content, input.title);
        if (embeddingText.length < 5) {
            return { status: 'skipped', reason: 'Content too short for embedding.' };
        }

        const contentHash = hashText(embeddingText);

        try {
            const existing = await prisma.$queryRaw<Array<{ id: string; contentHash: string }>>`
                SELECT id, "contentHash" as "contentHash"
                FROM "EntryEmbedding"
                WHERE "entryId" = ${input.entryId}
                    AND model = ${ACTIVE_EMBEDDING_MODEL}
                    AND dimensions = ${EMBEDDING_DIMS}
                LIMIT 1
            `;

            if (!input.force && existing[0]?.contentHash === contentHash) {
                return { status: 'skipped', reason: 'Embedding already up to date for current content hash.' };
            }

            const normalized = await this.generateEmbedding(embeddingText);
            if (!normalized || normalized.length === 0) {
                return { status: 'failed', reason: 'Embedding API returned an empty vector.' };
            }

            if (normalized.length !== EMBEDDING_DIMS) {
                return {
                    status: 'failed',
                    reason: `Embedding dimension mismatch. Expected ${EMBEDDING_DIMS}, received ${normalized.length}.`,
                };
            }
            const vectorLiteral = toVectorLiteral(normalized);
            const recordId = existing[0]?.id || crypto.randomUUID();

            await prisma.$executeRawUnsafe(
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
                vectorLiteral
            );

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
