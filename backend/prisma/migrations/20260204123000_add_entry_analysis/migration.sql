-- Add analysis JSON column to Entry
ALTER TABLE "Entry"
ADD COLUMN IF NOT EXISTS "analysis" JSONB;
