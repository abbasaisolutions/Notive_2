ALTER TABLE "Entry"
ADD COLUMN "lifeArea" VARCHAR(64);

CREATE INDEX "Entry_userId_lifeArea_createdAt_idx"
ON "Entry"("userId", "lifeArea", "createdAt");
