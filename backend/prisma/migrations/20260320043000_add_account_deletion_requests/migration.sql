CREATE TYPE "AccountDeletionRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'DISMISSED');

CREATE TABLE "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" VARCHAR(320) NOT NULL,
    "reason" TEXT,
    "status" "AccountDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedVia" TEXT NOT NULL DEFAULT 'WEB',
    "matchedUserId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountDeletionRequest_normalizedEmail_createdAt_idx" ON "AccountDeletionRequest"("normalizedEmail", "createdAt");
CREATE INDEX "AccountDeletionRequest_status_createdAt_idx" ON "AccountDeletionRequest"("status", "createdAt");
CREATE INDEX "AccountDeletionRequest_matchedUserId_createdAt_idx" ON "AccountDeletionRequest"("matchedUserId", "createdAt");

ALTER TABLE "AccountDeletionRequest"
ADD CONSTRAINT "AccountDeletionRequest_matchedUserId_fkey"
FOREIGN KEY ("matchedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
