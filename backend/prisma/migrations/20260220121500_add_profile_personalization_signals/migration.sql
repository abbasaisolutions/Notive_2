ALTER TABLE "UserProfile"
ADD COLUMN IF NOT EXISTS "personalizationSignals" JSONB;
