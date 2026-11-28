-- Workspace custom roles: built-in roles with capabilities removed. Additive only.
ALTER TABLE "OrgMembership" ADD COLUMN "customRoleId" TEXT;

CREATE TABLE "WorkspaceCustomRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "removedCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceCustomRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceCustomRole_organizationId_name_key" ON "WorkspaceCustomRole"("organizationId", "name");
CREATE INDEX "WorkspaceCustomRole_organizationId_idx" ON "WorkspaceCustomRole"("organizationId");
