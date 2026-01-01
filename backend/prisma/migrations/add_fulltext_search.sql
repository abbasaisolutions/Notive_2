-- Migration: Add Full-Text Search and Performance Indexes
-- File: backend/prisma/migrations/add_fulltext_search/migration.sql

BEGIN;

-- 1. Add tsvector column for full-text search
ALTER TABLE "Entry" 
ADD COLUMN IF NOT EXISTS content_vector tsvector 
GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(title, '') || ' ' || content)
) STORED;

-- 2. Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_entry_content_vector 
ON "Entry" USING GIN (content_vector);

-- 3. Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_entry_user_created 
ON "Entry" (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entry_mood 
ON "Entry" (mood) WHERE mood IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entry_source 
ON "Entry" (source) WHERE source IS NOT NULL;

-- 4. Index for tag searches
CREATE INDEX IF NOT EXISTS idx_entry_tags_entry 
ON "_EntryToTag" (A);

CREATE INDEX IF NOT EXISTS idx_entry_tags_tag 
ON "_EntryToTag" (B);

-- 5. Add source field if not exists (for social media tracking)
ALTER TABLE "Entry" 
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';

ALTER TABLE "Entry" 
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

-- Unique constraint to prevent duplicate imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_external_unique 
ON "Entry" (user_id, source, external_id) 
WHERE external_id IS NOT NULL;

-- 6. Create analytics cache table for performance
CREATE TABLE IF NOT EXISTS analytics_cache (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  period VARCHAR(10) NOT NULL,
  data JSONB NOT NULL,
  computed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_period UNIQUE (user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_computed 
ON analytics_cache (computed_at);

-- 7. Create function for smart search with relevance ranking
CREATE OR REPLACE FUNCTION search_entries(
  p_user_id TEXT,
  p_query TEXT,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  id TEXT,
  title TEXT,
  content TEXT,
  mood TEXT,
  created_at TIMESTAMP,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.content,
    e.mood,
    e."createdAt" as created_at,
    ts_rank(e.content_vector, websearch_to_tsquery('english', p_query))::REAL AS relevance
  FROM "Entry" e
  WHERE 
    e.user_id = p_user_id
    AND e.content_vector @@ websearch_to_tsquery('english', p_query)
  ORDER BY relevance DESC, e."createdAt" DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Usage example:
-- SELECT * FROM search_entries('user-id-here', 'happy memories', 10);
