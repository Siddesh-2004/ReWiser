ALTER TABLE "questions" ADD COLUMN "context" text;
UPDATE "questions" SET "context" = '' WHERE "context" IS NULL;
ALTER TABLE "questions" ALTER COLUMN "context" SET NOT NULL;