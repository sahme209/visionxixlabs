-- REVIEW CANDIDATE ONLY. NOT APPROVED OR APPLIED TO PRODUCTION.
-- Pin project odd-union-57413470 / branch br-holy-voice-ai303o8m / neondb externally.
-- Add exactly 25 EMPTY tables and 18 enum types. No seeds, backfill, grants,
-- configuration, schedule, provider, billing or migration-ledger writes.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $fence$ BEGIN
 IF NOT pg_try_advisory_xact_lock(72707369) THEN RAISE EXCEPTION 'legacy25_migration_runner_busy'; END IF;
 IF current_database()<>'neondb' OR current_setting('server_version_num')::int/10000<>17
 OR to_regclass('public."User"') IS NULL OR to_regclass('public."WorkspaceAgentIdentity"') IS NULL
 OR to_regclass('public."CloudAccount"') IS NULL OR to_regclass('public."_prisma_migrations"') IS NULL THEN
 RAISE EXCEPTION 'legacy25_expected_baseline_required'; END IF;
END $fence$;
LOCK TABLE public."_prisma_migrations" IN SHARE MODE;
LOCK TABLE public."CloudAccount" IN ACCESS SHARE MODE;
DO $baseline$
DECLARE name text;
BEGIN
 IF (SELECT count(*) FROM pg_tables WHERE schemaname='public')<>140 THEN RAISE EXCEPTION 'legacy25_table_inventory_changed'; END IF;
 IF NOT has_schema_privilege(current_user,'public','CREATE') OR current_user<>(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public."User"'::regclass) THEN RAISE EXCEPTION 'legacy25_application_owner_required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtenabled<>'D') OR EXISTS(SELECT 1 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclrole=(SELECT relowner FROM pg_class WHERE oid='public."User"'::regclass) AND (d.defaclnamespace=0 OR n.nspname='public')) THEN RAISE EXCEPTION 'legacy25_access_defaults_changed'; END IF;
 IF md5((SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)::text FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public."CloudAccount"'::regclass AND a.attnum>0 AND NOT a.attisdropped)) IS DISTINCT FROM 'ade618d42514e2f662a949f8ec9b6826' THEN RAISE EXCEPTION 'legacy25_cloud_columns_changed'; END IF;
 IF md5((SELECT jsonb_agg(jsonb_build_array(migration_name,checksum,finished_at IS NULL,rolled_back_at IS NULL) ORDER BY migration_name,id)::text FROM public."_prisma_migrations")) IS DISTINCT FROM 'f6352d780fa95c2d6f61dfeab246660a' THEN RAISE EXCEPTION 'legacy25_migration_state_changed'; END IF;
 FOREACH name IN ARRAY ARRAY['MultiCloudReadinessReport','TerraformExecutionJob','AxiomAgentRun','AxiomFinding','AxiomRecommendation','AxiomExecutionPlan','AxiomExecutionPlanItem','AxiomApprovalRequest','AxiomApprovalItem','AxiomAuditEvent','AxiomScheduledRun','AxiomNotification','AxiomOrgPreferences','AxiomAgentTask','AxiomAutopilotEvent','AxiomApprovalPolicy','AxiomApprovalChain','AxiomApprovalVote','AxiomRbacAuditEvent','AIUsageBillingConfig','AIUsageBillingSettlement','AIUsageBillingPeriod','EcsReleaseReviewPacket','EcsReleaseReviewDecision','EcsReleaseReviewCheckpoint']::text[] LOOP
 IF to_regclass(format('public.%I',name)) IS NOT NULL THEN RAISE EXCEPTION 'legacy25_storage_already_present_or_partial'; END IF;
 END LOOP;
 FOREACH name IN ARRAY ARRAY['AgentRunStatus','AgentTrigger','FindingCategory','FindingSeverity','ActionDisposition','ActionType','RiskLevel','ApprovalDecision','ScheduleFrequency','NotificationType','RiskTolerance','ApprovalPolicy','OutputFormat','BusinessContext','ApprovalItemStatus','AgentTaskType','AgentTaskStatus','ApprovalChainStatus']::text[] LOOP
 IF to_regtype(format('public.%I',name)) IS NOT NULL THEN RAISE EXCEPTION 'legacy25_type_already_present_or_partial'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid='public."CloudAccount"'::regclass AND i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts=2 AND i.indnatts=2 AND (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(i.indkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum)=ARRAY['id','organizationId']) THEN RAISE EXCEPTION 'legacy25_cloud_tenant_key_required'; END IF;
END $baseline$;

CREATE TYPE public."AgentRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'partially_completed');
CREATE TYPE public."AgentTrigger" AS ENUM ('manual', 'scheduled', 'drift', 'onboarding', 'webhook');
CREATE TYPE public."FindingCategory" AS ENUM ('cost', 'resilience', 'security', 'performance', 'compliance');
CREATE TYPE public."FindingSeverity" AS ENUM ('info', 'low', 'medium', 'high', 'critical');
CREATE TYPE public."ActionDisposition" AS ENUM ('auto_fix_candidate', 'approval_required', 'report_only', 'blocked');
CREATE TYPE public."ActionType" AS ENUM ('resize_compute', 'apply_storage_policy', 'purchase_commitment', 'decommission_compute');
CREATE TYPE public."RiskLevel" AS ENUM ('low', 'medium', 'high');
CREATE TYPE public."ApprovalDecision" AS ENUM ('approve_all', 'approve_partial', 'reject_all');
CREATE TYPE public."ScheduleFrequency" AS ENUM ('daily', 'weekly');
CREATE TYPE public."NotificationType" AS ENUM ('scan_diff', 'new_high_risk', 'savings_increased', 'risk_resolved', 'scan_failed');
CREATE TYPE public."RiskTolerance" AS ENUM ('conservative', 'moderate', 'aggressive');
CREATE TYPE public."ApprovalPolicy" AS ENUM ('require_all', 'auto_low_risk', 'auto_safe');
CREATE TYPE public."OutputFormat" AS ENUM ('terraform', 'cli', 'json');
CREATE TYPE public."BusinessContext" AS ENUM ('startup', 'agency', 'enterprise', 'ecommerce', 'healthcare', 'fintech', 'saas', 'other');
CREATE TYPE public."ApprovalItemStatus" AS ENUM ('pending', 'approved', 'rejected', 'snoozed', 'applied', 'failed', 'expired');
CREATE TYPE public."AgentTaskType" AS ENUM ('scan_cloud', 'analyze_snapshot', 'generate_execution_plan', 'generate_terraform', 'request_approval', 'apply_action', 'verify_action', 'rollback_action', 'schedule_next_scan');
CREATE TYPE public."AgentTaskStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');
CREATE TYPE public."ApprovalChainStatus" AS ENUM ('pending_approvals', 'approved', 'rejected', 'escalated', 'expired', 'bypassed');
-- CreateTable
CREATE TABLE public."MultiCloudReadinessReport" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "score" INTEGER NOT NULL,
    "providerSummary" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "estimatedCostImpact" JSONB NOT NULL,
    "rto" TEXT NOT NULL,
    "rpo" TEXT NOT NULL,
    "rawScanData" JSONB,
    "aiAnalysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MultiCloudReadinessReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."TerraformExecutionJob" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "readinessReportId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "mode" TEXT NOT NULL DEFAULT 'active_passive',
    "primaryCloud" TEXT NOT NULL DEFAULT 'aws',
    "secondaryCloud" TEXT NOT NULL DEFAULT 'azure',
    "workingDirectory" TEXT,
    "generatedFiles" JSONB,
    "planSummary" JSONB,
    "planOutput" TEXT,
    "applyOutput" TEXT,
    "errorMessage" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerraformExecutionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomAgentRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cloudAccountId" TEXT NOT NULL,
    "trigger" public."AgentTrigger" NOT NULL,
    "status" public."AgentRunStatus" NOT NULL DEFAULT 'pending',
    "snapshotData" JSONB,
    "summary" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomAgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "category" public."FindingCategory" NOT NULL,
    "severity" public."FindingSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedResources" JSONB NOT NULL,
    "region" TEXT NOT NULL,
    "provider" public."CloudProvider" NOT NULL,
    "confidence" TEXT NOT NULL,
    "monthlyLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomRecommendation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "disposition" public."ActionDisposition" NOT NULL,
    "dispositionReason" TEXT NOT NULL,
    "actionType" public."ActionType",
    "riskLevel" public."RiskLevel",
    "effort" TEXT NOT NULL DEFAULT 'none',
    "actionable" BOOLEAN NOT NULL DEFAULT false,
    "monthlyLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomExecutionPlan" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "safeToApply" BOOLEAN NOT NULL DEFAULT false,
    "downtimeEstimate" TEXT,
    "rollbackComplexity" TEXT,
    "dryRunResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomExecutionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomExecutionPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "actionType" public."ActionType" NOT NULL,
    "provider" public."CloudProvider" NOT NULL,
    "region" TEXT NOT NULL,
    "resourceIds" JSONB NOT NULL,
    "currentState" TEXT NOT NULL,
    "recommendedState" TEXT NOT NULL,
    "riskLevel" public."RiskLevel" NOT NULL,
    "disposition" public."ActionDisposition" NOT NULL,
    "monthlyLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rollbackPlan" JSONB,
    "precheckResult" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomExecutionPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomApprovalRequest" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" public."ApprovalDecision" NOT NULL,
    "approvedItemIds" JSONB NOT NULL,
    "rejectedItemIds" JSONB,
    "note" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomApprovalItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "status" public."ApprovalItemStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "actionType" public."ActionType" NOT NULL,
    "provider" public."CloudProvider" NOT NULL,
    "region" TEXT NOT NULL,
    "resourceIds" JSONB NOT NULL,
    "currentState" TEXT NOT NULL,
    "recommendedState" TEXT NOT NULL,
    "riskLevel" public."RiskLevel" NOT NULL,
    "disposition" public."ActionDisposition" NOT NULL,
    "dispositionReason" TEXT NOT NULL,
    "monthlyLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rollbackAvailable" BOOLEAN NOT NULL DEFAULT false,
    "rollbackComplexity" TEXT,
    "precheckPassed" BOOLEAN NOT NULL DEFAULT true,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomApprovalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomAuditEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planItemId" TEXT,
    "provider" public."CloudProvider" NOT NULL,
    "actionType" public."ActionType" NOT NULL,
    "resourceIds" JSONB NOT NULL,
    "region" TEXT NOT NULL,
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB,
    "status" "AuditEventStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "riskLevel" public."RiskLevel" NOT NULL,
    "monthlyLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearlyHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomScheduledRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cloudAccountId" TEXT NOT NULL,
    "trigger" public."AgentTrigger" NOT NULL DEFAULT 'scheduled',
    "frequency" public."ScheduleFrequency" NOT NULL DEFAULT 'daily',
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunId" TEXT,
    "lastDiffSummary" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomScheduledRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomNotification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "runId" TEXT,
    "scheduledRunId" TEXT,
    "type" public."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomOrgPreferences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "preferredProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskTolerance" public."RiskTolerance" NOT NULL DEFAULT 'conservative',
    "approvalPolicy" public."ApprovalPolicy" NOT NULL DEFAULT 'require_all',
    "autoApplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outputFormat" public."OutputFormat" NOT NULL DEFAULT 'terraform',
    "businessContext" public."BusinessContext" NOT NULL DEFAULT 'other',
    "ignoredFindingTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priorityCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomOrgPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomAgentTask" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "taskType" public."AgentTaskType" NOT NULL,
    "status" public."AgentTaskStatus" NOT NULL DEFAULT 'pending',
    "provider" public."CloudProvider" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "inputJson" JSONB,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "dependsOn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idempotencyKey" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomAgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomAutopilotEvent" (
    "id" TEXT NOT NULL,
    "cloudAccountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousMode" public."AutopilotMode",
    "newMode" public."AutopilotMode",
    "runId" TEXT,
    "actionType" public."ActionType",
    "riskLevel" public."RiskLevel",
    "disposition" public."ActionDisposition",
    "resourceIds" JSONB,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomAutopilotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomApprovalPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "matchRiskLevels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchActionTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchMinSavings" DOUBLE PRECISION,
    "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
    "requiredRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "escalateAfterHours" INTEGER,
    "escalateToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autoExpireHours" INTEGER,
    "blockAction" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomApprovalChain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "approvalItemId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" public."ApprovalChainStatus" NOT NULL DEFAULT 'pending_approvals',
    "requiredCount" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "escalatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomApprovalChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomApprovalVote" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomApprovalVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AxiomRbacAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "OrgRole" NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomRbacAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AIUsageBillingConfig" (
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "monthlySpendLimitCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageBillingConfig_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE public."AIUsageBillingSettlement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "usageEventId" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "idempotencyKey" TEXT NOT NULL,
    "stripeInvoiceItemId" TEXT,
    "failureReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIUsageBillingSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."AIUsageBillingPeriod" (
    "organizationId" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "limitCents" INTEGER NOT NULL,
    "reservedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIUsageBillingPeriod_pkey" PRIMARY KEY ("organizationId","periodMonth")
);

-- CreateTable
CREATE TABLE public."EcsReleaseReviewPacket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "manifestDigest" TEXT NOT NULL,
    "imageSetDigest" TEXT NOT NULL,
    "healthPolicyDigest" TEXT NOT NULL,
    "verifiedEvidenceJson" JSONB NOT NULL,
    "evidenceDigest" TEXT NOT NULL,
    "policyDigest" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcsReleaseReviewPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."EcsReleaseReviewDecision" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "manifestDigest" TEXT NOT NULL,
    "policyDigest" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcsReleaseReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE public."EcsReleaseReviewCheckpoint" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "manifestDigest" TEXT NOT NULL,
    "policyDigest" TEXT NOT NULL,
    "decisionSetDigest" TEXT NOT NULL,
    "decisionIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcsReleaseReviewCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MultiCloudReadinessReport_leadId_idx" ON public."MultiCloudReadinessReport"("leadId");

-- CreateIndex
CREATE INDEX "MultiCloudReadinessReport_userId_idx" ON public."MultiCloudReadinessReport"("userId");

-- CreateIndex
CREATE INDEX "MultiCloudReadinessReport_createdAt_idx" ON public."MultiCloudReadinessReport"("createdAt");

-- CreateIndex
CREATE INDEX "TerraformExecutionJob_leadId_idx" ON public."TerraformExecutionJob"("leadId");

-- CreateIndex
CREATE INDEX "TerraformExecutionJob_userId_idx" ON public."TerraformExecutionJob"("userId");

-- CreateIndex
CREATE INDEX "TerraformExecutionJob_status_idx" ON public."TerraformExecutionJob"("status");

-- CreateIndex
CREATE INDEX "TerraformExecutionJob_createdAt_idx" ON public."TerraformExecutionJob"("createdAt");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_userId_idx" ON public."AxiomAgentRun"("userId");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_organizationId_idx" ON public."AxiomAgentRun"("organizationId");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_cloudAccountId_idx" ON public."AxiomAgentRun"("cloudAccountId");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_status_idx" ON public."AxiomAgentRun"("status");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_trigger_idx" ON public."AxiomAgentRun"("trigger");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_createdAt_idx" ON public."AxiomAgentRun"("createdAt");

-- CreateIndex
CREATE INDEX "AxiomFinding_runId_idx" ON public."AxiomFinding"("runId");

-- CreateIndex
CREATE INDEX "AxiomFinding_category_idx" ON public."AxiomFinding"("category");

-- CreateIndex
CREATE INDEX "AxiomFinding_severity_idx" ON public."AxiomFinding"("severity");

-- CreateIndex
CREATE INDEX "AxiomRecommendation_runId_idx" ON public."AxiomRecommendation"("runId");

-- CreateIndex
CREATE INDEX "AxiomRecommendation_disposition_idx" ON public."AxiomRecommendation"("disposition");

-- CreateIndex
CREATE INDEX "AxiomRecommendation_actionType_idx" ON public."AxiomRecommendation"("actionType");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomExecutionPlan_runId_key" ON public."AxiomExecutionPlan"("runId");

-- CreateIndex
CREATE INDEX "AxiomExecutionPlan_runId_idx" ON public."AxiomExecutionPlan"("runId");

-- CreateIndex
CREATE INDEX "AxiomExecutionPlanItem_planId_idx" ON public."AxiomExecutionPlanItem"("planId");

-- CreateIndex
CREATE INDEX "AxiomExecutionPlanItem_disposition_idx" ON public."AxiomExecutionPlanItem"("disposition");

-- CreateIndex
CREATE INDEX "AxiomApprovalRequest_runId_idx" ON public."AxiomApprovalRequest"("runId");

-- CreateIndex
CREATE INDEX "AxiomApprovalRequest_userId_idx" ON public."AxiomApprovalRequest"("userId");

-- CreateIndex
CREATE INDEX "AxiomApprovalItem_organizationId_status_idx" ON public."AxiomApprovalItem"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AxiomApprovalItem_status_idx" ON public."AxiomApprovalItem"("status");

-- CreateIndex
CREATE INDEX "AxiomApprovalItem_runId_idx" ON public."AxiomApprovalItem"("runId");

-- CreateIndex
CREATE INDEX "AxiomApprovalItem_snoozedUntil_idx" ON public."AxiomApprovalItem"("snoozedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomApprovalItem_runId_planItemId_key" ON public."AxiomApprovalItem"("runId", "planItemId");

-- CreateIndex
CREATE INDEX "AxiomAuditEvent_runId_idx" ON public."AxiomAuditEvent"("runId");

-- CreateIndex
CREATE INDEX "AxiomAuditEvent_userId_idx" ON public."AxiomAuditEvent"("userId");

-- CreateIndex
CREATE INDEX "AxiomAuditEvent_organizationId_idx" ON public."AxiomAuditEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AxiomAuditEvent_provider_status_idx" ON public."AxiomAuditEvent"("provider", "status");

-- CreateIndex
CREATE INDEX "AxiomAuditEvent_createdAt_idx" ON public."AxiomAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AxiomScheduledRun_organizationId_idx" ON public."AxiomScheduledRun"("organizationId");

-- CreateIndex
CREATE INDEX "AxiomScheduledRun_cloudAccountId_idx" ON public."AxiomScheduledRun"("cloudAccountId");

-- CreateIndex
CREATE INDEX "AxiomScheduledRun_nextRunAt_enabled_idx" ON public."AxiomScheduledRun"("nextRunAt", "enabled");

-- CreateIndex
CREATE INDEX "AxiomNotification_organizationId_idx" ON public."AxiomNotification"("organizationId");

-- CreateIndex
CREATE INDEX "AxiomNotification_userId_read_idx" ON public."AxiomNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "AxiomNotification_createdAt_idx" ON public."AxiomNotification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomOrgPreferences_organizationId_key" ON public."AxiomOrgPreferences"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomAgentTask_idempotencyKey_key" ON public."AxiomAgentTask"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AxiomAgentTask_agentRunId_idx" ON public."AxiomAgentTask"("agentRunId");

-- CreateIndex
CREATE INDEX "AxiomAgentTask_status_idx" ON public."AxiomAgentTask"("status");

-- CreateIndex
CREATE INDEX "AxiomAgentTask_taskType_idx" ON public."AxiomAgentTask"("taskType");

-- CreateIndex
CREATE INDEX "AxiomAgentTask_agentRunId_sortOrder_idx" ON public."AxiomAgentTask"("agentRunId", "sortOrder");

-- CreateIndex
CREATE INDEX "AxiomAutopilotEvent_cloudAccountId_idx" ON public."AxiomAutopilotEvent"("cloudAccountId");

-- CreateIndex
CREATE INDEX "AxiomAutopilotEvent_organizationId_idx" ON public."AxiomAutopilotEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AxiomAutopilotEvent_eventType_idx" ON public."AxiomAutopilotEvent"("eventType");

-- CreateIndex
CREATE INDEX "AxiomAutopilotEvent_createdAt_idx" ON public."AxiomAutopilotEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AxiomApprovalPolicy_organizationId_enabled_idx" ON public."AxiomApprovalPolicy"("organizationId", "enabled");

-- CreateIndex
CREATE INDEX "AxiomApprovalPolicy_priority_idx" ON public."AxiomApprovalPolicy"("priority");

-- CreateIndex
CREATE INDEX "AxiomApprovalChain_organizationId_status_idx" ON public."AxiomApprovalChain"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AxiomApprovalChain_approvalItemId_idx" ON public."AxiomApprovalChain"("approvalItemId");

-- CreateIndex
CREATE INDEX "AxiomApprovalChain_expiresAt_idx" ON public."AxiomApprovalChain"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomApprovalChain_approvalItemId_policyId_key" ON public."AxiomApprovalChain"("approvalItemId", "policyId");

-- CreateIndex
CREATE INDEX "AxiomApprovalVote_chainId_idx" ON public."AxiomApprovalVote"("chainId");

-- CreateIndex
CREATE INDEX "AxiomApprovalVote_userId_idx" ON public."AxiomApprovalVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomApprovalVote_chainId_userId_key" ON public."AxiomApprovalVote"("chainId", "userId");

-- CreateIndex
CREATE INDEX "AxiomRbacAuditEvent_organizationId_createdAt_idx" ON public."AxiomRbacAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AxiomRbacAuditEvent_actorId_idx" ON public."AxiomRbacAuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "AxiomRbacAuditEvent_targetId_idx" ON public."AxiomRbacAuditEvent"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageBillingSettlement_usageEventId_key" ON public."AIUsageBillingSettlement"("usageEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageBillingSettlement_idempotencyKey_key" ON public."AIUsageBillingSettlement"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageBillingSettlement_stripeInvoiceItemId_key" ON public."AIUsageBillingSettlement"("stripeInvoiceItemId");

-- CreateIndex
CREATE INDEX "AIUsageBillingSettlement_organizationId_periodMonth_status_idx" ON public."AIUsageBillingSettlement"("organizationId", "periodMonth", "status");

-- CreateIndex
CREATE INDEX "EcsReleaseReviewPacket_scope_expiry_idx" ON public."EcsReleaseReviewPacket"("organizationId", "environmentId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EcsReleaseReviewPacket_organizationId_operationId_key" ON public."EcsReleaseReviewPacket"("organizationId", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "EcsReleaseReviewPacket_id_organizationId_key" ON public."EcsReleaseReviewPacket"("id", "organizationId");

-- CreateIndex
CREATE INDEX "EcsReleaseReviewDecision_scope_revision_idx" ON public."EcsReleaseReviewDecision"("organizationId", "packetId", "userId", "revision" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "EcsReleaseReviewDecision_packetId_userId_revision_key" ON public."EcsReleaseReviewDecision"("packetId", "userId", "revision");

-- CreateIndex
CREATE INDEX "EcsReleaseReviewCheckpoint_organizationId_packetId_idx" ON public."EcsReleaseReviewCheckpoint"("organizationId", "packetId");

-- CreateIndex
CREATE UNIQUE INDEX "EcsReleaseReviewCheckpoint_packetId_decisionSetDigest_key" ON public."EcsReleaseReviewCheckpoint"("packetId", "decisionSetDigest");

-- AddForeignKey
ALTER TABLE public."AxiomAgentRun" ADD CONSTRAINT "AxiomAgentRun_cloudAccountId_organizationId_fkey" FOREIGN KEY ("cloudAccountId", "organizationId") REFERENCES public."CloudAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomFinding" ADD CONSTRAINT "AxiomFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES public."AxiomAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomRecommendation" ADD CONSTRAINT "AxiomRecommendation_runId_fkey" FOREIGN KEY ("runId") REFERENCES public."AxiomAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomRecommendation" ADD CONSTRAINT "AxiomRecommendation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES public."AxiomFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomExecutionPlan" ADD CONSTRAINT "AxiomExecutionPlan_runId_fkey" FOREIGN KEY ("runId") REFERENCES public."AxiomAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomExecutionPlanItem" ADD CONSTRAINT "AxiomExecutionPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES public."AxiomExecutionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomExecutionPlanItem" ADD CONSTRAINT "AxiomExecutionPlanItem_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES public."AxiomRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomApprovalRequest" ADD CONSTRAINT "AxiomApprovalRequest_runId_fkey" FOREIGN KEY ("runId") REFERENCES public."AxiomAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomAuditEvent" ADD CONSTRAINT "AxiomAuditEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES public."AxiomAgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomScheduledRun" ADD CONSTRAINT "AxiomScheduledRun_cloudAccountId_organizationId_fkey" FOREIGN KEY ("cloudAccountId", "organizationId") REFERENCES public."CloudAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomAgentTask" ADD CONSTRAINT "AxiomAgentTask_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES public."AxiomAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomAutopilotEvent" ADD CONSTRAINT "AxiomAutopilotEvent_cloudAccountId_organizationId_fkey" FOREIGN KEY ("cloudAccountId", "organizationId") REFERENCES public."CloudAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."AxiomApprovalVote" ADD CONSTRAINT "AxiomApprovalVote_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES public."AxiomApprovalChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."EcsReleaseReviewDecision" ADD CONSTRAINT "EcsReleaseReviewDecision_packetId_organizationId_fkey" FOREIGN KEY ("packetId", "organizationId") REFERENCES public."EcsReleaseReviewPacket"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE public."EcsReleaseReviewCheckpoint" ADD CONSTRAINT "EcsReleaseReviewCheckpoint_packetId_organizationId_fkey" FOREIGN KEY ("packetId", "organizationId") REFERENCES public."EcsReleaseReviewPacket"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $post$
DECLARE name text; row_count bigint;
BEGIN
 IF (SELECT count(*) FROM pg_tables WHERE schemaname='public')<>165 THEN RAISE EXCEPTION 'legacy25_unexpected_final_inventory'; END IF;
 FOREACH name IN ARRAY ARRAY['MultiCloudReadinessReport','TerraformExecutionJob','AxiomAgentRun','AxiomFinding','AxiomRecommendation','AxiomExecutionPlan','AxiomExecutionPlanItem','AxiomApprovalRequest','AxiomApprovalItem','AxiomAuditEvent','AxiomScheduledRun','AxiomNotification','AxiomOrgPreferences','AxiomAgentTask','AxiomAutopilotEvent','AxiomApprovalPolicy','AxiomApprovalChain','AxiomApprovalVote','AxiomRbacAuditEvent','AIUsageBillingConfig','AIUsageBillingSettlement','AIUsageBillingPeriod','EcsReleaseReviewPacket','EcsReleaseReviewDecision','EcsReleaseReviewCheckpoint']::text[] LOOP
 EXECUTE format('SELECT count(*) FROM public.%I',name) INTO row_count;
 IF row_count<>0 THEN RAISE EXCEPTION 'legacy25_new_storage_must_be_empty'; END IF;
 END LOOP;
 IF md5((SELECT jsonb_agg(jsonb_build_array(migration_name,checksum,finished_at IS NULL,rolled_back_at IS NULL) ORDER BY migration_name,id)::text FROM public."_prisma_migrations")) IS DISTINCT FROM 'f6352d780fa95c2d6f61dfeab246660a' THEN RAISE EXCEPTION 'legacy25_migration_state_changed'; END IF;
END $post$;
COMMIT;
