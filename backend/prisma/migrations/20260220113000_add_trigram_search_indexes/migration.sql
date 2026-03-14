-- Phase 1: Local-first search performance improvements (FTS + trigram)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "idx_entry_title_trgm"
ON "Entry" USING GIN ("title" gin_trgm_ops)
WHERE "title" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_entry_content_trgm"
ON "Entry" USING GIN ("content" gin_trgm_ops);

COMMIT;
