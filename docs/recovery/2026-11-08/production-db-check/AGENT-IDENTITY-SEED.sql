-- Agent identity seed (ORIGINAL migration tool list: 17 tools incl. proposal-gated writes) for organizations missing one. Prepared, NOT executed.
-- Run only after recovery is confirmed and history is reconciled. Organizations come from "OrgMembership"
-- (the "Organization" table never existed). Existing identities are never touched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
INSERT INTO "WorkspaceAgentIdentity" ("organizationId", "displayName", "enabled", "allowedTools", "updatedBy", "updatedAt")
SELECT m."organizationId", 'Axiom Agent', true, '["list_environments","list_integrations","check_deploy_status","list_deployment_executions","list_github_files","inspect_github_repository","search_github_code","read_github_file","preview_scim_lifecycle","create_environment","configure_deployment_target","connect_identity_provider","create_github_branch","commit_github_file","commit_github_files","open_github_pull_request","trigger_aws_deploy"]'::jsonb,
       'migration:preserve-existing-agent', CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "organizationId" FROM "OrgMembership") m
ON CONFLICT ("organizationId") DO NOTHING;
DO $seed_check$
BEGIN
  IF (SELECT count(*) FROM "WorkspaceAgentIdentity") <> (SELECT count(DISTINCT "organizationId") FROM "OrgMembership") THEN
    RAISE EXCEPTION 'agent_identity_seed_count_mismatch';
  END IF;
END
$seed_check$;
COMMIT;
