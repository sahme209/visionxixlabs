CREATE TABLE "WorkspaceAgentIdentity" (
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT 'Axiom Agent',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedTools" JSONB NOT NULL DEFAULT '[]',
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAgentIdentity_pkey" PRIMARY KEY ("organizationId")
);

-- Preserve the already-enabled desktop Agent for existing organizations.
-- New organizations still fail closed until an owner enables their identity.
INSERT INTO "WorkspaceAgentIdentity" ("organizationId", "displayName", "enabled", "allowedTools", "updatedBy", "updatedAt")
SELECT "id", 'Axiom Agent', true,
       '["list_environments","list_integrations","check_deploy_status","list_deployment_executions","list_github_files","inspect_github_repository","search_github_code","read_github_file","preview_scim_lifecycle","create_environment","configure_deployment_target","connect_identity_provider","create_github_branch","commit_github_file","commit_github_files","open_github_pull_request","trigger_aws_deploy"]'::jsonb,
       'migration:preserve-existing-agent', CURRENT_TIMESTAMP
FROM "Organization";
