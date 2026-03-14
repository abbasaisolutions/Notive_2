-- Phase 3: Entry embeddings infrastructure (pgvector)

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "EntryEmbedding" (
    id TEXT PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    dimensions INTEGER NOT NULL DEFAULT 1536,
    "contentHash" TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryEmbedding_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"(id) ON DELETE CASCADE,
    CONSTRAINT "EntryEmbedding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EntryEmbedding_entryId_model_dimensions_key"
ON "EntryEmbedding" ("entryId", model, dimensions);

CREATE INDEX IF NOT EXISTS "EntryEmbedding_userId_updatedAt_idx"
ON "EntryEmbedding" ("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "EntryEmbedding_userId_model_dimensions_idx"
ON "EntryEmbedding" ("userId", model, dimensions);

-- ANN index for cosine similarity search.
CREATE INDEX IF NOT EXISTS "EntryEmbedding_embedding_hnsw_idx"
ON "EntryEmbedding"
USING hnsw (embedding vector_cosine_ops);

COMMIT;
