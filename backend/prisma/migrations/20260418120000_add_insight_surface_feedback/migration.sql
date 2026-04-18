-- CreateTable
CREATE TABLE "InsightSurfaceFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "surfaceType" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightSurfaceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InsightSurfaceFeedback_userId_surfaceType_entityKey_key"
    ON "InsightSurfaceFeedback"("userId", "surfaceType", "entityKey");

-- CreateIndex
CREATE INDEX "InsightSurfaceFeedback_userId_surfaceType_createdAt_idx"
    ON "InsightSurfaceFeedback"("userId", "surfaceType", "createdAt");

-- AddForeignKey
ALTER TABLE "InsightSurfaceFeedback" ADD CONSTRAINT "InsightSurfaceFeedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
