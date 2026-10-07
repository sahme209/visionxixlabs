CREATE TABLE "AgentWorkspaceMemory" (
    "organizationId" TEXT NOT NULL,
    "repositoryFullNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "environmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentWorkspaceMemory_pkey" PRIMARY KEY ("organizationId")
);
