BEGIN;

CREATE INDEX IF NOT EXISTS "EntryEmbedding_embedding_768_hnsw_idx"
ON "EntryEmbedding"
USING hnsw ((embedding::vector(768)) vector_cosine_ops)
WHERE dimensions = 768;

CREATE INDEX IF NOT EXISTS "EntryEmbeddingChunk_embedding_768_hnsw_idx"
ON "EntryEmbeddingChunk"
USING hnsw ((embedding::vector(768)) vector_cosine_ops)
WHERE dimensions = 768;

COMMIT;
