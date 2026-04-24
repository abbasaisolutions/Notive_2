-- AlterTable
ALTER TABLE "RefreshToken"
    ADD COLUMN "revokedAt" TIMESTAMP(3),
    ADD COLUMN "revokedReason" TEXT,
    ADD COLUMN "replacedById" TEXT;

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx"
    ON "RefreshToken"("userId", "revokedAt");
