-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('PERSONAL', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('NOTIVE', 'FACEBOOK', 'INSTAGRAM');

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "category" "Category" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "isShared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lessons" TEXT[],
ADD COLUMN     "reflection" TEXT,
ADD COLUMN     "sharedToken" TEXT,
ADD COLUMN     "skills" TEXT[],
ADD COLUMN     "source" "EntrySource" NOT NULL DEFAULT 'NOTIVE',
ADD COLUMN     "sourceLink" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER',
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "location" TEXT,
    "occupation" TEXT,
    "website" TEXT,
    "birthDate" TIMESTAMP(3),
    "lifeGoals" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_sharedToken_key" ON "Entry"("sharedToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

