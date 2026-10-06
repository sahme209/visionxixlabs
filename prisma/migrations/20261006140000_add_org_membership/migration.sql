-- OrgMembership has been defined in schema.prisma for a long time (role
-- gating throughout the app — isTenantAdmin, isAdminOrOwner,
-- resolveWorkspaceRoles, the personal-workspace bootstrap, every
-- isAdminOrOwner-gated route added this session) but no migration ever
-- created the table or its OrgRole enum. Production has been running
-- with this table entirely absent (Prisma error P2021), which silently
-- fails every role lookup closed to zero roles rather than crashing —
-- explaining why this went unnoticed: basic sign-in and browsing still
-- worked, but anything requiring owner/admin role (desktop
-- deployment-request access, GitHub App creation, connector toggles,
-- AI policy changes) has been unconditionally denied for every user on
-- every workspace since this database's first deployment.

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'operator', 'security_reviewer', 'finance_viewer', 'read_only');

-- CreateTable
CREATE TABLE "OrgMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'read_only',
    "providerScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "invitedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrgMembership_userId_organizationId_key" ON "OrgMembership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "OrgMembership_organizationId_idx" ON "OrgMembership"("organizationId");

-- CreateIndex
CREATE INDEX "OrgMembership_userId_idx" ON "OrgMembership"("userId");
