-- Additive only: environment-scoped configuration variables.
CREATE TABLE "ConfigVariable" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "environmentId" TEXT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConfigVariable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfigVariable_organizationId_scopeKey_key_key" ON "ConfigVariable"("organizationId", "scopeKey", "key");
CREATE INDEX "ConfigVariable_organizationId_idx" ON "ConfigVariable"("organizationId");
