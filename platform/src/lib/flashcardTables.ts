import { prisma } from '@/lib/prisma'

// Same idempotent SQL as migration 9_add_flashcards_articles_materials. Run once per server
// process before the first flashcard query, so the feature works even if a
// deploy's `prisma migrate deploy` step was skipped or failed.

const DDL = [
  `CREATE TABLE IF NOT EXISTS "FlashcardDeck" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FlashcardDeck_pkey" PRIMARY KEY ("id")
)`,
  `CREATE TABLE IF NOT EXISTS "FlashcardCard" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "FlashcardCard_pkey" PRIMARY KEY ("id")
)`,
  `CREATE TABLE IF NOT EXISTS "FlashcardShare" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "lastStudiedAt" TIMESTAMP(3),
    "knownCardIds" JSONB,
    CONSTRAINT "FlashcardShare_pkey" PRIMARY KEY ("id")
)`,
  `CREATE INDEX IF NOT EXISTS "FlashcardDeck_createdById_idx" ON "FlashcardDeck"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "FlashcardCard_deckId_idx" ON "FlashcardCard"("deckId")`,
  `CREATE INDEX IF NOT EXISTS "FlashcardShare_studentId_idx" ON "FlashcardShare"("studentId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "FlashcardShare_deckId_studentId_key" ON "FlashcardShare"("deckId", "studentId")`,
  `DO $$ BEGIN
  ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "FlashcardShare" ADD CONSTRAINT "FlashcardShare_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "FlashcardShare" ADD CONSTRAINT "FlashcardShare_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
]

// Same as migration 10_article_ai_feedback_flashcard_hints.
const COLUMNS = [
  `ALTER TABLE "FlashcardCard" ADD COLUMN IF NOT EXISTS "hint" TEXT`,
  `ALTER TABLE "FlashcardCard" ADD COLUMN IF NOT EXISTS "example" TEXT`,
  `ALTER TABLE "FlashcardShare" ADD COLUMN IF NOT EXISTS "seenCardIds" JSONB`,
]

let ready: Promise<void> | null = null

export function ensureFlashcardTables(): Promise<void> {
  ready ??= (async () => {
    const rows = await prisma.$queryRawUnsafe<{ t: string | null }[]>(
      `SELECT to_regclass('public."FlashcardShare"')::text AS t`,
    )
    if (!rows[0]?.t) {
      console.warn('[flashcards] tables missing (migration 9 not applied) — creating them')
      for (const sql of DDL) await prisma.$executeRawUnsafe(sql)
    }
    // Columns added later (migration 10). Cheap no-ops once they exist.
    for (const sql of COLUMNS) await prisma.$executeRawUnsafe(sql)
  })().catch((err) => {
    ready = null // retry on the next request
    console.error('[flashcards] could not ensure tables:', err)
  })
  return ready
}
