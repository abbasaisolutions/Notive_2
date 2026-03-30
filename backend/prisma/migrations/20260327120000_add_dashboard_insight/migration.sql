-- CreateTable
CREATE TABLE "DashboardInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "evidence" TEXT,
    "entryIds" TEXT[],
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "userReaction" TEXT,
    "llmModel" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardInsight_userId_category_generatedAt_idx" ON "DashboardInsight"("userId", "category", "generatedAt");

-- CreateIndex
CREATE INDEX "DashboardInsight_userId_expiresAt_idx" ON "DashboardInsight"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "DashboardInsight" ADD CONSTRAINT "DashboardInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
