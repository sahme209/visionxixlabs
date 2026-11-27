-- Hosted MCP servers a workspace added from the public registry. Additive only; no credentials stored.
CREATE TABLE "WorkspaceMcpServer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "registryName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT,
    "remoteUrl" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckAt" TIMESTAMP(3),
    "lastCheckOutcome" TEXT,
    "lastCheckDetail" TEXT,
    "toolNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "addedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMcpServer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceMcpServer_organizationId_registryName_key" ON "WorkspaceMcpServer"("organizationId", "registryName");
CREATE INDEX "WorkspaceMcpServer_organizationId_idx" ON "WorkspaceMcpServer"("organizationId");
