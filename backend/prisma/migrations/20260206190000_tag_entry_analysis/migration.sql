-- Migration: Tag normalization + Entry analysis + FTS vector
-- File: backend/prisma/migrations/20260206190000_tag_entry_analysis/migration.sql

BEGIN;

-- Enums
DO $$ BEGIN
    CREATE TYPE "TagSource" AS ENUM ('USER', 'AI', 'NLP', 'IMPORT', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "AnalysisSource" AS ENUM ('DETERMINISTIC', 'NLP', 'AI', 'IMPORT');
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Tag table
CREATE TABLE IF NOT EXISTS "Tag" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    normalized TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Tag_normalized_idx" ON "Tag" (normalized);

-- EntryTag join
CREATE TABLE IF NOT EXISTS "EntryTag" (
    id TEXT PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    source "TagSource" NOT NULL DEFAULT 'USER',
    confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryTag_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"(id) ON DELETE CASCADE,
    CONSTRAINT "EntryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"(id) ON DELETE CASCADE,
    CONSTRAINT "EntryTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EntryTag_entryId_tagId_key" ON "EntryTag" ("entryId", "tagId");
CREATE INDEX IF NOT EXISTS "EntryTag_userId_createdAt_idx" ON "EntryTag" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EntryTag_tagId_idx" ON "EntryTag" ("tagId");

-- EntryAnalysis
CREATE TABLE IF NOT EXISTS "EntryAnalysis" (
    id TEXT PRIMARY KEY,
    "entryId" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    source "AnalysisSource" NOT NULL DEFAULT 'NLP',
    "contentHash" TEXT,
    summary TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "sentimentLabel" TEXT,
    emotions JSONB,
    entities JSONB,
    topics TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "suggestedMood" TEXT,
    "wordCount" INTEGER,
    "readingTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntryAnalysis_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"(id) ON DELETE CASCADE,
    CONSTRAINT "EntryAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "EntryAnalysis_userId_updatedAt_idx" ON "EntryAnalysis" ("userId", "updatedAt");

-- Full-text vector column + index
ALTER TABLE "Entry" 
    ADD COLUMN IF NOT EXISTS "content_vector" tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english', coalesce("title", '') || ' ' || "content")
    ) STORED;

CREATE INDEX IF NOT EXISTS "idx_entry_content_vector" ON "Entry" USING GIN ("content_vector");
CREATE INDEX IF NOT EXISTS "idx_entry_user_created" ON "Entry" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_entry_mood" ON "Entry" (mood) WHERE mood IS NOT NULL;

COMMIT;
