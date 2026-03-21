BEGIN;

CREATE TABLE "EntryEmbeddingFacet" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    dimensions INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "facetType" TEXT NOT NULL,
    "facetKey" TEXT NOT NULL,
    "facetText" TEXT NOT NULL,
    embedding vector NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryEmbeddingFacet_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EntryEmbeddingFacet_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryEmbeddingFacet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EntryEmbeddingFacet_entryId_facetType_facetKey_model_dimensions_key"
ON "EntryEmbeddingFacet"("entryId", "facetType", "facetKey", model, dimensions);

CREATE INDEX "EntryEmbeddingFacet_entryId_model_dimensions_idx"
ON "EntryEmbeddingFacet"("entryId", model, dimensions);

CREATE INDEX "EntryEmbeddingFacet_userId_model_dimensions_idx"
ON "EntryEmbeddingFacet"("userId", model, dimensions);

CREATE INDEX "EntryEmbeddingFacet_userId_facetType_model_dimensions_idx"
ON "EntryEmbeddingFacet"("userId", "facetType", model, dimensions);

CREATE INDEX "EntryEmbeddingFacet_userId_updatedAt_idx"
ON "EntryEmbeddingFacet"("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "EntryEmbeddingFacet_embedding_384_hnsw_idx"
ON "EntryEmbeddingFacet"
USING hnsw ((embedding::vector(384)) vector_cosine_ops)
WHERE dimensions = 384;

CREATE INDEX IF NOT EXISTS "EntryEmbeddingFacet_embedding_768_hnsw_idx"
ON "EntryEmbeddingFacet"
USING hnsw ((embedding::vector(768)) vector_cosine_ops)
WHERE dimensions = 768;

CREATE INDEX IF NOT EXISTS "EntryEmbeddingFacet_embedding_1536_hnsw_idx"
ON "EntryEmbeddingFacet"
USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
WHERE dimensions = 1536;

COMMIT;
