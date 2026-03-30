-- Create DeviceToken table
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" VARCHAR(32) NOT NULL,
    "deviceId" VARCHAR(255),
    "deviceName" VARCHAR(255),
    "appVersion" VARCHAR(32),
    "osVersion" VARCHAR(32),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Create unique index on userId and token
CREATE UNIQUE INDEX "DeviceToken_userId_token_key" ON "DeviceToken"("userId", "token");

-- Create index for platform queries
CREATE INDEX "DeviceToken_userId_platform_isActive_idx" ON "DeviceToken"("userId", "platform", "isActive");

-- Create index for lastUsedAt queries
CREATE INDEX "DeviceToken_userId_lastUsedAt_idx" ON "DeviceToken"("userId", "lastUsedAt");
