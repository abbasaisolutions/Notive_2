CREATE TYPE "VoiceTranscriptionJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED');

CREATE TABLE "VoiceTranscriptionJob" (
    "id" TEXT NOT NULL,
    "entryId" TEXT,
    "userId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "fileName" VARCHAR(255),
    "mimeType" VARCHAR(80) NOT NULL,
    "languageMode" VARCHAR(32) NOT NULL,
    "candidateLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "recordingDurationMs" INTEGER,
    "hintText" TEXT,
    "entryContext" TEXT,
    "payload" JSONB NOT NULL,
    "transcript" JSONB,
    "captureMeta" JSONB,
    "status" "VoiceTranscriptionJobStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(64),
    "model" VARCHAR(128),
    "detectedLanguage" VARCHAR(32),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedBy" VARCHAR(128),
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoiceTranscriptionJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoiceLexiconItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canonical" VARCHAR(120) NOT NULL,
    "normalized" VARCHAR(120) NOT NULL,
    "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "locale" VARCHAR(32),
    "itemType" VARCHAR(40),
    "boost" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoiceLexiconItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VoiceLexiconItem_userId_normalized_key" ON "VoiceLexiconItem"("userId", "normalized");
CREATE INDEX "VoiceTranscriptionJob_status_runAfter_createdAt_idx" ON "VoiceTranscriptionJob"("status", "runAfter", "createdAt");
CREATE INDEX "VoiceTranscriptionJob_userId_status_createdAt_idx" ON "VoiceTranscriptionJob"("userId", "status", "createdAt");
CREATE INDEX "VoiceTranscriptionJob_entryId_createdAt_idx" ON "VoiceTranscriptionJob"("entryId", "createdAt");
CREATE INDEX "VoiceLexiconItem_userId_locale_usageCount_idx" ON "VoiceLexiconItem"("userId", "locale", "usageCount");
CREATE INDEX "VoiceLexiconItem_userId_updatedAt_idx" ON "VoiceLexiconItem"("userId", "updatedAt");

ALTER TABLE "VoiceTranscriptionJob"
    ADD CONSTRAINT "VoiceTranscriptionJob_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VoiceTranscriptionJob"
    ADD CONSTRAINT "VoiceTranscriptionJob_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VoiceLexiconItem"
    ADD CONSTRAINT "VoiceLexiconItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
