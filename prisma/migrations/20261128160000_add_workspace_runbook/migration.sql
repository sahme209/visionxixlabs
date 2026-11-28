-- Workspace runbook library. Additive only.
CREATE TABLE "WorkspaceRunbook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceRunbook_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceRunbook_organizationId_key_key" ON "WorkspaceRunbook"("organizationId", "key");
CREATE INDEX "WorkspaceRunbook_organizationId_idx" ON "WorkspaceRunbook"("organizationId");
