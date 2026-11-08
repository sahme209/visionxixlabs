-- Read-only check 4 (2026-11-08): seed state, truncated index name, legacy FK names, and exact column shapes.
-- One SELECT; no writes. Same target: branch with compute ep-small-mountain-ailw0kvt, database neondb.
-- Output: counts, object names and column definitions only (no row data).
SELECT
  (SELECT count(*) FROM public."WorkspaceAgentIdentity") AS agent_identity_rows,
  (SELECT count(*) FROM public."WorkspaceAgentIdentity" WHERE enabled) AS agent_identity_enabled,
  (SELECT count(DISTINCT "organizationId") FROM public."OrgMembership") AS orgs_with_members,
  (SELECT json_agg(indexname) FROM pg_indexes WHERE schemaname='public'
     AND indexname LIKE left('CloudAccountEnrollmentAttempt_organizationId_userId_expiresAt_idx', 63) || '%') AS enrollment_index,
  (SELECT json_agg(c.relname || '.' || k.conname ORDER BY c.relname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
     WHERE c.relname IN ('AxiomAgentRun','AxiomScheduledRun','AxiomAutopilotEvent') AND k.contype='f') AS legacy_fkeys,
  (SELECT json_object_agg(table_name, cols) FROM (
     SELECT table_name, json_agg(column_name || ' ' || udt_name || CASE WHEN is_nullable='NO' THEN ' NOT NULL' ELSE '' END
              || CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END ORDER BY ordinal_position) AS cols
     FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('AIUsageBillingConfig', 'AIUsageBillingPeriod', 'AIUsageBillingSettlement', 'AIUsageReservation', 'AddOnPurchase', 'BotTaskDraft', 'BotTaskDraftEvent', 'CloudAccount', 'CloudAccountCredential', 'CloudAccountEnrollmentAttempt', 'DurableAgentWorkflow', 'DurableAgentWorkflowEvent', 'EcsReleaseReviewCheckpoint', 'EcsReleaseReviewDecision', 'EcsReleaseReviewPacket', 'EmailVerificationToken', 'FoundingSupporterPurchase', 'StripeBillingEvent', 'SupporterStripeEvent', 'User', 'WorkspaceAgentIdentity')
     GROUP BY table_name) t) AS column_shapes;
