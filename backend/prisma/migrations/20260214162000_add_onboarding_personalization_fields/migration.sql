ALTER TABLE "UserProfile"
ADD COLUMN "primaryGoal" TEXT,
ADD COLUMN "focusArea" TEXT,
ADD COLUMN "experienceLevel" TEXT,
ADD COLUMN "writingPreference" TEXT,
ADD COLUMN "starterPrompt" TEXT,
ADD COLUMN "outputGoals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "importPreference" TEXT,
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
