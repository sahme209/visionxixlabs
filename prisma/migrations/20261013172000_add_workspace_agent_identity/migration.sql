-- Convergence revision (2026-11-08, user-approved): idempotent and non-granting.
-- The original text (pinned at scripts/fixtures/agent-identity-migration.production-original.sql,
-- sha256 761c6932…, the checksum production recorded) ended with a broad enabling/tool-grant backfill
-- that selected from a nonexistent "Organization" table and failed in production on 2026-10-14.
-- Production's table was created separately by the approved 2026-10-23 schema-only repair, and the
-- Oct 23 operational hold forbids the broad backfill. This revision only ensures the table exists:
-- no identity is enabled and no tool is granted. Any identity grant is a separate, explicit decision.
CREATE TABLE IF NOT EXISTS "WorkspaceAgentIdentity" (
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT 'Axiom Agent',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedTools" JSONB NOT NULL DEFAULT '[]',
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAgentIdentity_pkey" PRIMARY KEY ("organizationId")
);
