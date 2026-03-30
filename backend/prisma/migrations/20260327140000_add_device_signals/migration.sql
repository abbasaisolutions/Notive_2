-- AlterTable: Add location fields to Entry
ALTER TABLE "Entry" ADD COLUMN "locationLat" DOUBLE PRECISION;
ALTER TABLE "Entry" ADD COLUMN "locationLng" DOUBLE PRECISION;
ALTER TABLE "Entry" ADD COLUMN "locationName" VARCHAR(200);

-- CreateTable: DeviceSignal
CREATE TABLE "DeviceSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "signalType" VARCHAR(40) NOT NULL,
    "data" JSONB NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SpotifyConnection
CREATE TABLE "SpotifyConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "displayName" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpotifyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSignal_userId_date_signalType_key" ON "DeviceSignal"("userId", "date", "signalType");
CREATE INDEX "DeviceSignal_userId_date_idx" ON "DeviceSignal"("userId", "date");
CREATE INDEX "DeviceSignal_userId_signalType_date_idx" ON "DeviceSignal"("userId", "signalType", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SpotifyConnection_userId_key" ON "SpotifyConnection"("userId");

-- AddForeignKey
ALTER TABLE "DeviceSignal" ADD CONSTRAINT "DeviceSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpotifyConnection" ADD CONSTRAINT "SpotifyConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
