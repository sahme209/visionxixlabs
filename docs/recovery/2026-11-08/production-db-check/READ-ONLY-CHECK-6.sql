-- Read-only check 6 (2026-11-08): are the 30 "missing" indexes really missing, or only named differently?
-- Compares by DEFINITION (table, uniqueness, columns), ignoring names. Also inspects two extra live columns.
-- One SELECT; no writes. Target: branch with compute ep-small-mountain-ailw0kvt, database neondb.
WITH expected(name, def) AS (VALUES
    ('AgentEngineerActionAttempt_organizationId_runtimeDecision_c_idx','CREATE INDEX ON public."AgentEngineerActionAttempt" USING btree ("organizationId", "runtimeDecision", "createdAt")'),
    ('AzureGuidedAuthorization_organizationId_userId_sessionId_cr_idx','CREATE INDEX ON public."AzureGuidedAuthorization" USING btree ("organizationId", "userId", "sessionId", "createdAt")'),
    ('BillingAlert_organizationId_dimension_threshold_periodMonth_key','CREATE UNIQUE INDEX ON public."BillingAlert" USING btree ("organizationId", dimension, threshold, "periodMonth")'),
    ('BotAiTaskArtifact_organizationId_createdByUserId_runId_idx','CREATE INDEX ON public."BotAiTaskArtifact" USING btree ("organizationId", "createdByUserId", "runId")'),
    ('BotAiTaskEvent_organizationId_createdByUserId_runId_sequenc_idx','CREATE INDEX ON public."BotAiTaskEvent" USING btree ("organizationId", "createdByUserId", "runId", sequence)'),
    ('BotAiTaskEvent_runId_sequence_key','CREATE UNIQUE INDEX ON public."BotAiTaskEvent" USING btree ("runId", sequence)'),
    ('BotAiTaskRun_organizationId_createdByUserId_clientRequestId_key','CREATE UNIQUE INDEX ON public."BotAiTaskRun" USING btree ("organizationId", "createdByUserId", "clientRequestId")'),
    ('BotAiTaskRun_organizationId_createdByUserId_createdAt_id_idx','CREATE INDEX ON public."BotAiTaskRun" USING btree ("organizationId", "createdByUserId", "createdAt", id)'),
    ('BotAiTaskRun_organizationId_createdByUserId_id_key','CREATE UNIQUE INDEX ON public."BotAiTaskRun" USING btree ("organizationId", "createdByUserId", id)'),
    ('BotPullRequestEvidenceArtifact_organizationId_createdByUser_idx','CREATE INDEX ON public."BotPullRequestEvidenceArtifact" USING btree ("organizationId", "createdByUserId", "runId")'),
    ('BotPullRequestEvidenceEvent_organizationId_createdByUserId__idx','CREATE INDEX ON public."BotPullRequestEvidenceEvent" USING btree ("organizationId", "createdByUserId", "runId", sequence)'),
    ('BotPullRequestEvidenceEvent_runId_sequence_key','CREATE UNIQUE INDEX ON public."BotPullRequestEvidenceEvent" USING btree ("runId", sequence)'),
    ('BotPullRequestEvidenceRun_organizationId_createdByUserId_cl_key','CREATE UNIQUE INDEX ON public."BotPullRequestEvidenceRun" USING btree ("organizationId", "createdByUserId", "clientRequestId")'),
    ('BotPullRequestEvidenceRun_organizationId_createdByUserId_cr_idx','CREATE INDEX ON public."BotPullRequestEvidenceRun" USING btree ("organizationId", "createdByUserId", "createdAt", id)'),
    ('BotPullRequestEvidenceRun_organizationId_createdByUserId_id_key','CREATE UNIQUE INDEX ON public."BotPullRequestEvidenceRun" USING btree ("organizationId", "createdByUserId", id)'),
    ('BotTaskArtifact_organizationId_createdByUserId_runId_idx','CREATE INDEX ON public."BotTaskArtifact" USING btree ("organizationId", "createdByUserId", "runId")'),
    ('BotTaskRunEvent_organizationId_createdByUserId_runId_sequen_idx','CREATE INDEX ON public."BotTaskRunEvent" USING btree ("organizationId", "createdByUserId", "runId", sequence)'),
    ('BotTaskRunEvent_runId_sequence_key','CREATE UNIQUE INDEX ON public."BotTaskRunEvent" USING btree ("runId", sequence)'),
    ('BotTaskRun_organizationId_createdByUserId_clientRequestId_key','CREATE UNIQUE INDEX ON public."BotTaskRun" USING btree ("organizationId", "createdByUserId", "clientRequestId")'),
    ('BotTaskRun_organizationId_createdByUserId_createdAt_id_idx','CREATE INDEX ON public."BotTaskRun" USING btree ("organizationId", "createdByUserId", "createdAt", id)'),
    ('BotTaskRun_organizationId_createdByUserId_id_key','CREATE UNIQUE INDEX ON public."BotTaskRun" USING btree ("organizationId", "createdByUserId", id)'),
    ('CloudAccountEnrollmentAttempt_organizationId_userId_expires_idx','CREATE INDEX ON public."CloudAccountEnrollmentAttempt" USING btree ("organizationId", "userId", "expiresAt")'),
    ('EngineerApprovalSnapshot_organizationId_engineerId_createdA_idx','CREATE INDEX ON public."EngineerApprovalSnapshot" USING btree ("organizationId", "engineerId", "createdAt")'),
    ('GcpGuidedAuthorization_organizationId_userId_sessionId_expi_idx','CREATE INDEX ON public."GcpGuidedAuthorization" USING btree ("organizationId", "userId", "sessionId", "expiresAt")'),
    ('IdempotencyRecord_organizationId_idempotencyKey_routePath_key','CREATE UNIQUE INDEX ON public."IdempotencyRecord" USING btree ("organizationId", "idempotencyKey", "routePath")'),
    ('Lead_source_idx','CREATE INDEX ON public."Lead" USING btree (source)'),
    ('ProactiveAgiSuggestion_organizationId_operatorDecision_gene_idx','CREATE INDEX ON public."ProactiveAgiSuggestion" USING btree ("organizationId", "operatorDecision", "generatedAt")'),
    ('TauriAuditEvent_organizationId_deploymentRequestId_occurred_idx','CREATE INDEX ON public."TauriAuditEvent" USING btree ("organizationId", "deploymentRequestId", "occurredAt")'),
    ('TauriDeploymentOperation_organizationId_deploymentRequestId_idx','CREATE INDEX ON public."TauriDeploymentOperation" USING btree ("organizationId", "deploymentRequestId", "createdAt")'),
    ('TenantIntegrationAuthorizationAttempt_organizationId_provid_idx','CREATE INDEX ON public."TenantIntegrationAuthorizationAttempt" USING btree ("organizationId", provider, "expiresAt")')
), live AS (
  SELECT indexname, regexp_replace(indexdef, '^CREATE (UNIQUE )?INDEX \S+ ON ', 'CREATE \1INDEX ON ') AS def FROM pg_indexes WHERE schemaname = 'public'
)
SELECT
  (SELECT json_agg(e.name || ' -> ' || (SELECT string_agg(l.indexname, ',') FROM live l WHERE l.def = e.def) ORDER BY e.name) FROM expected e WHERE EXISTS (SELECT 1 FROM live l WHERE l.def = e.def)) AS present_under_other_name,
  (SELECT json_agg(e.name || ' :: ' || e.def ORDER BY e.name) FROM expected e WHERE NOT EXISTS (SELECT 1 FROM live l WHERE l.def = e.def)) AS truly_missing,
  (SELECT json_agg(table_name || '.' || column_name || ' ' || udt_name || CASE WHEN is_nullable='NO' THEN ' NOT NULL' ELSE '' END || coalesce(' DEFAULT ' || column_default, ''))
     FROM information_schema.columns WHERE table_schema='public' AND ((table_name='AuditEvent' AND column_name='status') OR (table_name='Lead' AND column_name='phone'))) AS extra_columns;
