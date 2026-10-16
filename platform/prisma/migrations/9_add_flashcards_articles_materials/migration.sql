-- Phase 2 content features, in one migration: flashcards, articles (with
-- summaries as proof of reading) and protected study materials.
-- Every statement is idempotent (IF NOT EXISTS / duplicate_object), so it is
-- safe if the runtime ensure-tables helpers already created these tables.

-- ════════ from 7_add_flashcards ════════
-- Flashcards: tutor-made decks (topic + info + front/back cards) shared with students.
-- Idempotent (IF NOT EXISTS) so it is safe if the tables were already created at runtime.

CREATE TABLE IF NOT EXISTS "FlashcardDeck" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FlashcardDeck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FlashcardCard" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    CONSTRAINT "FlashcardCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FlashcardShare" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "lastStudiedAt" TIMESTAMP(3),
    "knownCardIds" JSONB,
    CONSTRAINT "FlashcardShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FlashcardDeck_createdById_idx" ON "FlashcardDeck"("createdById");

CREATE INDEX IF NOT EXISTS "FlashcardCard_deckId_idx" ON "FlashcardCard"("deckId");

CREATE INDEX IF NOT EXISTS "FlashcardShare_studentId_idx" ON "FlashcardShare"("studentId");

CREATE UNIQUE INDEX IF NOT EXISTS "FlashcardShare_deckId_studentId_key" ON "FlashcardShare"("deckId", "studentId");

DO $$ BEGIN
  ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FlashcardShare" ADD CONSTRAINT "FlashcardShare_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FlashcardShare" ADD CONSTRAINT "FlashcardShare_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════ from 8_add_articles ════════
-- Articles: tutor-assigned reading with a student summary as proof of reading.
-- Idempotent (IF NOT EXISTS) so it is safe if the tables were already created at runtime.

CREATE TABLE IF NOT EXISTS "Article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "minSummaryWords" INTEGER NOT NULL DEFAULT 50,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ArticleAssignment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "status" VARCHAR(16) NOT NULL DEFAULT 'ASSIGNED',
    "summary" TEXT,
    "summaryWordCount" INTEGER NOT NULL DEFAULT 0,
    "copiedRatio" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3),
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    CONSTRAINT "ArticleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Article_createdById_idx" ON "Article"("createdById");

CREATE INDEX IF NOT EXISTS "ArticleAssignment_studentId_idx" ON "ArticleAssignment"("studentId");

CREATE UNIQUE INDEX IF NOT EXISTS "ArticleAssignment_articleId_studentId_key" ON "ArticleAssignment"("articleId", "studentId");

DO $$ BEGIN
  ALTER TABLE "Article" ADD CONSTRAINT "Article_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ArticleAssignment" ADD CONSTRAINT "ArticleAssignment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ArticleAssignment" ADD CONSTRAINT "ArticleAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ArticleAssignment" ADD CONSTRAINT "ArticleAssignment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ════════ from 9_add_study_materials ════════
-- Protected study materials: view-only PDFs shared by tutors/admins.
-- Idempotent (IF NOT EXISTS) so it is safe if the tables were already created at runtime.

CREATE TABLE IF NOT EXISTS "StudyMaterial" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "pageSizes" JSONB NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudyMaterial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StudyMaterialShare" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "lastPage" INTEGER,
    CONSTRAINT "StudyMaterialShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudyMaterial_createdById_idx" ON "StudyMaterial"("createdById");

CREATE INDEX IF NOT EXISTS "StudyMaterialShare_userId_idx" ON "StudyMaterialShare"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "StudyMaterialShare_materialId_userId_key" ON "StudyMaterialShare"("materialId", "userId");

DO $$ BEGIN
  ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudyMaterialShare" ADD CONSTRAINT "StudyMaterialShare_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StudyMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudyMaterialShare" ADD CONSTRAINT "StudyMaterialShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

