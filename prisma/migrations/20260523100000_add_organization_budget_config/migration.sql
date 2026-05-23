-- Phase 401: per-organization budget config that overrides
-- DEFAULT_RUN_MAX_CENTS for a workspace + per-pipeline.
-- Primary key on organizationId so each workspace has at most one row.

CREATE TABLE "OrganizationBudgetConfig" (
    "organizationId"      TEXT NOT NULL,
    "defaultMaxCostCents" INTEGER,
    "pipelineOverrides"   JSONB NOT NULL DEFAULT '[]'::jsonb,
    "rationale"           TEXT,
    "updatedBy"           TEXT NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBudgetConfig_pkey" PRIMARY KEY ("organizationId")
);
