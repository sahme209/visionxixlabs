-- CreateTable
CREATE TABLE "TenantAutonomyCharter" (
    "organizationId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "perCycleActionLimit" INTEGER,
    "rationale" TEXT,
    "slackWebhookOverride" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAutonomyCharter_pkey" PRIMARY KEY ("organizationId")
);
