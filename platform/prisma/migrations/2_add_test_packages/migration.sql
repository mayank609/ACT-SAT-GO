-- Test packages: a named bundle of tests that can be assigned all at once.

CREATE TABLE IF NOT EXISTS "TestPackage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TestPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TestPackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TestPackageItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TestPackageItem_packageId_testId_key"
    ON "TestPackageItem"("packageId", "testId");

ALTER TABLE "TestPackage"
    ADD CONSTRAINT "TestPackage_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TestPackageItem"
    ADD CONSTRAINT "TestPackageItem_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "TestPackage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TestPackageItem"
    ADD CONSTRAINT "TestPackageItem_testId_fkey"
    FOREIGN KEY ("testId") REFERENCES "Test"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
