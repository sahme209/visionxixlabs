-- Release autopilot per workspace, set only by an applied two-person policy change. Additive only.
CREATE TABLE "WorkspaceReleaseAutopilot" (
    "organizationId" TEXT NOT NULL,
    "deployEnvironments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxFiles" INTEGER NOT NULL DEFAULT 0,
    "appliedRequestId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceReleaseAutopilot_pkey" PRIMARY KEY ("organizationId")
);
