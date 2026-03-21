CREATE TYPE "EmbeddingJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "EmbeddingJob" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "dimensions" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "EmbeddingJobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" VARCHAR(128),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmbeddingJob_entryId_model_dimensions_key"
    ON "EmbeddingJob"("entryId", "model", "dimensions");

CREATE INDEX "EmbeddingJob_status_runAfter_createdAt_idx"
    ON "EmbeddingJob"("status", "runAfter", "createdAt");

CREATE INDEX "EmbeddingJob_userId_status_runAfter_idx"
    ON "EmbeddingJob"("userId", "status", "runAfter");

CREATE INDEX "EmbeddingJob_entryId_status_idx"
    ON "EmbeddingJob"("entryId", "status");

ALTER TABLE "EmbeddingJob"
    ADD CONSTRAINT "EmbeddingJob_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmbeddingJob"
    ADD CONSTRAINT "EmbeddingJob_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
