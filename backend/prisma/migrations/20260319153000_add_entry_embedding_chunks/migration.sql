BEGIN;

CREATE TABLE "EntryEmbeddingChunk" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    dimensions INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "chunkCount" INTEGER NOT NULL,
    "chunkText" TEXT NOT NULL,
    embedding vector NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryEmbeddingChunk_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EntryEmbeddingChunk_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryEmbeddingChunk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EntryEmbeddingChunk_entryId_chunkIndex_model_dimensions_key"
ON "EntryEmbeddingChunk"("entryId", "chunkIndex", model, dimensions);

CREATE INDEX "EntryEmbeddingChunk_entryId_model_dimensions_idx"
ON "EntryEmbeddingChunk"("entryId", model, dimensions);

CREATE INDEX "EntryEmbeddingChunk_userId_model_dimensions_idx"
ON "EntryEmbeddingChunk"("userId", model, dimensions);

CREATE INDEX "EntryEmbeddingChunk_userId_updatedAt_idx"
ON "EntryEmbeddingChunk"("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "EntryEmbeddingChunk_embedding_384_hnsw_idx"
ON "EntryEmbeddingChunk"
USING hnsw ((embedding::vector(384)) vector_cosine_ops)
WHERE dimensions = 384;

CREATE INDEX IF NOT EXISTS "EntryEmbeddingChunk_embedding_1536_hnsw_idx"
ON "EntryEmbeddingChunk"
USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
WHERE dimensions = 1536;

COMMIT;
