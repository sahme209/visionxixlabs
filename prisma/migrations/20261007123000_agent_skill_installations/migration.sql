CREATE TABLE "AgentSkillInstallation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "installedByUserId" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSkillInstallation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentSkillInstallation_organizationId_skillId_key" ON "AgentSkillInstallation"("organizationId", "skillId");
CREATE INDEX "AgentSkillInstallation_organizationId_status_idx" ON "AgentSkillInstallation"("organizationId", "status");
