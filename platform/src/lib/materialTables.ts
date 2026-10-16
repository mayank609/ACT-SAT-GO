import { prisma } from '@/lib/prisma'

// Same idempotent SQL as migration 9_add_flashcards_articles_materials. Run once per server
// process before the first study-material query, so the feature works even if
// a deploy's `prisma migrate deploy` step was skipped or failed.

const DDL = [
  `CREATE TABLE IF NOT EXISTS "StudyMaterial" (
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
)`,
  `CREATE TABLE IF NOT EXISTS "StudyMaterialShare" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "lastPage" INTEGER,
    CONSTRAINT "StudyMaterialShare_pkey" PRIMARY KEY ("id")
)`,
  `CREATE INDEX IF NOT EXISTS "StudyMaterial_createdById_idx" ON "StudyMaterial"("createdById")`,
  `CREATE INDEX IF NOT EXISTS "StudyMaterialShare_userId_idx" ON "StudyMaterialShare"("userId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StudyMaterialShare_materialId_userId_key" ON "StudyMaterialShare"("materialId", "userId")`,
  `DO $$ BEGIN
  ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "StudyMaterialShare" ADD CONSTRAINT "StudyMaterialShare_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StudyMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
  `DO $$ BEGIN
  ALTER TABLE "StudyMaterialShare" ADD CONSTRAINT "StudyMaterialShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$`,
]

let ready: Promise<void> | null = null

export function ensureMaterialTables(): Promise<void> {
  ready ??= (async () => {
    const rows = await prisma.$queryRawUnsafe<{ t: string | null }[]>(
      `SELECT to_regclass('public."StudyMaterialShare"')::text AS t`,
    )
    if (rows[0]?.t) return
    console.warn('[materials] tables missing (migration 9 not applied) — creating them')
    for (const sql of DDL) await prisma.$executeRawUnsafe(sql)
  })().catch((err) => {
    ready = null // retry on the next request
    console.error('[materials] could not ensure tables:', err)
  })
  return ready
}
