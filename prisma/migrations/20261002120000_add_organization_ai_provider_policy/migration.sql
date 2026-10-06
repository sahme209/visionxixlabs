-- Workspace AI routing policy. Provider keys remain server-managed and are
-- intentionally not represented in this tenant-owned record.
CREATE TABLE "OrganizationAIProviderPolicy" (
    "organizationId" TEXT NOT NULL,
    "allowedProviders" JSONB NOT NULL DEFAULT '[]',
    "fallbackOrder" JSONB NOT NULL DEFAULT '[]',
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationAIProviderPolicy_pkey" PRIMARY KEY ("organizationId")
);
