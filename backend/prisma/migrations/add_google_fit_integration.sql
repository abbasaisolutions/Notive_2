-- Google Fit Integration Migration
-- Add health tracking tables for Google Fit integration

-- CreateTable: GoogleFitConnection
CREATE TABLE IF NOT EXISTS "GoogleFitConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleFitConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable: HealthContext
CREATE TABLE IF NOT EXISTS "HealthContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sleepMinutes" INTEGER,
    "sleepQuality" TEXT,
    "steps" INTEGER,
    "activeMinutes" INTEGER,
    "caloriesBurned" INTEGER,
    "avgHeartRate" INTEGER,
    "restingHeartRate" INTEGER,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'GOOGLE_FIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable: HealthInsight
CREATE TABLE IF NOT EXISTS "HealthInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "data" JSONB,
    "period" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique user for GoogleFitConnection
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleFitConnection_userId_key" ON "GoogleFitConnection"("userId");

-- CreateIndex: Unique userId + date for HealthContext
CREATE UNIQUE INDEX IF NOT EXISTS "HealthContext_userId_date_key" ON "HealthContext"("userId", "date");

-- CreateIndex: HealthContext userId + date index for fast lookups
CREATE INDEX IF NOT EXISTS "HealthContext_userId_date_idx" ON "HealthContext"("userId", "date");

-- CreateIndex: HealthInsight userId + type index
CREATE INDEX IF NOT EXISTS "HealthInsight_userId_type_idx" ON "HealthInsight"("userId", "type");

-- AddForeignKey: GoogleFitConnection -> User
ALTER TABLE "GoogleFitConnection" ADD CONSTRAINT "GoogleFitConnection_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: HealthContext -> User
ALTER TABLE "HealthContext" ADD CONSTRAINT "HealthContext_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: HealthInsight -> User
ALTER TABLE "HealthInsight" ADD CONSTRAINT "HealthInsight_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
