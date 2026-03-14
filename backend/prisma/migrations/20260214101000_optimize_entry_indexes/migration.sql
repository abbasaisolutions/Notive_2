-- Optimize common Entry access paths:
-- - timeline/list filters by user + deletedAt + createdAt
-- - social import duplicate checks by user + source + externalId
-- - chapter and mood analytics slices by user + createdAt

CREATE INDEX IF NOT EXISTS "Entry_userId_deletedAt_createdAt_idx"
ON "Entry"("userId", "deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "Entry_userId_source_externalId_idx"
ON "Entry"("userId", "source", "externalId");

CREATE INDEX IF NOT EXISTS "Entry_userId_chapterId_createdAt_idx"
ON "Entry"("userId", "chapterId", "createdAt");

CREATE INDEX IF NOT EXISTS "Entry_userId_mood_createdAt_idx"
ON "Entry"("userId", "mood", "createdAt");
