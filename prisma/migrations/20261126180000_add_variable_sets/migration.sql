-- Variable sets: named groups of configuration variables attached to environments by tag selector.
-- Additive only: a new table; existing ConfigVariable rows and their resolution are unchanged.
CREATE TABLE "VariableSet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariableSet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VariableSet_organizationId_slug_key" ON "VariableSet"("organizationId", "slug");
CREATE INDEX "VariableSet_organizationId_idx" ON "VariableSet"("organizationId");
