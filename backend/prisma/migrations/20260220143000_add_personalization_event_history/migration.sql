BEGIN;

CREATE TABLE IF NOT EXISTS "PersonalizationEvent" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "eventType" TEXT NOT NULL,
    "questionId" TEXT,
    "field" TEXT,
    value TEXT,
    pathname TEXT,
    metadata JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonalizationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
    CONSTRAINT "PersonalizationEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "PersonalizationEvent_userId_fingerprint_key"
ON "PersonalizationEvent" ("userId", fingerprint);

CREATE INDEX IF NOT EXISTS "PersonalizationEvent_userId_occurredAt_idx"
ON "PersonalizationEvent" ("userId", "occurredAt");

CREATE INDEX IF NOT EXISTS "PersonalizationEvent_userId_eventType_occurredAt_idx"
ON "PersonalizationEvent" ("userId", "eventType", "occurredAt");

COMMIT;
