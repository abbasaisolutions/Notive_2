BEGIN;

DROP INDEX IF EXISTS "EntryEmbedding_embedding_hnsw_idx";

ALTER TABLE "EntryEmbedding"
    ALTER COLUMN dimensions DROP DEFAULT,
    ALTER COLUMN embedding TYPE vector USING embedding::vector;

CREATE INDEX IF NOT EXISTS "EntryEmbedding_embedding_384_hnsw_idx"
ON "EntryEmbedding"
USING hnsw ((embedding::vector(384)) vector_cosine_ops)
WHERE dimensions = 384;

CREATE INDEX IF NOT EXISTS "EntryEmbedding_embedding_1536_hnsw_idx"
ON "EntryEmbedding"
USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
WHERE dimensions = 1536;

COMMIT;
