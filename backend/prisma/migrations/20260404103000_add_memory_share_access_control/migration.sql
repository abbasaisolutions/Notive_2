-- CreateEnum
CREATE TYPE "MemoryShareAccessStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "SharedMemoryRecipient"
ADD COLUMN "status" "MemoryShareAccessStatus" NOT NULL DEFAULT 'ACCEPTED';

-- CreateTable
CREATE TABLE "MemoryShareAccess" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "MemoryShareAccessStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryShareAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemoryShareAccess_senderId_recipientId_key" ON "MemoryShareAccess"("senderId", "recipientId");

-- CreateIndex
CREATE INDEX "MemoryShareAccess_recipientId_status_updatedAt_idx" ON "MemoryShareAccess"("recipientId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "MemoryShareAccess_senderId_status_updatedAt_idx" ON "MemoryShareAccess"("senderId", "status", "updatedAt");

-- Redefine SharedMemoryRecipient indexes
DROP INDEX "SharedMemoryRecipient_recipientId_createdAt_idx";
CREATE INDEX "SharedMemoryRecipient_recipientId_status_createdAt_idx" ON "SharedMemoryRecipient"("recipientId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "MemoryShareAccess"
ADD CONSTRAINT "MemoryShareAccess_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryShareAccess"
ADD CONSTRAINT "MemoryShareAccess_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
