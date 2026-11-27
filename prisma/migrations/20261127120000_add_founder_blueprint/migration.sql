-- Founder operations blueprint: one company-wide document of departments, steps and links,
-- plus a history of every saved version. Founder-only; not tenant data. Additive only.
CREATE TABLE "FounderBlueprint" (
    "id" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FounderBlueprint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FounderBlueprintRevision" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "savedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FounderBlueprintRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FounderBlueprintRevision_blueprintId_version_key" ON "FounderBlueprintRevision"("blueprintId", "version");
