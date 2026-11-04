-- CreateEnum
CREATE TYPE "CloudProvider" AS ENUM ('aws', 'azure', 'gcp');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'partially_completed');

-- CreateEnum
CREATE TYPE "AgentTrigger" AS ENUM ('manual', 'scheduled', 'drift', 'onboarding', 'webhook');

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('cost', 'resilience', 'security', 'performance', 'compliance');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('info', 'low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ActionDisposition" AS ENUM ('auto_fix_candidate', 'approval_required', 'report_only', 'blocked');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('resize_compute', 'apply_storage_policy', 'purchase_commitment', 'decommission_compute');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('approve_all', 'approve_partial', 'reject_all');

-- CreateEnum
CREATE TYPE "AuditEventStatus" AS ENUM ('pending', 'precheck_failed', 'applied', 'simulated', 'verified', 'failed', 'rolled_back');

-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('daily', 'weekly');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('scan_diff', 'new_high_risk', 'savings_increased', 'risk_resolved', 'scan_failed');

-- CreateEnum
CREATE TYPE "RiskTolerance" AS ENUM ('conservative', 'moderate', 'aggressive');

-- CreateEnum
CREATE TYPE "ApprovalPolicy" AS ENUM ('require_all', 'auto_low_risk', 'auto_safe');

-- CreateEnum
CREATE TYPE "OutputFormat" AS ENUM ('terraform', 'cli', 'json');

-- CreateEnum
CREATE TYPE "BusinessContext" AS ENUM ('startup', 'agency', 'enterprise', 'ecommerce', 'healthcare', 'fintech', 'saas', 'other');

-- CreateEnum
CREATE TYPE "AutopilotMode" AS ENUM ('observe_only', 'recommend', 'assisted_apply', 'full_guarded');

-- CreateEnum
CREATE TYPE "ApprovalItemStatus" AS ENUM ('pending', 'approved', 'rejected', 'snoozed', 'applied', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "AgentTaskType" AS ENUM ('scan_cloud', 'analyze_snapshot', 'generate_execution_plan', 'generate_terraform', 'request_approval', 'apply_action', 'verify_action', 'rollback_action', 'schedule_next_scan');

-- CreateEnum
CREATE TYPE "AgentTaskStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'operator', 'security_reviewer', 'finance_viewer', 'read_only');

-- CreateEnum
CREATE TYPE "ApprovalChainStatus" AS ENUM ('pending_approvals', 'approved', 'rejected', 'escalated', 'expired', 'bypassed');

-- CreateEnum
CREATE TYPE "ConnectorSetupStatus" AS ENUM ('not_connected', 'setup_started', 'waiting_for_provider', 'validating', 'connected', 'failed', 'disconnected', 'revoked', 'needs_attention');

-- CreateEnum
CREATE TYPE "AlertEscalationStatus" AS ENUM ('quiet', 'fired', 'escalated', 'acknowledged', 'snoozed', 'resolved', 'auto_resolved', 'expired');

-- CreateEnum
CREATE TYPE "IdentityProviderProtocol" AS ENUM ('oidc', 'saml');

-- CreateEnum
CREATE TYPE "ComponentKind" AS ENUM ('app', 'infra', 'data_pipeline', 'connector', 'database', 'dag', 'iac', 'artifact');

-- CreateEnum
CREATE TYPE "GitProvider" AS ENUM ('github', 'gitlab', 'azuredevops', 'other');

-- CreateEnum
CREATE TYPE "EnvironmentTier" AS ENUM ('dev', 'test', 'qa', 'uat', 'stage', 'preprod', 'prod');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "image" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "plan" TEXT,
    "planExpiresAt" TIMESTAMP(3),
    "modules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "messageLimit" INTEGER NOT NULL DEFAULT 6000,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "pageLimit" INTEGER NOT NULL DEFAULT 2500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "content" TEXT,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "userId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'website-request',
    "status" TEXT NOT NULL DEFAULT 'created',
    "fullPayload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AxiomScoreSnapshot" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tier" TEXT NOT NULL,
    "provider" TEXT,
    "infrastructureScore" INTEGER,
    "estimatedAnnualSavings" INTEGER,
    "riskExposureLevel" TEXT,
    "deploymentFrictionIndex" INTEGER,
    "complexityTier" TEXT,
    "automationReadinessScore" INTEGER,
    "scoringVersion" TEXT,
    "raw" JSONB,

    CONSTRAINT "AxiomScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPipelineSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "highUrgencyCount" INTEGER NOT NULL,
    "enterpriseLikelihoodAvg" DOUBLE PRECISION NOT NULL,
    "expansionProbabilityAvg" DOUBLE PRECISION NOT NULL,
    "avgStrategicReadiness" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SalesPipelineSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringAnalysis" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "jobType" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "leadId" TEXT,
    "action" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "params" JSONB,
    "result" JSONB,
    "error" TEXT,
    "inputHash" TEXT,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "rollbackSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInvocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "taskType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "promptHash" TEXT,
    "promptPreview" VARCHAR(200),
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadId" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiCloudReadinessReport" (
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
CREATE TABLE "TerraformExecutionJob" (
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
CREATE TABLE "AxiomConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "leadId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AxiomMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "alias" TEXT,
    "credentialRef" TEXT,
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "autopilotMode" "AutopilotMode" NOT NULL DEFAULT 'observe_only',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScannedAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudAccountCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encryptedConfiguration" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "validatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudAccountCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudAccountEnrollmentAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expectedAccountId" TEXT NOT NULL,
    "roleArn" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "externalIdDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "expectedCredentialVersion" INTEGER,
    "expectedAccountUpdatedAt" TIMESTAMP(3),
    "cloudAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudAccountEnrollmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AxiomAgentRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cloudAccountId" TEXT NOT NULL,
    "trigger" "AgentTrigger" NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'pending',
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
CREATE TABLE "AxiomFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedResources" JSONB NOT NULL,
    "region" TEXT NOT NULL,
    "provider" "CloudProvider" NOT NULL,
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
CREATE TABLE "AxiomRecommendation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "disposition" "ActionDisposition" NOT NULL,
    "dispositionReason" TEXT NOT NULL,
    "actionType" "ActionType",
    "riskLevel" "RiskLevel",
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
CREATE TABLE "AxiomExecutionPlan" (
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
CREATE TABLE "AxiomExecutionPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "actionType" "ActionType" NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "region" TEXT NOT NULL,
    "resourceIds" JSONB NOT NULL,
    "currentState" TEXT NOT NULL,
    "recommendedState" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "disposition" "ActionDisposition" NOT NULL,
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
CREATE TABLE "AxiomApprovalRequest" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "approvedItemIds" JSONB NOT NULL,
    "rejectedItemIds" JSONB,
    "note" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AxiomApprovalItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "status" "ApprovalItemStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "region" TEXT NOT NULL,
    "resourceIds" JSONB NOT NULL,
    "currentState" TEXT NOT NULL,
    "recommendedState" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "disposition" "ActionDisposition" NOT NULL,
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
CREATE TABLE "AxiomAuditEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planItemId" TEXT,
    "provider" "CloudProvider" NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "resourceIds" JSONB NOT NULL,
    "region" TEXT NOT NULL,
    "beforeState" JSONB NOT NULL,
    "afterState" JSONB,
    "status" "AuditEventStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "riskLevel" "RiskLevel" NOT NULL,
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
CREATE TABLE "AxiomScheduledRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cloudAccountId" TEXT NOT NULL,
    "trigger" "AgentTrigger" NOT NULL DEFAULT 'scheduled',
    "frequency" "ScheduleFrequency" NOT NULL DEFAULT 'daily',
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
CREATE TABLE "AxiomNotification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "runId" TEXT,
    "scheduledRunId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AxiomOrgPreferences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "preferredProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskTolerance" "RiskTolerance" NOT NULL DEFAULT 'conservative',
    "approvalPolicy" "ApprovalPolicy" NOT NULL DEFAULT 'require_all',
    "autoApplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outputFormat" "OutputFormat" NOT NULL DEFAULT 'terraform',
    "businessContext" "BusinessContext" NOT NULL DEFAULT 'other',
    "ignoredFindingTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priorityCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiomOrgPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AxiomAgentTask" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "taskType" "AgentTaskType" NOT NULL,
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'pending',
    "provider" "CloudProvider" NOT NULL,
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
CREATE TABLE "AgentEngineerRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "defaultApprovalRule" TEXT NOT NULL,
    "currentApprovalRule" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentEngineerRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentEngineerActionAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "isReadOnly" BOOLEAN NOT NULL,
    "module" TEXT,
    "connector" TEXT,
    "runtimeDecision" TEXT NOT NULL,
    "effectiveRule" TEXT NOT NULL,
    "policySource" TEXT NOT NULL,
    "requiredApprovers" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvalRequestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentEngineerActionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineerApprovalSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "attemptId" TEXT,
    "riskLevel" TEXT NOT NULL,
    "effectiveRule" TEXT NOT NULL,
    "requiredApprovers" INTEGER NOT NULL DEFAULT 0,
    "correlationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "executionStatus" TEXT NOT NULL DEFAULT 'not_started',
    "executedAt" TIMESTAMP(3),
    "executedByUserId" TEXT,
    "executionResultSummary" TEXT,
    "executionResultDetail" JSONB,
    "executionError" TEXT,
    "sourceKind" TEXT NOT NULL DEFAULT 'engineer_action',
    "pipelineStageRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineerApprovalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngineerApprovalDecision" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngineerApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "triggeredBy" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStageRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "stageKind" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalRequestId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "outputSummary" TEXT,
    "outputDetail" JSONB,
    "errorMessage" TEXT,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStageRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodingTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "repoRef" TEXT NOT NULL,
    "branchHint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdBy" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProviderRate" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "inputCentsPerMillion" INTEGER NOT NULL,
    "outputCentsPerMillion" INTEGER NOT NULL,
    "cachedReadCentsPerMillion" INTEGER,
    "batchInputCentsPerMillion" INTEGER,
    "batchOutputCentsPerMillion" INTEGER,
    "enterpriseRateNote" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProviderRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalUsageId" TEXT,
    "eventKind" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedReadTokens" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "billedCents" INTEGER NOT NULL DEFAULT 0,
    "billingStatus" TEXT NOT NULL DEFAULT 'settled',
    "triggeredBy" TEXT,
    "aiInvocationId" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageReservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reservedCents" INTEGER NOT NULL,
    "settledCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "correlationId" TEXT,
    "usageEventId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIUsageReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOnPurchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "pricePaidCents" INTEGER NOT NULL,
    "deliveredAICreditsCents" INTEGER NOT NULL DEFAULT 0,
    "deliveredSeats" INTEGER NOT NULL DEFAULT 0,
    "deliveredConnectors" INTEGER NOT NULL DEFAULT 0,
    "validFor" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "reversedAICreditsCents" INTEGER NOT NULL DEFAULT 0,
    "purchasedBy" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOnPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeBillingEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeBillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceControlCheckRun" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceControlCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL,
    "runKind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "passCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "modelUsed" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalCase" (
    "id" TEXT NOT NULL,
    "evalRunId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "codingTaskId" TEXT,
    "outcome" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "failures" JSONB NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "planTier" TEXT NOT NULL,
    "ratioAtTrigger" DOUBLE PRECISION NOT NULL,
    "limitAtTrigger" INTEGER,
    "currentAtTrigger" INTEGER NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "deliveryChannel" TEXT NOT NULL DEFAULT 'dashboard',
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceUsageSummary" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "aiCostCents" INTEGER NOT NULL DEFAULT 0,
    "aiInvocationCount" INTEGER NOT NULL DEFAULT 0,
    "aiInputTokens" BIGINT NOT NULL DEFAULT 0,
    "aiOutputTokens" BIGINT NOT NULL DEFAULT 0,
    "aiCachedReadTokens" BIGINT NOT NULL DEFAULT 0,
    "agentRunCount" INTEGER NOT NULL DEFAULT 0,
    "automationRunCount" INTEGER NOT NULL DEFAULT 0,
    "connectorSyncCount" INTEGER NOT NULL DEFAULT 0,
    "cloudScanCount" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "lastRebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceUsageSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AxiomAutopilotEvent" (
    "id" TEXT NOT NULL,
    "cloudAccountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousMode" "AutopilotMode",
    "newMode" "AutopilotMode",
    "runId" TEXT,
    "actionType" "ActionType",
    "riskLevel" "RiskLevel",
    "disposition" "ActionDisposition",
    "resourceIds" JSONB,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AxiomAutopilotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'read_only',
    "providerScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "invitedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantIdentityProvider" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "protocol" "IdentityProviderProtocol" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "issuerOrEntityId" TEXT NOT NULL,
    "metadataDocument" TEXT NOT NULL,
    "managedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roleMappingJson" JSONB NOT NULL,
    "requireMfaClaim" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAssertionAt" TIMESTAMP(3),
    "configuredByUserId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantIdentityProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScimProvisionedIdentity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "orgMembershipId" TEXT,
    "scimActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprovisionedAt" TIMESTAMP(3),

    CONSTRAINT "ScimProvisionedIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConversationTurn" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "actionProposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentConversationTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentActionProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "argsJson" JSONB NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvalExpiresAt" TIMESTAMP(3),
    "actionDigest" TEXT,

    CONSTRAINT "AgentActionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DurableAgentWorkflow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowKind" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "autonomyLevel" TEXT NOT NULL,
    "currentStep" TEXT,
    "inputJson" JSONB NOT NULL,
    "stateJson" JSONB NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "approvalProposalId" TEXT,
    "pauseReason" TEXT,
    "failureCode" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DurableAgentWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DurableAgentWorkflowEvent" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorId" TEXT,
    "detailJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DurableAgentWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentWorkspaceMemory" (
    "organizationId" TEXT NOT NULL,
    "repositoryFullNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "environmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentWorkspaceMemory_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "AxiomApprovalPolicy" (
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
CREATE TABLE "AxiomApprovalChain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "approvalItemId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" "ApprovalChainStatus" NOT NULL DEFAULT 'pending_approvals',
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
CREATE TABLE "AxiomApprovalVote" (
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
CREATE TABLE "AxiomRbacAuditEvent" (
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
CREATE TABLE "SecureAuditRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorKind" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "entityRef" TEXT,
    "correlationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "detail" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecureAuditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalMemoryRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT,
    "resources" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "outcome" TEXT NOT NULL,
    "impact" JSONB NOT NULL,
    "links" JSONB NOT NULL,
    "nextAction" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalMemoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopSessionRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "desktopVersion" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopSessionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopPairingChallengeRecord" (
    "id" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "desktopVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedByUserId" TEXT,
    "approvedOrganizationId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "DesktopPairingChallengeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopHandoffRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "executionPlanId" TEXT NOT NULL,
    "approver" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "manifest" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "preparedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesktopHandoffRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationTraceSpan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "status" TEXT NOT NULL,
    "attributes" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationTraceSpan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundNotificationRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "channelsSucceeded" TEXT[],
    "channelsSkipped" TEXT[],
    "evidenceRefs" TEXT[],
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundNotificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundNotificationRetry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "evidenceRefs" TEXT[],
    "safeActionLabel" TEXT,
    "safeActionHref" TEXT,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retriedAt" TIMESTAMP(3),

    CONSTRAINT "OutboundNotificationRetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpQueryRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "query" TEXT NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "primaryEntryId" TEXT,
    "topHitScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpQueryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFeatureFlag" (
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "rationale" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantFeatureFlag_pkey" PRIMARY KEY ("organizationId","key")
);

-- CreateTable
CREATE TABLE "AutonomyDecisionRationale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cycleId" TEXT,
    "candidateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "charterMode" TEXT NOT NULL,
    "boundaryClass" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "haltedAtStage" TEXT,
    "haltReason" TEXT,
    "proposedIntent" TEXT NOT NULL,
    "stages" JSONB NOT NULL,
    "evidenceRefs" TEXT[],
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutonomyDecisionRationale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagedRemediationRunbook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runbookId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "affectedResource" TEXT NOT NULL,
    "reversalLabel" TEXT NOT NULL,
    "reversalRisk" TEXT NOT NULL,
    "reversalApi" TEXT,
    "hardeningLabel" TEXT NOT NULL,
    "hardeningApi" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidenceRefs" TEXT[],
    "status" TEXT NOT NULL,
    "decision" TEXT,
    "stagedBy" TEXT,
    "stagedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,

    CONSTRAINT "StagedRemediationRunbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentBusMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "threadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentBusMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorAgent" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "proposedDiff" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MethodProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUsageCounter" (
    "organizationId" TEXT NOT NULL,
    "capName" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantUsageCounter_pkey" PRIMARY KEY ("organizationId","capName","dateKey")
);

-- CreateTable
CREATE TABLE "TenantBillingPlan" (
    "organizationId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "seatQuantity" INTEGER,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "lastStripeEventId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantBillingPlan_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "AIUsageBillingConfig" (
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "monthlySpendLimitCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageBillingConfig_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "AIUsageBillingSettlement" (
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
CREATE TABLE "AIUsageBillingPeriod" (
    "organizationId" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "limitCents" INTEGER NOT NULL,
    "reservedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIUsageBillingPeriod_pkey" PRIMARY KEY ("organizationId","periodMonth")
);

-- CreateTable
CREATE TABLE "FeedbackRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "email" TEXT,
    "sentiment" TEXT NOT NULL,
    "pagePath" TEXT,
    "message" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "routePath" TEXT NOT NULL,
    "requestBodyHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_flight',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationBudgetConfig" (
    "organizationId" TEXT NOT NULL,
    "defaultMaxCostCents" INTEGER,
    "pipelineOverrides" JSONB NOT NULL DEFAULT '[]',
    "rationale" TEXT,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBudgetConfig_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "OrganizationAIProviderPolicy" (
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedProviders" JSONB NOT NULL DEFAULT '[]',
    "modelSelections" JSONB NOT NULL DEFAULT '{}',
    "fallbackOrder" JSONB NOT NULL DEFAULT '[]',
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAIProviderPolicy_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "env" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSigningKey" (
    "id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "privateKeyPem" TEXT NOT NULL,
    "publicKeyPem" TEXT NOT NULL,
    "publicJwk" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "WebhookSigningKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "signingMode" TEXT NOT NULL DEFAULT 'hmac',
    "subscribedEvents" JSONB NOT NULL,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "autoDisableThreshold" INTEGER NOT NULL DEFAULT 50,
    "createdBy" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "outcomeKind" TEXT,
    "httpStatus" INTEGER,
    "responseBodySnippet" TEXT,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "payload" JSONB NOT NULL,
    "requestHeaders" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorSetupSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "ConnectorSetupStatus" NOT NULL DEFAULT 'not_connected',
    "lastEventKind" TEXT,
    "lastErrorCode" TEXT,
    "firstConnectedAt" TIMESTAMP(3),
    "lastTransitionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorSetupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorSetupTransition" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromStatus" "ConnectorSetupStatus" NOT NULL,
    "toStatus" "ConnectorSetupStatus" NOT NULL,
    "eventKind" TEXT NOT NULL,
    "isLegal" BOOLEAN NOT NULL,
    "rejectionReason" TEXT,
    "eventPayload" JSONB,
    "actorUserId" TEXT,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorSetupTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEscalationSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "signalRef" TEXT NOT NULL,
    "status" "AlertEscalationStatus" NOT NULL DEFAULT 'quiet',
    "lastEventKind" TEXT,
    "firstFiredAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByUserId" TEXT,
    "snoozedUntilAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "lastTransitionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertEscalationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEscalationTransition" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromStatus" "AlertEscalationStatus" NOT NULL,
    "toStatus" "AlertEscalationStatus" NOT NULL,
    "eventKind" TEXT NOT NULL,
    "isLegal" BOOLEAN NOT NULL,
    "rejectionReason" TEXT,
    "eventPayload" JSONB,
    "actorUserId" TEXT,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEscalationTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerTeamLabel" TEXT,
    "businessTier" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ComponentKind" NOT NULL,
    "repositoryId" TEXT,
    "dependsOnIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownerTeamLabel" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "GitProvider" NOT NULL,
    "remoteOwner" TEXT NOT NULL,
    "remoteName" TEXT NOT NULL,
    "remoteUrl" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "protectedBranches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "codeownersPresent" BOOLEAN NOT NULL DEFAULT false,
    "prTemplatePresent" BOOLEAN NOT NULL DEFAULT false,
    "repoFlavor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "EnvironmentTier" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "changeWindowRuleJson" JSONB,
    "approvalPolicyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentTarget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aws',
    "roleArn" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "ecsCluster" TEXT NOT NULL,
    "ecsService" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentExecution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "environmentId" TEXT NOT NULL,
    "repositoryFullName" TEXT NOT NULL,
    "sourceRef" TEXT,
    "sourceKind" TEXT,
    "sourceCommitSha" TEXT,
    "branchPolicyId" TEXT,
    "promotedFromExecutionId" TEXT,
    "pullRequestUrl" TEXT,
    "workflowRunId" TEXT,
    "workflowUrl" TEXT,
    "source" TEXT NOT NULL,
    "triggeredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "conclusion" TEXT,
    "rollbackStatus" TEXT NOT NULL DEFAULT 'not_started',
    "lastObservedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchEnvironmentPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "branchPattern" TEXT NOT NULL,
    "requireReleaseTag" BOOLEAN NOT NULL DEFAULT false,
    "requireCodeowners" BOOLEAN NOT NULL DEFAULT false,
    "requirePrLink" BOOLEAN NOT NULL DEFAULT false,
    "requireChangeTicket" BOOLEAN NOT NULL DEFAULT false,
    "requirePromotionFromEnvironmentId" TEXT,
    "requireTestsPassing" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchEnvironmentPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "targetEnvironmentId" TEXT,
    "releaseTag" TEXT,
    "commitSha" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scopeFinalizedAt" TIMESTAMP(3),
    "scopeFinalizedByUserId" TEXT,
    "rollbackReferenceReleaseId" TEXT,
    "plannedWindowStart" TIMESTAMP(3),
    "plannedWindowEnd" TIMESTAMP(3),
    "actualDeployStart" TIMESTAMP(3),
    "actualDeployEnd" TIMESTAMP(3),
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "evidenceRepositoryId" TEXT,
    "evidenceRepositoryBoundAt" TIMESTAMP(3),
    "evidenceRepositoryBoundByUserId" TEXT,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseReadinessSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchGovernance" INTEGER NOT NULL,
    "changeCompliance" INTEGER NOT NULL,
    "artifactTraceability" INTEGER NOT NULL,
    "secretTraceability" INTEGER NOT NULL,
    "rollbackReadiness" INTEGER NOT NULL,
    "communicationReadiness" INTEGER NOT NULL,
    "driftRisk" INTEGER NOT NULL,
    "manualReconciliation" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "blockersJson" JSONB NOT NULL,
    "evaluationSource" TEXT NOT NULL,

    CONSTRAINT "ReleaseReadinessSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseEvidencePack" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "contentJson" JSONB NOT NULL,
    "exportRefsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseEvidencePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "exceptionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "approverRole" TEXT,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "autoRemediationKey" TEXT,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'seed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyViolation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',
    "message" TEXT NOT NULL,
    "remediation" TEXT,
    "exceptionGrantedByUserId" TEXT,
    "exceptionGrantedAt" TIMESTAMP(3),
    "contextJson" JSONB,

    CONSTRAINT "PolicyViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "targetsJson" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInPostDraft" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL,
    "targetAudience" TEXT,
    "status" TEXT NOT NULL DEFAULT 'drafted',
    "confidence" DOUBLE PRECISION,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "linkedinPostUrn" TEXT,
    "linkedinPostUrl" TEXT,
    "createdByAgent" TEXT NOT NULL DEFAULT 'marketingContentDrafter',
    "approvedByEmail" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "performanceNotes" TEXT,
    "imageUrl" TEXT,
    "imageUrn" TEXT,
    "imagePrompt" TEXT,
    "hallucinationScore" DOUBLE PRECISION,
    "hallucinationNotes" TEXT,
    "autopilotEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInPostDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthAutopilotDecision" (
    "id" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decision" TEXT NOT NULL,
    "draftId" TEXT,
    "draftsConsidered" INTEGER NOT NULL DEFAULT 0,
    "bestConfidence" DOUBLE PRECISION,
    "bestHallucinationScore" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "reason" TEXT,
    "detail" JSONB,

    CONSTRAINT "GrowthAutopilotDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInAccountConnection" (
    "id" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "linkedinUrn" TEXT NOT NULL,
    "linkedinName" TEXT,
    "organizationUrn" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scopes" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInAccountConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInPostPublishRun" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "linkedinPostUrn" TEXT,
    "httpStatus" INTEGER,
    "errorDetail" TEXT,
    "diagnosticsJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LinkedInPostPublishRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInPostAnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reactions" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER,
    "manualEntry" BOOLEAN NOT NULL DEFAULT false,
    "enteredByEmail" TEXT,
    "notes" TEXT,

    CONSTRAINT "LinkedInPostAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthAuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetKind" TEXT,
    "targetId" TEXT,
    "detail" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PullRequestRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "commitShaHead" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3),
    "mergedByUserId" TEXT,
    "linkedStories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedTickets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvalsRequiredCount" INTEGER NOT NULL DEFAULT 0,
    "approvalsObservedCount" INTEGER NOT NULL DEFAULT 0,
    "codeownersApproved" BOOLEAN NOT NULL DEFAULT false,
    "ciStatus" TEXT NOT NULL DEFAULT 'not_run',
    "webUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseTagRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taggerUserId" TEXT,
    "prListJson" JSONB,
    "commitListJson" JSONB,
    "diffAgainstPreviousProdJson" JSONB,
    "notes" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseTagRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRunRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "externalRunId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "conclusion" TEXT,
    "runKind" TEXT NOT NULL DEFAULT 'other',
    "commitSha" TEXT,
    "ref" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "webUrl" TEXT,
    "artifactsJson" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRunRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CherryPickException" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "rationale" TEXT NOT NULL,
    "approvedPrIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedPrIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasFinalCommitValidation" BOOLEAN NOT NULL DEFAULT false,
    "requestedByUserId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CherryPickException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeTicket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "ticketType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assigneeUserId" TEXT,
    "reporterUserId" TEXT,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "webUrl" TEXT,
    "linkedPrRecordIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkedReleaseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriftFinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resourceKind" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "applicationId" TEXT,
    "environmentTier" TEXT,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "summary" TEXT NOT NULL,
    "declaredJson" JSONB,
    "observedJson" JSONB,
    "remediationKey" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriftFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualFix" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "environmentTier" TEXT NOT NULL DEFAULT 'prod',
    "fixedAtIso" TIMESTAMP(3) NOT NULL,
    "loggedByUserId" TEXT NOT NULL,
    "reconciledByUserId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciliationRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualFix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'ok',
    "summary" TEXT NOT NULL,
    "detailJson" JSONB,
    "actorUserId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackNotificationConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "enabledSignalKindsJson" JSONB,
    "defaultChannel" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackNotificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackNotificationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "signalKind" TEXT NOT NULL,
    "subjectKind" TEXT,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'sent',
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "payloadJson" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorCouncilDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "consensusKind" TEXT NOT NULL,
    "agreementScore" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "votesJson" JSONB NOT NULL,
    "voterCount" INTEGER NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "overrideKind" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorCouncilDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRationaleEnrichment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL DEFAULT 'council',
    "targetId" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "riskFactorsJson" JSONB NOT NULL,
    "nextActionsJson" JSONB NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'ai_generated',
    "errorMessage" TEXT,
    "modelHint" TEXT,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRationaleEnrichment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMemorySummaryLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetKind" TEXT,
    "narrative" TEXT NOT NULL,
    "themesJson" JSONB NOT NULL,
    "notableEntriesJson" JSONB NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'ai_generated',
    "errorMessage" TEXT,
    "modelHint" TEXT,
    "windowSize" INTEGER NOT NULL,
    "aiAvailabilityPct" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMemorySummaryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProactiveAgiSuggestion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "targetKind" TEXT,
    "targetId" TEXT,
    "confidence" INTEGER NOT NULL,
    "citationsJson" JSONB NOT NULL,
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'ai_generated',
    "errorMessage" TEXT,
    "modelHint" TEXT,
    "engineVersion" TEXT NOT NULL,
    "windowSize" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProactiveAgiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMemoryChatTurn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "citationsJson" JSONB NOT NULL,
    "citationDetailsJson" JSONB,
    "outcome" TEXT NOT NULL DEFAULT 'ai_generated',
    "errorMessage" TEXT,
    "modelHint" TEXT,
    "contextEntriesCount" INTEGER NOT NULL,
    "contextSummariesCount" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMemoryChatTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCallLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "engineName" TEXT NOT NULL,
    "model" TEXT,
    "outcome" TEXT NOT NULL,
    "errorMessage" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomousTickLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "totalRuns" INTEGER NOT NULL,
    "okRuns" INTEGER NOT NULL,
    "errorRuns" INTEGER NOT NULL,
    "skippedRuns" INTEGER NOT NULL,
    "reportJson" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutonomousTickLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "triageId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "prerequisitesJson" JSONB NOT NULL,
    "expectedImpact" TEXT NOT NULL,
    "rollbackPlan" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "reversible" BOOLEAN NOT NULL DEFAULT true,
    "rationale" TEXT NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "linkedManualFixId" TEXT,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemediationProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentTriage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "suggestedOwnerTeam" TEXT NOT NULL,
    "estimatedTimeToMitigateMinutes" INTEGER NOT NULL,
    "recommendedRunbook" TEXT,
    "autoEscalate" BOOLEAN NOT NULL DEFAULT false,
    "confidence" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "overridePriority" TEXT,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentTriage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "suggestedRuleKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "evidenceJson" JSONB NOT NULL,
    "suggestedRuleBodyJson" JSONB NOT NULL,
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "acceptedRuleId" TEXT,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorRecommendation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "suggestedActionsJson" JSONB NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "inputsJson" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubInstallation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "githubInstallationId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "repositorySelection" TEXT NOT NULL DEFAULT 'selected',
    "status" TEXT NOT NULL DEFAULT 'active',
    "sourceFlow" TEXT NOT NULL DEFAULT 'install',
    "installedByUserId" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "rawCallbackJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantIntegrationConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "encryptedCredential" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "scopesJson" JSONB,
    "consentedByUserId" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastValidatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantIntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirflowAutomation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dagId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerMode" TEXT NOT NULL,
    "scheduleCron" TEXT,
    "requiredDagState" TEXT NOT NULL DEFAULT 'success',
    "dependencyDagIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actionType" TEXT NOT NULL,
    "repositoryFullName" TEXT,
    "sourceRef" TEXT,
    "sourceKind" TEXT DEFAULT 'branch',
    "pullRequestBase" TEXT,
    "pullRequestTitle" TEXT,
    "environmentId" TEXT,
    "promotedFromExecutionId" TEXT,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryDelaySeconds" INTEGER NOT NULL DEFAULT 60,
    "notifyOnSuccess" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnFailure" BOOLEAN NOT NULL DEFAULT true,
    "lastEvaluatedAt" TIMESTAMP(3),
    "nextScheduledAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirflowAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirflowAutomationExecution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "sourceDagId" TEXT NOT NULL,
    "sourceDagRunId" TEXT NOT NULL,
    "sourceDagState" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "resultJson" JSONB,
    "deploymentExecutionId" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rollbackStatus" TEXT NOT NULL DEFAULT 'not_required',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirflowAutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirflowDagRunSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "dagId" TEXT NOT NULL,
    "dagRunId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "logicalDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirflowDagRunSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantIntegrationAuthorizationAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "stateDigest" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "encryptedPkceVerifier" TEXT,
    "initiatedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantIntegrationAuthorizationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "manualFixId" TEXT,
    "reportedByUserId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mitigatedByUserId" TEXT,
    "mitigatedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseNotesDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "bulletsJson" JSONB NOT NULL,
    "headline" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseNotesDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchProtectionSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "requiresPullRequest" BOOLEAN NOT NULL,
    "requiredReviewCount" INTEGER NOT NULL DEFAULT 0,
    "dismissStaleReviews" BOOLEAN NOT NULL DEFAULT false,
    "requireCodeOwnerReviews" BOOLEAN NOT NULL DEFAULT false,
    "requiresStatusChecks" BOOLEAN NOT NULL DEFAULT false,
    "requiredStatusCheckContexts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiresSignedCommits" BOOLEAN NOT NULL DEFAULT false,
    "requiresLinearHistory" BOOLEAN NOT NULL DEFAULT false,
    "enforceAdmins" BOOLEAN NOT NULL DEFAULT false,
    "allowsForcePushes" BOOLEAN NOT NULL DEFAULT false,
    "allowsDeletions" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'github_api',
    "rawJson" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchProtectionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundWebhookDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "eventAction" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'accepted',
    "summary" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TauriDeploymentRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "correlationId" TEXT NOT NULL,
    "intakeJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TauriDeploymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TauriDeploymentRequestVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deploymentRequestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "intakeJson" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TauriDeploymentRequestVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TauriPlaybook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deploymentRequestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "playbookJson" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TauriPlaybook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TauriAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deploymentRequestId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValueJson" JSONB,
    "newValueJson" JSONB,
    "source" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "evidenceLink" TEXT,
    "timeZone" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TauriAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TauriDeploymentOperation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deploymentRequestId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "contextDigest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "externalReference" TEXT,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TauriDeploymentOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'detected',
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectedByUserId" TEXT,
    "affectedOrganizationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mitigatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "postmortemCompletedAt" TIMESTAMP(3),
    "postmortemUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformGithubAppCredential" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL DEFAULT 'platform_github_app',
    "appId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "encryptedClientSecret" TEXT NOT NULL,
    "encryptedWebhookSecret" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "PlatformGithubAppCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoundingSupporterPurchase" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "publicName" TEXT,
    "recognitionConsent" BOOLEAN NOT NULL DEFAULT false,
    "updatesOptIn" BOOLEAN NOT NULL DEFAULT false,
    "amountCents" INTEGER NOT NULL,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "badgeIssuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "confirmationEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoundingSupporterPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupporterStripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupporterStripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcsReleaseReviewPacket" (
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
CREATE TABLE "EcsReleaseReviewDecision" (
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
CREATE TABLE "EcsReleaseReviewCheckpoint" (
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

-- CreateTable
CREATE TABLE "BotTaskDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "instruction" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "initialContentHash" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotTaskDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotTaskDraftEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotTaskDraftEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotTaskRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskVersion" INTEGER NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "intentHash" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "snapshotDigest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL,
    "storedBytes" INTEGER NOT NULL,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotTaskRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotTaskRunEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotTaskRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotTaskArtifact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "snapshotDigest" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotTaskArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotAiTaskRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskVersion" INTEGER NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "dispatchClaimedAt" TIMESTAMP(3),
    "usageReceiptId" TEXT,
    "intentHash" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "snapshotDigest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL,
    "storedBytes" INTEGER NOT NULL,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotAiTaskRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotAiTaskEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotAiTaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotAiTaskArtifact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "snapshotDigest" TEXT NOT NULL,
    "usageReceiptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotAiTaskArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotPullRequestEvidenceRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskVersion" INTEGER NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "intentHash" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "snapshotDigest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL,
    "storedBytes" INTEGER NOT NULL,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotPullRequestEvidenceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotPullRequestEvidenceEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotPullRequestEvidenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotPullRequestEvidenceArtifact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "snapshotDigest" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotPullRequestEvidenceArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GcpGuidedAuthorization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "stateDigest" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "encryptedVerifier" TEXT NOT NULL,
    "encryptedTokens" TEXT,
    "resourcesJson" JSONB,
    "connectionId" TEXT,
    "connectionVersion" INTEGER,
    "operationExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GcpGuidedAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwsGuidedConnectionFlow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'review',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "connectionJson" JSONB,
    "inputJson" JSONB NOT NULL,
    "sealedChallenge" TEXT NOT NULL,
    "callbackDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwsGuidedConnectionFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AzureGuidedAuthorization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'authorization',
    "stateDigest" TEXT NOT NULL,
    "nonceDigest" TEXT NOT NULL,
    "configurationDigest" TEXT NOT NULL,
    "encryptedVerifier" TEXT NOT NULL,
    "encryptedTokens" TEXT,
    "resourcesJson" JSONB,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "operationExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "connectionId" TEXT,
    "connectionVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AzureGuidedAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_userId_idx" ON "Lead"("userId");

-- CreateIndex
CREATE INDEX "AxiomScoreSnapshot_leadId_idx" ON "AxiomScoreSnapshot"("leadId");

-- CreateIndex
CREATE INDEX "SalesPipelineSnapshot_createdAt_idx" ON "SalesPipelineSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "RecurringAnalysis_leadId_idx" ON "RecurringAnalysis"("leadId");

-- CreateIndex
CREATE INDEX "RecurringAnalysis_nextRunAt_idx" ON "RecurringAnalysis"("nextRunAt");

-- CreateIndex
CREATE INDEX "RecurringAnalysis_jobType_idx" ON "RecurringAnalysis"("jobType");

-- CreateIndex
CREATE INDEX "ExecutionLog_userId_idx" ON "ExecutionLog"("userId");

-- CreateIndex
CREATE INDEX "ExecutionLog_projectId_idx" ON "ExecutionLog"("projectId");

-- CreateIndex
CREATE INDEX "ExecutionLog_leadId_idx" ON "ExecutionLog"("leadId");

-- CreateIndex
CREATE INDEX "ExecutionLog_executedAt_idx" ON "ExecutionLog"("executedAt");

-- CreateIndex
CREATE INDEX "AIInvocation_userId_idx" ON "AIInvocation"("userId");

-- CreateIndex
CREATE INDEX "AIInvocation_taskType_idx" ON "AIInvocation"("taskType");

-- CreateIndex
CREATE INDEX "AIInvocation_createdAt_idx" ON "AIInvocation"("createdAt");

-- CreateIndex
CREATE INDEX "AgentJob_status_idx" ON "AgentJob"("status");

-- CreateIndex
CREATE INDEX "AgentJob_runAt_idx" ON "AgentJob"("runAt");

-- CreateIndex
CREATE INDEX "AgentJob_leadId_idx" ON "AgentJob"("leadId");

-- CreateIndex
CREATE INDEX "AuditLog_leadId_idx" ON "AuditLog"("leadId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "MultiCloudReadinessReport_leadId_idx" ON "MultiCloudReadinessReport"("leadId");

-- CreateIndex
CREATE INDEX "MultiCloudReadinessReport_userId_idx" ON "MultiCloudReadinessReport"("userId");

-- CreateIndex
CREATE INDEX "MultiCloudReadinessReport_createdAt_idx" ON "MultiCloudReadinessReport"("createdAt");

-- CreateIndex
CREATE INDEX "TerraformExecutionJob_leadId_idx" ON "TerraformExecutionJob"("leadId");

-- CreateIndex
CREATE INDEX "TerraformExecutionJob_userId_idx" ON "TerraformExecutionJob"("userId");

-- CreateIndex
CREATE INDEX "TerraformExecutionJob_status_idx" ON "TerraformExecutionJob"("status");

-- CreateIndex
CREATE INDEX "TerraformExecutionJob_createdAt_idx" ON "TerraformExecutionJob"("createdAt");

-- CreateIndex
CREATE INDEX "AxiomConversation_userId_idx" ON "AxiomConversation"("userId");

-- CreateIndex
CREATE INDEX "AxiomConversation_leadId_idx" ON "AxiomConversation"("leadId");

-- CreateIndex
CREATE INDEX "AxiomMessage_conversationId_idx" ON "AxiomMessage"("conversationId");

-- CreateIndex
CREATE INDEX "CloudAccount_organizationId_idx" ON "CloudAccount"("organizationId");

-- CreateIndex
CREATE INDEX "CloudAccount_provider_idx" ON "CloudAccount"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "CloudAccount_id_organizationId_key" ON "CloudAccount"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudAccount_organizationId_provider_externalAccountId_key" ON "CloudAccount"("organizationId", "provider", "externalAccountId");

-- CreateIndex
CREATE INDEX "CloudAccountCredential_organizationId_idx" ON "CloudAccountCredential"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudAccountCredential_id_organizationId_key" ON "CloudAccountCredential"("id", "organizationId");

-- CreateIndex
CREATE INDEX "CloudAccountEnrollmentAttempt_organizationId_userId_expires_idx" ON "CloudAccountEnrollmentAttempt"("organizationId", "userId", "expiresAt");

-- CreateIndex
CREATE INDEX "CloudAccountEnrollmentAttempt_cloudAccountId_organizationId_idx" ON "CloudAccountEnrollmentAttempt"("cloudAccountId", "organizationId");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_userId_idx" ON "AxiomAgentRun"("userId");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_organizationId_idx" ON "AxiomAgentRun"("organizationId");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_cloudAccountId_idx" ON "AxiomAgentRun"("cloudAccountId");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_status_idx" ON "AxiomAgentRun"("status");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_trigger_idx" ON "AxiomAgentRun"("trigger");

-- CreateIndex
CREATE INDEX "AxiomAgentRun_createdAt_idx" ON "AxiomAgentRun"("createdAt");

-- CreateIndex
CREATE INDEX "AxiomFinding_runId_idx" ON "AxiomFinding"("runId");

-- CreateIndex
CREATE INDEX "AxiomFinding_category_idx" ON "AxiomFinding"("category");

-- CreateIndex
CREATE INDEX "AxiomFinding_severity_idx" ON "AxiomFinding"("severity");

-- CreateIndex
CREATE INDEX "AxiomRecommendation_runId_idx" ON "AxiomRecommendation"("runId");

-- CreateIndex
CREATE INDEX "AxiomRecommendation_disposition_idx" ON "AxiomRecommendation"("disposition");

-- CreateIndex
CREATE INDEX "AxiomRecommendation_actionType_idx" ON "AxiomRecommendation"("actionType");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomExecutionPlan_runId_key" ON "AxiomExecutionPlan"("runId");

-- CreateIndex
CREATE INDEX "AxiomExecutionPlan_runId_idx" ON "AxiomExecutionPlan"("runId");

-- CreateIndex
CREATE INDEX "AxiomExecutionPlanItem_planId_idx" ON "AxiomExecutionPlanItem"("planId");

-- CreateIndex
CREATE INDEX "AxiomExecutionPlanItem_disposition_idx" ON "AxiomExecutionPlanItem"("disposition");

-- CreateIndex
CREATE INDEX "AxiomApprovalRequest_runId_idx" ON "AxiomApprovalRequest"("runId");

-- CreateIndex
CREATE INDEX "AxiomApprovalRequest_userId_idx" ON "AxiomApprovalRequest"("userId");

-- CreateIndex
CREATE INDEX "AxiomApprovalItem_organizationId_status_idx" ON "AxiomApprovalItem"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AxiomApprovalItem_status_idx" ON "AxiomApprovalItem"("status");

-- CreateIndex
CREATE INDEX "AxiomApprovalItem_runId_idx" ON "AxiomApprovalItem"("runId");

-- CreateIndex
CREATE INDEX "AxiomApprovalItem_snoozedUntil_idx" ON "AxiomApprovalItem"("snoozedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomApprovalItem_runId_planItemId_key" ON "AxiomApprovalItem"("runId", "planItemId");

-- CreateIndex
CREATE INDEX "AxiomAuditEvent_runId_idx" ON "AxiomAuditEvent"("runId");

-- CreateIndex
CREATE INDEX "AxiomAuditEvent_userId_idx" ON "AxiomAuditEvent"("userId");

-- CreateIndex
CREATE INDEX "AxiomAuditEvent_organizationId_idx" ON "AxiomAuditEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AxiomAuditEvent_provider_status_idx" ON "AxiomAuditEvent"("provider", "status");

-- CreateIndex
CREATE INDEX "AxiomAuditEvent_createdAt_idx" ON "AxiomAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AxiomScheduledRun_organizationId_idx" ON "AxiomScheduledRun"("organizationId");

-- CreateIndex
CREATE INDEX "AxiomScheduledRun_cloudAccountId_idx" ON "AxiomScheduledRun"("cloudAccountId");

-- CreateIndex
CREATE INDEX "AxiomScheduledRun_nextRunAt_enabled_idx" ON "AxiomScheduledRun"("nextRunAt", "enabled");

-- CreateIndex
CREATE INDEX "AxiomNotification_organizationId_idx" ON "AxiomNotification"("organizationId");

-- CreateIndex
CREATE INDEX "AxiomNotification_userId_read_idx" ON "AxiomNotification"("userId", "read");

-- CreateIndex
CREATE INDEX "AxiomNotification_createdAt_idx" ON "AxiomNotification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomOrgPreferences_organizationId_key" ON "AxiomOrgPreferences"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomAgentTask_idempotencyKey_key" ON "AxiomAgentTask"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AxiomAgentTask_agentRunId_idx" ON "AxiomAgentTask"("agentRunId");

-- CreateIndex
CREATE INDEX "AxiomAgentTask_status_idx" ON "AxiomAgentTask"("status");

-- CreateIndex
CREATE INDEX "AxiomAgentTask_taskType_idx" ON "AxiomAgentTask"("taskType");

-- CreateIndex
CREATE INDEX "AxiomAgentTask_agentRunId_sortOrder_idx" ON "AxiomAgentTask"("agentRunId", "sortOrder");

-- CreateIndex
CREATE INDEX "AgentEngineerRecord_organizationId_isEnabled_idx" ON "AgentEngineerRecord"("organizationId", "isEnabled");

-- CreateIndex
CREATE INDEX "AgentEngineerRecord_organizationId_createdAt_idx" ON "AgentEngineerRecord"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentEngineerRecord_organizationId_engineerId_key" ON "AgentEngineerRecord"("organizationId", "engineerId");

-- CreateIndex
CREATE INDEX "AgentEngineerActionAttempt_organizationId_createdAt_idx" ON "AgentEngineerActionAttempt"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentEngineerActionAttempt_recordId_createdAt_idx" ON "AgentEngineerActionAttempt"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentEngineerActionAttempt_organizationId_runtimeDecision_c_idx" ON "AgentEngineerActionAttempt"("organizationId", "runtimeDecision", "createdAt");

-- CreateIndex
CREATE INDEX "AgentEngineerActionAttempt_correlationId_idx" ON "AgentEngineerActionAttempt"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "EngineerApprovalSnapshot_approvalRequestId_key" ON "EngineerApprovalSnapshot"("approvalRequestId");

-- CreateIndex
CREATE INDEX "EngineerApprovalSnapshot_organizationId_status_createdAt_idx" ON "EngineerApprovalSnapshot"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EngineerApprovalSnapshot_organizationId_engineerId_createdA_idx" ON "EngineerApprovalSnapshot"("organizationId", "engineerId", "createdAt");

-- CreateIndex
CREATE INDEX "EngineerApprovalSnapshot_organizationId_executionStatus_idx" ON "EngineerApprovalSnapshot"("organizationId", "executionStatus");

-- CreateIndex
CREATE INDEX "EngineerApprovalSnapshot_correlationId_idx" ON "EngineerApprovalSnapshot"("correlationId");

-- CreateIndex
CREATE INDEX "EngineerApprovalSnapshot_pipelineStageRunId_idx" ON "EngineerApprovalSnapshot"("pipelineStageRunId");

-- CreateIndex
CREATE INDEX "EngineerApprovalDecision_snapshotId_idx" ON "EngineerApprovalDecision"("snapshotId");

-- CreateIndex
CREATE INDEX "EngineerApprovalDecision_organizationId_decidedAt_idx" ON "EngineerApprovalDecision"("organizationId", "decidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EngineerApprovalDecision_snapshotId_approverUserId_key" ON "EngineerApprovalDecision"("snapshotId", "approverUserId");

-- CreateIndex
CREATE INDEX "PipelineRun_organizationId_pipelineId_startedAt_idx" ON "PipelineRun"("organizationId", "pipelineId", "startedAt");

-- CreateIndex
CREATE INDEX "PipelineRun_organizationId_status_startedAt_idx" ON "PipelineRun"("organizationId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "PipelineRun_correlationId_idx" ON "PipelineRun"("correlationId");

-- CreateIndex
CREATE INDEX "PipelineStageRun_runId_status_idx" ON "PipelineStageRun"("runId", "status");

-- CreateIndex
CREATE INDEX "PipelineStageRun_runId_costCents_idx" ON "PipelineStageRun"("runId", "costCents");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStageRun_runId_ordering_key" ON "PipelineStageRun"("runId", "ordering");

-- CreateIndex
CREATE UNIQUE INDEX "CodingTask_runId_key" ON "CodingTask"("runId");

-- CreateIndex
CREATE INDEX "CodingTask_organizationId_status_createdAt_idx" ON "CodingTask"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CodingTask_correlationId_idx" ON "CodingTask"("correlationId");

-- CreateIndex
CREATE INDEX "AIProviderRate_provider_modelId_effectiveFrom_idx" ON "AIProviderRate"("provider", "modelId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "AIProviderRate_isActive_idx" ON "AIProviderRate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_externalUsageId_key" ON "UsageEvent"("externalUsageId");

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_createdAt_idx" ON "UsageEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_eventKind_createdAt_idx" ON "UsageEvent"("organizationId", "eventKind", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_correlationId_idx" ON "UsageEvent"("correlationId");

-- CreateIndex
CREATE INDEX "UsageEvent_billingStatus_createdAt_idx" ON "UsageEvent"("billingStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageReservation_usageEventId_key" ON "AIUsageReservation"("usageEventId");

-- CreateIndex
CREATE INDEX "AIUsageReservation_organizationId_status_expiresAt_idx" ON "AIUsageReservation"("organizationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AIUsageReservation_correlationId_idx" ON "AIUsageReservation"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageReservation_organizationId_idempotencyKey_key" ON "AIUsageReservation"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AddOnPurchase_stripeCheckoutSessionId_key" ON "AddOnPurchase"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AddOnPurchase_stripePaymentIntentId_key" ON "AddOnPurchase"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "AddOnPurchase_organizationId_periodMonth_status_idx" ON "AddOnPurchase"("organizationId", "periodMonth", "status");

-- CreateIndex
CREATE INDEX "AddOnPurchase_organizationId_createdAt_idx" ON "AddOnPurchase"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AddOnPurchase_correlationId_idx" ON "AddOnPurchase"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "AddOnPurchase_organizationId_idempotencyKey_key" ON "AddOnPurchase"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "StripeBillingEvent_processedAt_idx" ON "StripeBillingEvent"("processedAt");

-- CreateIndex
CREATE INDEX "ComplianceControlCheckRun_controlId_checkedAt_idx" ON "ComplianceControlCheckRun"("controlId", "checkedAt");

-- CreateIndex
CREATE INDEX "EvalRun_runKind_startedAt_idx" ON "EvalRun"("runKind", "startedAt");

-- CreateIndex
CREATE INDEX "EvalRun_status_idx" ON "EvalRun"("status");

-- CreateIndex
CREATE INDEX "EvalCase_evalRunId_outcome_idx" ON "EvalCase"("evalRunId", "outcome");

-- CreateIndex
CREATE INDEX "EvalCase_taskKey_idx" ON "EvalCase"("taskKey");

-- CreateIndex
CREATE INDEX "BillingAlert_organizationId_createdAt_idx" ON "BillingAlert"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingAlert_periodMonth_idx" ON "BillingAlert"("periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAlert_organizationId_dimension_threshold_periodMonth_key" ON "BillingAlert"("organizationId", "dimension", "threshold", "periodMonth");

-- CreateIndex
CREATE INDEX "WorkspaceUsageSummary_periodMonth_idx" ON "WorkspaceUsageSummary"("periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceUsageSummary_organizationId_periodMonth_key" ON "WorkspaceUsageSummary"("organizationId", "periodMonth");

-- CreateIndex
CREATE INDEX "AxiomAutopilotEvent_cloudAccountId_idx" ON "AxiomAutopilotEvent"("cloudAccountId");

-- CreateIndex
CREATE INDEX "AxiomAutopilotEvent_organizationId_idx" ON "AxiomAutopilotEvent"("organizationId");

-- CreateIndex
CREATE INDEX "AxiomAutopilotEvent_eventType_idx" ON "AxiomAutopilotEvent"("eventType");

-- CreateIndex
CREATE INDEX "AxiomAutopilotEvent_createdAt_idx" ON "AxiomAutopilotEvent"("createdAt");

-- CreateIndex
CREATE INDEX "OrgMembership_organizationId_idx" ON "OrgMembership"("organizationId");

-- CreateIndex
CREATE INDEX "OrgMembership_userId_idx" ON "OrgMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMembership_userId_organizationId_key" ON "OrgMembership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "TenantIdentityProvider_organizationId_status_idx" ON "TenantIdentityProvider"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TenantIdentityProvider_issuerOrEntityId_idx" ON "TenantIdentityProvider"("issuerOrEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantIdentityProvider_organizationId_protocol_key" ON "TenantIdentityProvider"("organizationId", "protocol");

-- CreateIndex
CREATE INDEX "ScimProvisionedIdentity_organizationId_email_idx" ON "ScimProvisionedIdentity"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "ScimProvisionedIdentity_organizationId_externalId_key" ON "ScimProvisionedIdentity"("organizationId", "externalId");

-- CreateIndex
CREATE INDEX "AgentConversation_organizationId_userId_idx" ON "AgentConversation"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "AgentConversationTurn_conversationId_createdAt_idx" ON "AgentConversationTurn"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentActionProposal_organizationId_status_idx" ON "AgentActionProposal"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AgentActionProposal_organizationId_status_approvalExpiresAt_idx" ON "AgentActionProposal"("organizationId", "status", "approvalExpiresAt");

-- CreateIndex
CREATE INDEX "AgentActionProposal_conversationId_idx" ON "AgentActionProposal"("conversationId");

-- CreateIndex
CREATE INDEX "DurableAgentWorkflow_organizationId_status_updatedAt_idx" ON "DurableAgentWorkflow"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "DurableAgentWorkflow_status_nextAttemptAt_idx" ON "DurableAgentWorkflow"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "DurableAgentWorkflow_leaseExpiresAt_idx" ON "DurableAgentWorkflow"("leaseExpiresAt");

-- CreateIndex
CREATE INDEX "DurableAgentWorkflow_approvalProposalId_idx" ON "DurableAgentWorkflow"("approvalProposalId");

-- CreateIndex
CREATE INDEX "DurableAgentWorkflowEvent_organizationId_occurredAt_idx" ON "DurableAgentWorkflowEvent"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "DurableAgentWorkflowEvent_workflowRunId_occurredAt_idx" ON "DurableAgentWorkflowEvent"("workflowRunId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DurableAgentWorkflowEvent_workflowRunId_sequence_key" ON "DurableAgentWorkflowEvent"("workflowRunId", "sequence");

-- CreateIndex
CREATE INDEX "AgentSkillInstallation_organizationId_status_idx" ON "AgentSkillInstallation"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSkillInstallation_organizationId_skillId_key" ON "AgentSkillInstallation"("organizationId", "skillId");

-- CreateIndex
CREATE INDEX "AxiomApprovalPolicy_organizationId_enabled_idx" ON "AxiomApprovalPolicy"("organizationId", "enabled");

-- CreateIndex
CREATE INDEX "AxiomApprovalPolicy_priority_idx" ON "AxiomApprovalPolicy"("priority");

-- CreateIndex
CREATE INDEX "AxiomApprovalChain_organizationId_status_idx" ON "AxiomApprovalChain"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AxiomApprovalChain_approvalItemId_idx" ON "AxiomApprovalChain"("approvalItemId");

-- CreateIndex
CREATE INDEX "AxiomApprovalChain_expiresAt_idx" ON "AxiomApprovalChain"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomApprovalChain_approvalItemId_policyId_key" ON "AxiomApprovalChain"("approvalItemId", "policyId");

-- CreateIndex
CREATE INDEX "AxiomApprovalVote_chainId_idx" ON "AxiomApprovalVote"("chainId");

-- CreateIndex
CREATE INDEX "AxiomApprovalVote_userId_idx" ON "AxiomApprovalVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AxiomApprovalVote_chainId_userId_key" ON "AxiomApprovalVote"("chainId", "userId");

-- CreateIndex
CREATE INDEX "AxiomRbacAuditEvent_organizationId_createdAt_idx" ON "AxiomRbacAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AxiomRbacAuditEvent_actorId_idx" ON "AxiomRbacAuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "AxiomRbacAuditEvent_targetId_idx" ON "AxiomRbacAuditEvent"("targetId");

-- CreateIndex
CREATE INDEX "SecureAuditRecord_organizationId_occurredAt_idx" ON "SecureAuditRecord"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "SecureAuditRecord_action_idx" ON "SecureAuditRecord"("action");

-- CreateIndex
CREATE INDEX "SecureAuditRecord_correlationId_idx" ON "SecureAuditRecord"("correlationId");

-- CreateIndex
CREATE INDEX "OperationalMemoryRecord_organizationId_occurredAt_idx" ON "OperationalMemoryRecord"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "OperationalMemoryRecord_organizationId_kind_idx" ON "OperationalMemoryRecord"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "OperationalMemoryRecord_organizationId_outcome_idx" ON "OperationalMemoryRecord"("organizationId", "outcome");

-- CreateIndex
CREATE INDEX "DesktopSessionRecord_userId_idx" ON "DesktopSessionRecord"("userId");

-- CreateIndex
CREATE INDEX "DesktopSessionRecord_organizationId_idx" ON "DesktopSessionRecord"("organizationId");

-- CreateIndex
CREATE INDEX "DesktopSessionRecord_expiresAt_idx" ON "DesktopSessionRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "DesktopPairingChallengeRecord_expiresAt_idx" ON "DesktopPairingChallengeRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "DesktopPairingChallengeRecord_approvedByUserId_idx" ON "DesktopPairingChallengeRecord"("approvedByUserId");

-- CreateIndex
CREATE INDEX "DesktopPairingChallengeRecord_sessionId_idx" ON "DesktopPairingChallengeRecord"("sessionId");

-- CreateIndex
CREATE INDEX "DesktopHandoffRecord_organizationId_status_idx" ON "DesktopHandoffRecord"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DesktopHandoffRecord_userId_idx" ON "DesktopHandoffRecord"("userId");

-- CreateIndex
CREATE INDEX "DesktopHandoffRecord_expiresAt_idx" ON "DesktopHandoffRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "OperationTraceSpan_organizationId_traceId_idx" ON "OperationTraceSpan"("organizationId", "traceId");

-- CreateIndex
CREATE INDEX "OperationTraceSpan_organizationId_startedAt_idx" ON "OperationTraceSpan"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "OperationTraceSpan_traceId_idx" ON "OperationTraceSpan"("traceId");

-- CreateIndex
CREATE INDEX "OutboundNotificationRecord_organizationId_createdAt_idx" ON "OutboundNotificationRecord"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundNotificationRecord_organizationId_dedupeKey_created_idx" ON "OutboundNotificationRecord"("organizationId", "dedupeKey", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundNotificationRecord_dedupeKey_createdAt_idx" ON "OutboundNotificationRecord"("dedupeKey", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundNotificationRetry_status_enqueuedAt_idx" ON "OutboundNotificationRetry"("status", "enqueuedAt");

-- CreateIndex
CREATE INDEX "OutboundNotificationRetry_organizationId_status_idx" ON "OutboundNotificationRetry"("organizationId", "status");

-- CreateIndex
CREATE INDEX "HelpQueryRecord_createdAt_idx" ON "HelpQueryRecord"("createdAt");

-- CreateIndex
CREATE INDEX "HelpQueryRecord_verdict_createdAt_idx" ON "HelpQueryRecord"("verdict", "createdAt");

-- CreateIndex
CREATE INDEX "HelpQueryRecord_organizationId_createdAt_idx" ON "HelpQueryRecord"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "TenantFeatureFlag_organizationId_updatedAt_idx" ON "TenantFeatureFlag"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "AutonomyDecisionRationale_organizationId_createdAt_idx" ON "AutonomyDecisionRationale"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AutonomyDecisionRationale_organizationId_outcome_createdAt_idx" ON "AutonomyDecisionRationale"("organizationId", "outcome", "createdAt");

-- CreateIndex
CREATE INDEX "AutonomyDecisionRationale_candidateId_createdAt_idx" ON "AutonomyDecisionRationale"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "StagedRemediationRunbook_organizationId_status_stagedAt_idx" ON "StagedRemediationRunbook"("organizationId", "status", "stagedAt");

-- CreateIndex
CREATE INDEX "StagedRemediationRunbook_organizationId_runbookId_idx" ON "StagedRemediationRunbook"("organizationId", "runbookId");

-- CreateIndex
CREATE INDEX "AgentBusMessage_organizationId_createdAt_idx" ON "AgentBusMessage"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentBusMessage_threadId_createdAt_idx" ON "AgentBusMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentBusMessage_sender_createdAt_idx" ON "AgentBusMessage"("sender", "createdAt");

-- CreateIndex
CREATE INDEX "MethodProposal_organizationId_status_createdAt_idx" ON "MethodProposal"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MethodProposal_target_status_idx" ON "MethodProposal"("target", "status");

-- CreateIndex
CREATE INDEX "MethodProposal_authorAgent_createdAt_idx" ON "MethodProposal"("authorAgent", "createdAt");

-- CreateIndex
CREATE INDEX "TenantUsageCounter_organizationId_dateKey_idx" ON "TenantUsageCounter"("organizationId", "dateKey");

-- CreateIndex
CREATE INDEX "TenantBillingPlan_status_currentPeriodEndsAt_idx" ON "TenantBillingPlan"("status", "currentPeriodEndsAt");

-- CreateIndex
CREATE INDEX "TenantBillingPlan_tier_status_idx" ON "TenantBillingPlan"("tier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageBillingSettlement_usageEventId_key" ON "AIUsageBillingSettlement"("usageEventId");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageBillingSettlement_idempotencyKey_key" ON "AIUsageBillingSettlement"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageBillingSettlement_stripeInvoiceItemId_key" ON "AIUsageBillingSettlement"("stripeInvoiceItemId");

-- CreateIndex
CREATE INDEX "AIUsageBillingSettlement_organizationId_periodMonth_status_idx" ON "AIUsageBillingSettlement"("organizationId", "periodMonth", "status");

-- CreateIndex
CREATE INDEX "FeedbackRecord_createdAt_idx" ON "FeedbackRecord"("createdAt");

-- CreateIndex
CREATE INDEX "FeedbackRecord_sentiment_createdAt_idx" ON "FeedbackRecord"("sentiment", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackRecord_organizationId_createdAt_idx" ON "FeedbackRecord"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_organizationId_idempotencyKey_routePath_key" ON "IdempotencyRecord"("organizationId", "idempotencyKey", "routePath");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_prefix_idx" ON "ApiKey"("prefix");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_createdAt_idx" ON "ApiKey"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiKey_revokedAt_idx" ON "ApiKey"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookSigningKey_kid_key" ON "WebhookSigningKey"("kid");

-- CreateIndex
CREATE INDEX "WebhookSigningKey_status_idx" ON "WebhookSigningKey"("status");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_organizationId_createdAt_idx" ON "WebhookEndpoint"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_revokedAt_idx" ON "WebhookEndpoint"("revokedAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_attemptNumber_idx" ON "WebhookDelivery"("endpointId", "attemptNumber");

-- CreateIndex
CREATE INDEX "WebhookDelivery_organizationId_createdAt_idx" ON "WebhookDelivery"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_eventId_idx" ON "WebhookDelivery"("eventId");

-- CreateIndex
CREATE INDEX "ConnectorSetupSession_organizationId_idx" ON "ConnectorSetupSession"("organizationId");

-- CreateIndex
CREATE INDEX "ConnectorSetupSession_status_idx" ON "ConnectorSetupSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorSetupSession_organizationId_provider_key" ON "ConnectorSetupSession"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "ConnectorSetupTransition_sessionId_createdAt_idx" ON "ConnectorSetupTransition"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectorSetupTransition_isLegal_createdAt_idx" ON "ConnectorSetupTransition"("isLegal", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEscalationSession_organizationId_idx" ON "AlertEscalationSession"("organizationId");

-- CreateIndex
CREATE INDEX "AlertEscalationSession_status_idx" ON "AlertEscalationSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEscalationSession_organizationId_signalRef_key" ON "AlertEscalationSession"("organizationId", "signalRef");

-- CreateIndex
CREATE INDEX "AlertEscalationTransition_sessionId_createdAt_idx" ON "AlertEscalationTransition"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEscalationTransition_isLegal_createdAt_idx" ON "AlertEscalationTransition"("isLegal", "createdAt");

-- CreateIndex
CREATE INDEX "Application_organizationId_idx" ON "Application"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_organizationId_slug_key" ON "Application"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "Component_organizationId_idx" ON "Component"("organizationId");

-- CreateIndex
CREATE INDEX "Component_kind_idx" ON "Component"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Component_applicationId_slug_key" ON "Component"("applicationId", "slug");

-- CreateIndex
CREATE INDEX "Repository_organizationId_idx" ON "Repository"("organizationId");

-- CreateIndex
CREATE INDEX "Repository_provider_idx" ON "Repository"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_organizationId_provider_remoteOwner_remoteName_key" ON "Repository"("organizationId", "provider", "remoteOwner", "remoteName");

-- CreateIndex
CREATE INDEX "Environment_organizationId_idx" ON "Environment"("organizationId");

-- CreateIndex
CREATE INDEX "Environment_tier_idx" ON "Environment"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_organizationId_slug_key" ON "Environment"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentTarget_environmentId_key" ON "DeploymentTarget"("environmentId");

-- CreateIndex
CREATE INDEX "DeploymentTarget_organizationId_idx" ON "DeploymentTarget"("organizationId");

-- CreateIndex
CREATE INDEX "DeploymentExecution_organizationId_createdAt_idx" ON "DeploymentExecution"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "DeploymentExecution_organizationId_environmentId_createdAt_idx" ON "DeploymentExecution"("organizationId", "environmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentExecution_organizationId_idempotencyKey_key" ON "DeploymentExecution"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentExecution_organizationId_workflowRunId_key" ON "DeploymentExecution"("organizationId", "workflowRunId");

-- CreateIndex
CREATE INDEX "BranchEnvironmentPolicy_organizationId_idx" ON "BranchEnvironmentPolicy"("organizationId");

-- CreateIndex
CREATE INDEX "BranchEnvironmentPolicy_environmentId_idx" ON "BranchEnvironmentPolicy"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchEnvironmentPolicy_repositoryId_environmentId_branchPa_key" ON "BranchEnvironmentPolicy"("repositoryId", "environmentId", "branchPattern");

-- CreateIndex
CREATE INDEX "Release_organizationId_idx" ON "Release"("organizationId");

-- CreateIndex
CREATE INDEX "Release_applicationId_idx" ON "Release"("applicationId");

-- CreateIndex
CREATE INDEX "Release_status_idx" ON "Release"("status");

-- CreateIndex
CREATE INDEX "Release_targetEnvironmentId_idx" ON "Release"("targetEnvironmentId");

-- CreateIndex
CREATE INDEX "Release_evidenceRepositoryId_idx" ON "Release"("evidenceRepositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Release_organizationId_applicationId_releaseTag_key" ON "Release"("organizationId", "applicationId", "releaseTag");

-- CreateIndex
CREATE INDEX "ReleaseReadinessSnapshot_releaseId_evaluatedAt_idx" ON "ReleaseReadinessSnapshot"("releaseId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "ReleaseReadinessSnapshot_organizationId_evaluatedAt_idx" ON "ReleaseReadinessSnapshot"("organizationId", "evaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseEvidencePack_releaseId_key" ON "ReleaseEvidencePack"("releaseId");

-- CreateIndex
CREATE INDEX "ReleaseEvidencePack_organizationId_generatedAt_idx" ON "ReleaseEvidencePack"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "PolicyRule_organizationId_idx" ON "PolicyRule"("organizationId");

-- CreateIndex
CREATE INDEX "PolicyRule_severity_idx" ON "PolicyRule"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRule_organizationId_key_key" ON "PolicyRule"("organizationId", "key");

-- CreateIndex
CREATE INDEX "PolicyViolation_organizationId_status_idx" ON "PolicyViolation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PolicyViolation_releaseId_idx" ON "PolicyViolation"("releaseId");

-- CreateIndex
CREATE INDEX "PolicyViolation_ruleId_status_idx" ON "PolicyViolation"("ruleId", "status");

-- CreateIndex
CREATE INDEX "GrowthCampaign_status_idx" ON "GrowthCampaign"("status");

-- CreateIndex
CREATE INDEX "GrowthCampaign_startsAt_idx" ON "GrowthCampaign"("startsAt");

-- CreateIndex
CREATE INDEX "LinkedInPostDraft_status_idx" ON "LinkedInPostDraft"("status");

-- CreateIndex
CREATE INDEX "LinkedInPostDraft_scheduledFor_idx" ON "LinkedInPostDraft"("scheduledFor");

-- CreateIndex
CREATE INDEX "LinkedInPostDraft_campaignId_idx" ON "LinkedInPostDraft"("campaignId");

-- CreateIndex
CREATE INDEX "GrowthAutopilotDecision_ranAt_idx" ON "GrowthAutopilotDecision"("ranAt");

-- CreateIndex
CREATE INDEX "GrowthAutopilotDecision_decision_idx" ON "GrowthAutopilotDecision"("decision");

-- CreateIndex
CREATE INDEX "GrowthAutopilotDecision_draftId_idx" ON "GrowthAutopilotDecision"("draftId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInAccountConnection_ownerEmail_key" ON "LinkedInAccountConnection"("ownerEmail");

-- CreateIndex
CREATE INDEX "LinkedInAccountConnection_status_idx" ON "LinkedInAccountConnection"("status");

-- CreateIndex
CREATE INDEX "LinkedInPostPublishRun_draftId_idx" ON "LinkedInPostPublishRun"("draftId");

-- CreateIndex
CREATE INDEX "LinkedInPostPublishRun_outcome_idx" ON "LinkedInPostPublishRun"("outcome");

-- CreateIndex
CREATE INDEX "LinkedInPostPublishRun_startedAt_idx" ON "LinkedInPostPublishRun"("startedAt");

-- CreateIndex
CREATE INDEX "LinkedInPostAnalyticsSnapshot_draftId_collectedAt_idx" ON "LinkedInPostAnalyticsSnapshot"("draftId", "collectedAt");

-- CreateIndex
CREATE INDEX "GrowthAuditLog_actor_idx" ON "GrowthAuditLog"("actor");

-- CreateIndex
CREATE INDEX "GrowthAuditLog_action_idx" ON "GrowthAuditLog"("action");

-- CreateIndex
CREATE INDEX "GrowthAuditLog_targetKind_targetId_idx" ON "GrowthAuditLog"("targetKind", "targetId");

-- CreateIndex
CREATE INDEX "GrowthAuditLog_occurredAt_idx" ON "GrowthAuditLog"("occurredAt");

-- CreateIndex
CREATE INDEX "PullRequestRecord_organizationId_idx" ON "PullRequestRecord"("organizationId");

-- CreateIndex
CREATE INDEX "PullRequestRecord_state_idx" ON "PullRequestRecord"("state");

-- CreateIndex
CREATE INDEX "PullRequestRecord_commitShaHead_idx" ON "PullRequestRecord"("commitShaHead");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequestRecord_repositoryId_number_key" ON "PullRequestRecord"("repositoryId", "number");

-- CreateIndex
CREATE INDEX "ReleaseTagRecord_organizationId_idx" ON "ReleaseTagRecord"("organizationId");

-- CreateIndex
CREATE INDEX "ReleaseTagRecord_commitSha_idx" ON "ReleaseTagRecord"("commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseTagRecord_repositoryId_tagName_key" ON "ReleaseTagRecord"("repositoryId", "tagName");

-- CreateIndex
CREATE INDEX "WorkflowRunRecord_organizationId_idx" ON "WorkflowRunRecord"("organizationId");

-- CreateIndex
CREATE INDEX "WorkflowRunRecord_status_idx" ON "WorkflowRunRecord"("status");

-- CreateIndex
CREATE INDEX "WorkflowRunRecord_commitSha_idx" ON "WorkflowRunRecord"("commitSha");

-- CreateIndex
CREATE INDEX "WorkflowRunRecord_runKind_idx" ON "WorkflowRunRecord"("runKind");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRunRecord_repositoryId_externalRunId_key" ON "WorkflowRunRecord"("repositoryId", "externalRunId");

-- CreateIndex
CREATE INDEX "CherryPickException_organizationId_status_idx" ON "CherryPickException"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CherryPickException_releaseId_idx" ON "CherryPickException"("releaseId");

-- CreateIndex
CREATE INDEX "CherryPickException_repositoryId_idx" ON "CherryPickException"("repositoryId");

-- CreateIndex
CREATE INDEX "ChangeTicket_organizationId_status_idx" ON "ChangeTicket"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ChangeTicket_organizationId_provider_idx" ON "ChangeTicket"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "ChangeTicket_assigneeUserId_idx" ON "ChangeTicket"("assigneeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeTicket_organizationId_provider_externalKey_key" ON "ChangeTicket"("organizationId", "provider", "externalKey");

-- CreateIndex
CREATE INDEX "DriftFinding_organizationId_status_idx" ON "DriftFinding"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DriftFinding_organizationId_severity_idx" ON "DriftFinding"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "DriftFinding_applicationId_idx" ON "DriftFinding"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "DriftFinding_organizationId_resourceKind_resourceId_key" ON "DriftFinding"("organizationId", "resourceKind", "resourceId");

-- CreateIndex
CREATE INDEX "ManualFix_organizationId_status_idx" ON "ManualFix"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ManualFix_organizationId_releaseId_idx" ON "ManualFix"("organizationId", "releaseId");

-- CreateIndex
CREATE INDEX "ManualFix_organizationId_fixedAtIso_idx" ON "ManualFix"("organizationId", "fixedAtIso");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_subjectKind_subjectId_idx" ON "AuditEvent"("organizationId", "subjectKind", "subjectId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_kind_idx" ON "AuditEvent"("organizationId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "SlackNotificationConfig_organizationId_key" ON "SlackNotificationConfig"("organizationId");

-- CreateIndex
CREATE INDEX "SlackNotificationLog_organizationId_generatedAt_idx" ON "SlackNotificationLog"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "SlackNotificationLog_organizationId_signalKind_idx" ON "SlackNotificationLog"("organizationId", "signalKind");

-- CreateIndex
CREATE INDEX "SlackNotificationLog_organizationId_outcome_idx" ON "SlackNotificationLog"("organizationId", "outcome");

-- CreateIndex
CREATE INDEX "AdvisorCouncilDecision_organizationId_operatorDecision_idx" ON "AdvisorCouncilDecision"("organizationId", "operatorDecision");

-- CreateIndex
CREATE INDEX "AdvisorCouncilDecision_organizationId_releaseId_idx" ON "AdvisorCouncilDecision"("organizationId", "releaseId");

-- CreateIndex
CREATE INDEX "AdvisorCouncilDecision_organizationId_consensusKind_idx" ON "AdvisorCouncilDecision"("organizationId", "consensusKind");

-- CreateIndex
CREATE INDEX "AiRationaleEnrichment_organizationId_targetKind_generatedAt_idx" ON "AiRationaleEnrichment"("organizationId", "targetKind", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiRationaleEnrichment_organizationId_targetKind_targetId_key" ON "AiRationaleEnrichment"("organizationId", "targetKind", "targetId");

-- CreateIndex
CREATE INDEX "AiMemorySummaryLog_organizationId_generatedAt_idx" ON "AiMemorySummaryLog"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "AiMemorySummaryLog_organizationId_targetKind_generatedAt_idx" ON "AiMemorySummaryLog"("organizationId", "targetKind", "generatedAt");

-- CreateIndex
CREATE INDEX "ProactiveAgiSuggestion_organizationId_operatorDecision_gene_idx" ON "ProactiveAgiSuggestion"("organizationId", "operatorDecision", "generatedAt");

-- CreateIndex
CREATE INDEX "ProactiveAgiSuggestion_organizationId_kind_idx" ON "ProactiveAgiSuggestion"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "ProactiveAgiSuggestion_organizationId_targetKind_targetId_idx" ON "ProactiveAgiSuggestion"("organizationId", "targetKind", "targetId");

-- CreateIndex
CREATE INDEX "AiMemoryChatTurn_organizationId_generatedAt_idx" ON "AiMemoryChatTurn"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "AiMemoryChatTurn_organizationId_userId_generatedAt_idx" ON "AiMemoryChatTurn"("organizationId", "userId", "generatedAt");

-- CreateIndex
CREATE INDEX "AiCallLog_engineName_startedAt_idx" ON "AiCallLog"("engineName", "startedAt");

-- CreateIndex
CREATE INDEX "AiCallLog_organizationId_engineName_startedAt_idx" ON "AiCallLog"("organizationId", "engineName", "startedAt");

-- CreateIndex
CREATE INDEX "AiCallLog_outcome_startedAt_idx" ON "AiCallLog"("outcome", "startedAt");

-- CreateIndex
CREATE INDEX "AutonomousTickLog_organizationId_generatedAt_idx" ON "AutonomousTickLog"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "RemediationProposal_organizationId_operatorDecision_idx" ON "RemediationProposal"("organizationId", "operatorDecision");

-- CreateIndex
CREATE INDEX "RemediationProposal_organizationId_incidentId_idx" ON "RemediationProposal"("organizationId", "incidentId");

-- CreateIndex
CREATE INDEX "RemediationProposal_organizationId_kind_idx" ON "RemediationProposal"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "IncidentTriage_organizationId_operatorDecision_idx" ON "IncidentTriage"("organizationId", "operatorDecision");

-- CreateIndex
CREATE INDEX "IncidentTriage_organizationId_incidentId_idx" ON "IncidentTriage"("organizationId", "incidentId");

-- CreateIndex
CREATE INDEX "IncidentTriage_organizationId_priority_idx" ON "IncidentTriage"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "PolicyProposal_organizationId_operatorDecision_idx" ON "PolicyProposal"("organizationId", "operatorDecision");

-- CreateIndex
CREATE INDEX "PolicyProposal_organizationId_generatedAt_idx" ON "PolicyProposal"("organizationId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyProposal_organizationId_suggestedRuleKey_operatorDeci_key" ON "PolicyProposal"("organizationId", "suggestedRuleKey", "operatorDecision");

-- CreateIndex
CREATE INDEX "AdvisorRecommendation_organizationId_operatorDecision_idx" ON "AdvisorRecommendation"("organizationId", "operatorDecision");

-- CreateIndex
CREATE INDEX "AdvisorRecommendation_organizationId_releaseId_idx" ON "AdvisorRecommendation"("organizationId", "releaseId");

-- CreateIndex
CREATE INDEX "AdvisorRecommendation_organizationId_generatedAt_idx" ON "AdvisorRecommendation"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "GitHubInstallation_organizationId_status_idx" ON "GitHubInstallation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "GitHubInstallation_githubInstallationId_idx" ON "GitHubInstallation"("githubInstallationId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubInstallation_organizationId_githubInstallationId_key" ON "GitHubInstallation"("organizationId", "githubInstallationId");

-- CreateIndex
CREATE INDEX "TenantIntegrationConnection_organizationId_status_idx" ON "TenantIntegrationConnection"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantIntegrationConnection_organizationId_provider_key" ON "TenantIntegrationConnection"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "AirflowAutomation_organizationId_enabled_idx" ON "AirflowAutomation"("organizationId", "enabled");

-- CreateIndex
CREATE INDEX "AirflowAutomation_connectionId_dagId_idx" ON "AirflowAutomation"("connectionId", "dagId");

-- CreateIndex
CREATE INDEX "AirflowAutomation_nextScheduledAt_idx" ON "AirflowAutomation"("nextScheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "AirflowAutomation_organizationId_name_key" ON "AirflowAutomation"("organizationId", "name");

-- CreateIndex
CREATE INDEX "AirflowAutomationExecution_organizationId_status_createdAt_idx" ON "AirflowAutomationExecution"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AirflowAutomationExecution_status_nextRetryAt_idx" ON "AirflowAutomationExecution"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "AirflowAutomationExecution_automationId_sourceDagRunId_key" ON "AirflowAutomationExecution"("automationId", "sourceDagRunId");

-- CreateIndex
CREATE INDEX "AirflowDagRunSnapshot_organizationId_dagId_lastSeenAt_idx" ON "AirflowDagRunSnapshot"("organizationId", "dagId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "AirflowDagRunSnapshot_state_lastSeenAt_idx" ON "AirflowDagRunSnapshot"("state", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "AirflowDagRunSnapshot_connectionId_dagId_dagRunId_key" ON "AirflowDagRunSnapshot"("connectionId", "dagId", "dagRunId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantIntegrationAuthorizationAttempt_stateDigest_key" ON "TenantIntegrationAuthorizationAttempt"("stateDigest");

-- CreateIndex
CREATE INDEX "TenantIntegrationAuthorizationAttempt_organizationId_provid_idx" ON "TenantIntegrationAuthorizationAttempt"("organizationId", "provider", "expiresAt");

-- CreateIndex
CREATE INDEX "TenantIntegrationAuthorizationAttempt_expiresAt_idx" ON "TenantIntegrationAuthorizationAttempt"("expiresAt");

-- CreateIndex
CREATE INDEX "DeploymentIncident_organizationId_status_idx" ON "DeploymentIncident"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DeploymentIncident_organizationId_releaseId_idx" ON "DeploymentIncident"("organizationId", "releaseId");

-- CreateIndex
CREATE INDEX "DeploymentIncident_organizationId_severity_idx" ON "DeploymentIncident"("organizationId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseNotesDraft_releaseId_key" ON "ReleaseNotesDraft"("releaseId");

-- CreateIndex
CREATE INDEX "ReleaseNotesDraft_organizationId_status_idx" ON "ReleaseNotesDraft"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ReleaseNotesDraft_organizationId_releaseId_idx" ON "ReleaseNotesDraft"("organizationId", "releaseId");

-- CreateIndex
CREATE INDEX "BranchProtectionSnapshot_organizationId_repositoryId_idx" ON "BranchProtectionSnapshot"("organizationId", "repositoryId");

-- CreateIndex
CREATE INDEX "BranchProtectionSnapshot_organizationId_strength_idx" ON "BranchProtectionSnapshot"("organizationId", "strength");

-- CreateIndex
CREATE UNIQUE INDEX "BranchProtectionSnapshot_repositoryId_branchName_key" ON "BranchProtectionSnapshot"("repositoryId", "branchName");

-- CreateIndex
CREATE INDEX "InboundWebhookDelivery_organizationId_receivedAt_idx" ON "InboundWebhookDelivery"("organizationId", "receivedAt");

-- CreateIndex
CREATE INDEX "InboundWebhookDelivery_organizationId_provider_eventKind_idx" ON "InboundWebhookDelivery"("organizationId", "provider", "eventKind");

-- CreateIndex
CREATE UNIQUE INDEX "InboundWebhookDelivery_provider_deliveryId_key" ON "InboundWebhookDelivery"("provider", "deliveryId");

-- CreateIndex
CREATE INDEX "TauriDeploymentRequest_organizationId_status_createdAt_idx" ON "TauriDeploymentRequest"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TauriDeploymentRequest_organizationId_correlationId_key" ON "TauriDeploymentRequest"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "TauriDeploymentRequestVersion_organizationId_createdAt_idx" ON "TauriDeploymentRequestVersion"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TauriDeploymentRequestVersion_deploymentRequestId_version_key" ON "TauriDeploymentRequestVersion"("deploymentRequestId", "version");

-- CreateIndex
CREATE INDEX "TauriPlaybook_organizationId_status_createdAt_idx" ON "TauriPlaybook"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TauriPlaybook_deploymentRequestId_version_key" ON "TauriPlaybook"("deploymentRequestId", "version");

-- CreateIndex
CREATE INDEX "TauriAuditEvent_organizationId_deploymentRequestId_occurred_idx" ON "TauriAuditEvent"("organizationId", "deploymentRequestId", "occurredAt");

-- CreateIndex
CREATE INDEX "TauriAuditEvent_organizationId_correlationId_idx" ON "TauriAuditEvent"("organizationId", "correlationId");

-- CreateIndex
CREATE INDEX "TauriDeploymentOperation_organizationId_deploymentRequestId_idx" ON "TauriDeploymentOperation"("organizationId", "deploymentRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "TauriDeploymentOperation_organizationId_status_updatedAt_idx" ON "TauriDeploymentOperation"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TauriDeploymentOperation_organizationId_idempotencyKey_key" ON "TauriDeploymentOperation"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IncidentRecord_organizationId_status_idx" ON "IncidentRecord"("organizationId", "status");

-- CreateIndex
CREATE INDEX "IncidentRecord_organizationId_detectedAt_idx" ON "IncidentRecord"("organizationId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformGithubAppCredential_singletonKey_key" ON "PlatformGithubAppCredential"("singletonKey");

-- CreateIndex
CREATE UNIQUE INDEX "FoundingSupporterPurchase_correlationId_key" ON "FoundingSupporterPurchase"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundingSupporterPurchase_stripeCheckoutSessionId_key" ON "FoundingSupporterPurchase"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundingSupporterPurchase_stripePaymentIntentId_key" ON "FoundingSupporterPurchase"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "FoundingSupporterPurchase_status_createdAt_idx" ON "FoundingSupporterPurchase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FoundingSupporterPurchase_email_createdAt_idx" ON "FoundingSupporterPurchase"("email", "createdAt");

-- CreateIndex
CREATE INDEX "SupporterStripeEvent_processedAt_idx" ON "SupporterStripeEvent"("processedAt");

-- CreateIndex
CREATE INDEX "EcsReleaseReviewPacket_scope_expiry_idx" ON "EcsReleaseReviewPacket"("organizationId", "environmentId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EcsReleaseReviewPacket_organizationId_operationId_key" ON "EcsReleaseReviewPacket"("organizationId", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "EcsReleaseReviewPacket_id_organizationId_key" ON "EcsReleaseReviewPacket"("id", "organizationId");

-- CreateIndex
CREATE INDEX "EcsReleaseReviewDecision_scope_revision_idx" ON "EcsReleaseReviewDecision"("organizationId", "packetId", "userId", "revision" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "EcsReleaseReviewDecision_packetId_userId_revision_key" ON "EcsReleaseReviewDecision"("packetId", "userId", "revision");

-- CreateIndex
CREATE INDEX "EcsReleaseReviewCheckpoint_organizationId_packetId_idx" ON "EcsReleaseReviewCheckpoint"("organizationId", "packetId");

-- CreateIndex
CREATE UNIQUE INDEX "EcsReleaseReviewCheckpoint_packetId_decisionSetDigest_key" ON "EcsReleaseReviewCheckpoint"("packetId", "decisionSetDigest");

-- CreateIndex
CREATE INDEX "BotTaskDraft_organizationId_createdByUserId_createdAt_id_idx" ON "BotTaskDraft"("organizationId", "createdByUserId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BotTaskDraft_organizationId_id_key" ON "BotTaskDraft"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BotTaskDraft_organizationId_createdByUserId_clientRequestId_key" ON "BotTaskDraft"("organizationId", "createdByUserId", "clientRequestId");

-- CreateIndex
CREATE INDEX "BotTaskDraftEvent_organizationId_taskId_version_idx" ON "BotTaskDraftEvent"("organizationId", "taskId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "BotTaskDraftEvent_taskId_version_key" ON "BotTaskDraftEvent"("taskId", "version");

-- CreateIndex
CREATE INDEX "BotTaskRun_organizationId_createdByUserId_createdAt_id_idx" ON "BotTaskRun"("organizationId", "createdByUserId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BotTaskRun_organizationId_createdByUserId_id_key" ON "BotTaskRun"("organizationId", "createdByUserId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BotTaskRun_organizationId_createdByUserId_clientRequestId_key" ON "BotTaskRun"("organizationId", "createdByUserId", "clientRequestId");

-- CreateIndex
CREATE INDEX "BotTaskRunEvent_organizationId_createdByUserId_runId_sequen_idx" ON "BotTaskRunEvent"("organizationId", "createdByUserId", "runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "BotTaskRunEvent_runId_sequence_key" ON "BotTaskRunEvent"("runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "BotTaskArtifact_runId_key" ON "BotTaskArtifact"("runId");

-- CreateIndex
CREATE INDEX "BotTaskArtifact_organizationId_createdByUserId_runId_idx" ON "BotTaskArtifact"("organizationId", "createdByUserId", "runId");

-- CreateIndex
CREATE INDEX "BotAiTaskRun_organizationId_createdByUserId_createdAt_id_idx" ON "BotAiTaskRun"("organizationId", "createdByUserId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BotAiTaskRun_organizationId_createdByUserId_id_key" ON "BotAiTaskRun"("organizationId", "createdByUserId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BotAiTaskRun_organizationId_createdByUserId_clientRequestId_key" ON "BotAiTaskRun"("organizationId", "createdByUserId", "clientRequestId");

-- CreateIndex
CREATE INDEX "BotAiTaskEvent_organizationId_createdByUserId_runId_sequenc_idx" ON "BotAiTaskEvent"("organizationId", "createdByUserId", "runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "BotAiTaskEvent_runId_sequence_key" ON "BotAiTaskEvent"("runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "BotAiTaskArtifact_runId_key" ON "BotAiTaskArtifact"("runId");

-- CreateIndex
CREATE INDEX "BotAiTaskArtifact_organizationId_createdByUserId_runId_idx" ON "BotAiTaskArtifact"("organizationId", "createdByUserId", "runId");

-- CreateIndex
CREATE INDEX "BotPullRequestEvidenceRun_organizationId_createdByUserId_cr_idx" ON "BotPullRequestEvidenceRun"("organizationId", "createdByUserId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BotPullRequestEvidenceRun_organizationId_createdByUserId_id_key" ON "BotPullRequestEvidenceRun"("organizationId", "createdByUserId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BotPullRequestEvidenceRun_organizationId_createdByUserId_cl_key" ON "BotPullRequestEvidenceRun"("organizationId", "createdByUserId", "clientRequestId");

-- CreateIndex
CREATE INDEX "BotPullRequestEvidenceEvent_organizationId_createdByUserId__idx" ON "BotPullRequestEvidenceEvent"("organizationId", "createdByUserId", "runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "BotPullRequestEvidenceEvent_runId_sequence_key" ON "BotPullRequestEvidenceEvent"("runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "BotPullRequestEvidenceArtifact_runId_key" ON "BotPullRequestEvidenceArtifact"("runId");

-- CreateIndex
CREATE INDEX "BotPullRequestEvidenceArtifact_organizationId_createdByUser_idx" ON "BotPullRequestEvidenceArtifact"("organizationId", "createdByUserId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "GcpGuidedAuthorization_stateDigest_key" ON "GcpGuidedAuthorization"("stateDigest");

-- CreateIndex
CREATE INDEX "GcpGuidedAuthorization_organizationId_userId_sessionId_expi_idx" ON "GcpGuidedAuthorization"("organizationId", "userId", "sessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "AwsGuidedConnectionFlow_organizationId_userId_createdAt_idx" ON "AwsGuidedConnectionFlow"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AzureGuidedAuthorization_stateDigest_key" ON "AzureGuidedAuthorization"("stateDigest");

-- CreateIndex
CREATE INDEX "AzureGuidedAuthorization_organizationId_userId_sessionId_cr_idx" ON "AzureGuidedAuthorization"("organizationId", "userId", "sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AzureGuidedAuthorization_connectionId_connectionVersion_idx" ON "AzureGuidedAuthorization"("connectionId", "connectionVersion");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomScoreSnapshot" ADD CONSTRAINT "AxiomScoreSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAnalysis" ADD CONSTRAINT "RecurringAnalysis_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomMessage" ADD CONSTRAINT "AxiomMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AxiomConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudAccountCredential" ADD CONSTRAINT "CloudAccountCredential_id_organizationId_fkey" FOREIGN KEY ("id", "organizationId") REFERENCES "CloudAccount"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudAccountEnrollmentAttempt" ADD CONSTRAINT "CloudAccountEnrollmentAttempt_cloudAccountId_organizationI_fkey" FOREIGN KEY ("cloudAccountId", "organizationId") REFERENCES "CloudAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomAgentRun" ADD CONSTRAINT "AxiomAgentRun_cloudAccountId_organizationId_fkey" FOREIGN KEY ("cloudAccountId", "organizationId") REFERENCES "CloudAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomFinding" ADD CONSTRAINT "AxiomFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AxiomAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomRecommendation" ADD CONSTRAINT "AxiomRecommendation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AxiomAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomRecommendation" ADD CONSTRAINT "AxiomRecommendation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AxiomFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomExecutionPlan" ADD CONSTRAINT "AxiomExecutionPlan_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AxiomAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomExecutionPlanItem" ADD CONSTRAINT "AxiomExecutionPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AxiomExecutionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomExecutionPlanItem" ADD CONSTRAINT "AxiomExecutionPlanItem_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "AxiomRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomApprovalRequest" ADD CONSTRAINT "AxiomApprovalRequest_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AxiomAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomAuditEvent" ADD CONSTRAINT "AxiomAuditEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AxiomAgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomScheduledRun" ADD CONSTRAINT "AxiomScheduledRun_cloudAccountId_organizationId_fkey" FOREIGN KEY ("cloudAccountId", "organizationId") REFERENCES "CloudAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomAgentTask" ADD CONSTRAINT "AxiomAgentTask_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AxiomAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentEngineerActionAttempt" ADD CONSTRAINT "AgentEngineerActionAttempt_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AgentEngineerRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineerApprovalSnapshot" ADD CONSTRAINT "EngineerApprovalSnapshot_pipelineStageRunId_fkey" FOREIGN KEY ("pipelineStageRunId") REFERENCES "PipelineStageRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngineerApprovalDecision" ADD CONSTRAINT "EngineerApprovalDecision_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "EngineerApprovalSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStageRun" ADD CONSTRAINT "PipelineStageRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodingTask" ADD CONSTRAINT "CodingTask_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalCase" ADD CONSTRAINT "EvalCase_evalRunId_fkey" FOREIGN KEY ("evalRunId") REFERENCES "EvalRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomAutopilotEvent" ADD CONSTRAINT "AxiomAutopilotEvent_cloudAccountId_organizationId_fkey" FOREIGN KEY ("cloudAccountId", "organizationId") REFERENCES "CloudAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConversationTurn" ADD CONSTRAINT "AgentConversationTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActionProposal" ADD CONSTRAINT "AgentActionProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DurableAgentWorkflowEvent" ADD CONSTRAINT "DurableAgentWorkflowEvent_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "DurableAgentWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AxiomApprovalVote" ADD CONSTRAINT "AxiomApprovalVote_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "AxiomApprovalChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorSetupTransition" ADD CONSTRAINT "ConnectorSetupTransition_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConnectorSetupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEscalationTransition" ADD CONSTRAINT "AlertEscalationTransition_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AlertEscalationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentTarget" ADD CONSTRAINT "DeploymentTarget_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchEnvironmentPolicy" ADD CONSTRAINT "BranchEnvironmentPolicy_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchEnvironmentPolicy" ADD CONSTRAINT "BranchEnvironmentPolicy_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseReadinessSnapshot" ADD CONSTRAINT "ReleaseReadinessSnapshot_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseEvidencePack" ADD CONSTRAINT "ReleaseEvidencePack_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyViolation" ADD CONSTRAINT "PolicyViolation_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PolicyRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInPostDraft" ADD CONSTRAINT "LinkedInPostDraft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "GrowthCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInPostPublishRun" ADD CONSTRAINT "LinkedInPostPublishRun_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "LinkedInPostDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInPostAnalyticsSnapshot" ADD CONSTRAINT "LinkedInPostAnalyticsSnapshot_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "LinkedInPostDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirflowAutomationExecution" ADD CONSTRAINT "AirflowAutomationExecution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "AirflowAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TauriDeploymentRequestVersion" ADD CONSTRAINT "TauriDeploymentRequestVersion_deploymentRequestId_fkey" FOREIGN KEY ("deploymentRequestId") REFERENCES "TauriDeploymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TauriPlaybook" ADD CONSTRAINT "TauriPlaybook_deploymentRequestId_fkey" FOREIGN KEY ("deploymentRequestId") REFERENCES "TauriDeploymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TauriAuditEvent" ADD CONSTRAINT "TauriAuditEvent_deploymentRequestId_fkey" FOREIGN KEY ("deploymentRequestId") REFERENCES "TauriDeploymentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcsReleaseReviewDecision" ADD CONSTRAINT "EcsReleaseReviewDecision_packetId_organizationId_fkey" FOREIGN KEY ("packetId", "organizationId") REFERENCES "EcsReleaseReviewPacket"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcsReleaseReviewCheckpoint" ADD CONSTRAINT "EcsReleaseReviewCheckpoint_packetId_organizationId_fkey" FOREIGN KEY ("packetId", "organizationId") REFERENCES "EcsReleaseReviewPacket"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotTaskDraftEvent" ADD CONSTRAINT "BotTaskDraftEvent_organizationId_taskId_fkey" FOREIGN KEY ("organizationId", "taskId") REFERENCES "BotTaskDraft"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotTaskRunEvent" ADD CONSTRAINT "BotTaskRunEvent_organizationId_createdByUserId_runId_fkey" FOREIGN KEY ("organizationId", "createdByUserId", "runId") REFERENCES "BotTaskRun"("organizationId", "createdByUserId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotTaskArtifact" ADD CONSTRAINT "BotTaskArtifact_organizationId_createdByUserId_runId_fkey" FOREIGN KEY ("organizationId", "createdByUserId", "runId") REFERENCES "BotTaskRun"("organizationId", "createdByUserId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotAiTaskEvent" ADD CONSTRAINT "BotAiTaskEvent_organizationId_createdByUserId_runId_fkey" FOREIGN KEY ("organizationId", "createdByUserId", "runId") REFERENCES "BotAiTaskRun"("organizationId", "createdByUserId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotAiTaskArtifact" ADD CONSTRAINT "BotAiTaskArtifact_organizationId_createdByUserId_runId_fkey" FOREIGN KEY ("organizationId", "createdByUserId", "runId") REFERENCES "BotAiTaskRun"("organizationId", "createdByUserId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotPullRequestEvidenceEvent" ADD CONSTRAINT "BotPullRequestEvidenceEvent_organizationId_createdByUserId_fkey" FOREIGN KEY ("organizationId", "createdByUserId", "runId") REFERENCES "BotPullRequestEvidenceRun"("organizationId", "createdByUserId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotPullRequestEvidenceArtifact" ADD CONSTRAINT "BotPullRequestEvidenceArtifact_organizationId_createdByUse_fkey" FOREIGN KEY ("organizationId", "createdByUserId", "runId") REFERENCES "BotPullRequestEvidenceRun"("organizationId", "createdByUserId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

