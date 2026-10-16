-- Articles: optional instructions, and every submitted summary with its AI
-- feedback. Flashcards: optional hint + example per card, and which cards a
-- student has seen.
-- Idempotent (IF EXISTS / IF NOT EXISTS): the runtime helpers in
-- lib/articleTables.ts and lib/flashcardTables.ts add the same columns, so
-- this is safe whether they ran first or not.

ALTER TABLE IF EXISTS "Article" ADD COLUMN IF NOT EXISTS "instructions" TEXT;
ALTER TABLE IF EXISTS "ArticleAssignment" ADD COLUMN IF NOT EXISTS "submissions" JSONB;
ALTER TABLE IF EXISTS "FlashcardCard" ADD COLUMN IF NOT EXISTS "hint" TEXT;
ALTER TABLE IF EXISTS "FlashcardCard" ADD COLUMN IF NOT EXISTS "example" TEXT;
ALTER TABLE IF EXISTS "FlashcardShare" ADD COLUMN IF NOT EXISTS "seenCardIds" JSONB;
