-- CreateEnum
CREATE TYPE "SharedBundleStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "Entry" DROP COLUMN IF EXISTS "audioUrl";

-- AlterTable
ALTER TABLE "VoiceTranscriptionJob" DROP COLUMN IF EXISTS "audioUrl";

-- CreateTable
CREATE TABLE "SharedMemoryBundle" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT,
    "status" "SharedBundleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedMemoryBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedMemoryItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "snapshotTitle" TEXT,
    "snapshotContent" TEXT NOT NULL,
    "snapshotMood" TEXT,
    "snapshotTags" TEXT[],
    "snapshotCoverImage" TEXT,
    "snapshotCreatedAt" TIMESTAMP(3) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedMemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedMemoryRecipient" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "reaction" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedMemoryRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedMemoryBundle_senderId_createdAt_idx" ON "SharedMemoryBundle"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "SharedMemoryItem_bundleId_sortOrder_idx" ON "SharedMemoryItem"("bundleId", "sortOrder");

-- CreateIndex
CREATE INDEX "SharedMemoryItem_entryId_idx" ON "SharedMemoryItem"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedMemoryItem_bundleId_entryId_key" ON "SharedMemoryItem"("bundleId", "entryId");

-- CreateIndex
CREATE INDEX "SharedMemoryRecipient_recipientId_createdAt_idx" ON "SharedMemoryRecipient"("recipientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SharedMemoryRecipient_bundleId_recipientId_key" ON "SharedMemoryRecipient"("bundleId", "recipientId");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_readAt_createdAt_idx" ON "InAppNotification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_type_createdAt_idx" ON "InAppNotification"("userId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "SharedMemoryBundle" ADD CONSTRAINT "SharedMemoryBundle_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedMemoryItem" ADD CONSTRAINT "SharedMemoryItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "SharedMemoryBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedMemoryItem" ADD CONSTRAINT "SharedMemoryItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedMemoryRecipient" ADD CONSTRAINT "SharedMemoryRecipient_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "SharedMemoryBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedMemoryRecipient" ADD CONSTRAINT "SharedMemoryRecipient_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
