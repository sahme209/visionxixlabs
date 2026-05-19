/**
 * First-run onboarding checklist.
 *
 * Pure-function inspector that turns the env loader's presence
 * booleans into a typed step list. Each step:
 *   • A short, operator-readable label
 *   • A description of what to wire
 *   • A status verdict: "complete" | "partial" | "pending"
 *   • A docs link into /dashboard/help#... for deeper context
 *
 * Hard rules:
 *   - Pure: no DB call, no network. Reads only env booleans via
 *     loadAppEnv (which itself is pure).
 *   - Status verdicts are intentionally coarse — the surface is a
 *     wizard, not a deep audit.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";

export type StepStatus = "complete" | "partial" | "pending";

export interface OnboardingStep {
  id: string;
  order: number;
  label: string;
  description: string;
  status: StepStatus;
  /** Operator hint about exactly what's missing. */
  missingHint?: string;
  /** Help-entry id to deep-link into. */
  helpEntryId?: string;
}

export interface OnboardingChecklist {
  totalSteps: number;
  completeCount: number;
  partialCount: number;
  pendingCount: number;
  /** 0..1 — completeCount / totalSteps. */
  completionRatio: number;
  steps: OnboardingStep[];
  generatedAt: string;
}

export function buildOnboardingChecklist(): OnboardingChecklist {
  const env = loadAppEnv();
  const steps: OnboardingStep[] = [];

  // 1. AWS broker credentials
  const awsBroker = Boolean(env.awsBrokerAccessKeyId && env.awsBrokerSecretAccessKey);
  const awsRole = Boolean(env.awsAmbientRoleArn && env.awsAmbientExternalId);
  steps.push({
    id: "aws.broker",
    order: 1,
    label: "AWS broker credentials",
    description: "Configure the IAM user Axiom uses to assume into each tenant role. Required before any AWS extractor can fetch data.",
    status: awsBroker ? (awsRole ? "complete" : "partial") : "pending",
    missingHint: awsBroker
      ? (awsRole ? undefined : "Add AWS_ROLE_ARN + AWS_EXTERNAL_ID, or set AWS_USE_DIRECT_CREDS=true for single-account testing.")
      : "Set AWS_CONNECTOR_BROKER_ACCESS_KEY_ID + AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY.",
    helpEntryId: "aws-services",
  });

  // 2. AWS inventory + Cost Explorer
  steps.push({
    id: "aws.inventory_enabled",
    order: 2,
    label: "AWS inventory extractor",
    description: "Enable the 15-section AWS inventory extractor + Cost Explorer pull.",
    status: env.awsInventoryExtractEnabled
      ? (env.awsCostExplorerEnabled ? "complete" : "partial")
      : "pending",
    missingHint: env.awsInventoryExtractEnabled
      ? (env.awsCostExplorerEnabled ? undefined : "Activate AWS Cost Explorer in the console + set AWS_COST_EXPLORER_ENABLED=true.")
      : "Set AWS_INVENTORY_EXTRACT_ENABLED=true.",
    helpEntryId: "aws-services",
  });

  // 3. Azure service principal
  steps.push({
    id: "azure.configured",
    order: 3,
    label: "Azure service principal",
    description: "Wire the Azure service principal Axiom uses for read-only ARM + AlertsManagement + Storage access.",
    status: env.azureConfigured
      ? (env.azureInventoryExtractEnabled ? "complete" : "partial")
      : "pending",
    missingHint: env.azureConfigured
      ? (env.azureInventoryExtractEnabled ? undefined : "Set AZURE_INVENTORY_EXTRACT_ENABLED=true.")
      : "Set AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_SUBSCRIPTION_ID.",
    helpEntryId: "cloud-inventory",
  });

  // 4. GCP service account
  steps.push({
    id: "gcp.configured",
    order: 4,
    label: "GCP service account",
    description: "Provide a service-account key (JSON or split client_email + private_key) for read-only GCP traversal.",
    status: env.gcpConfigured
      ? (env.gcpInventoryExtractEnabled ? "complete" : "partial")
      : "pending",
    missingHint: env.gcpConfigured
      ? (env.gcpInventoryExtractEnabled ? undefined : "Set GCP_INVENTORY_EXTRACT_ENABLED=true.")
      : "Set GCP_PROJECT_ID + (GCP_SERVICE_ACCOUNT_JSON or GCP_CLIENT_EMAIL+GCP_PRIVATE_KEY).",
    helpEntryId: "cloud-inventory",
  });

  // 5. Outbound channel (Slack / Teams / webhook)
  const anyOutbound = Boolean(env.slackWebhookUrl || env.teamsWebhookUrl || env.outboundWebhookUrl);
  steps.push({
    id: "notifications.outbound",
    order: 5,
    label: "Outbound notification channel",
    description: "Wire at least one outbound channel so autonomy halts + critical telemetry can page humans.",
    status: anyOutbound ? "complete" : "pending",
    missingHint: anyOutbound
      ? undefined
      : "Set at least one of SLACK_WEBHOOK_URL, TEAMS_WEBHOOK_URL, or OUTBOUND_WEBHOOK_URL.",
    helpEntryId: "outbound-notifications",
  });

  // 6. Autonomy scheduler
  steps.push({
    id: "autonomy.scheduler",
    order: 6,
    label: "Autonomy scheduler",
    description: "Enable the cron-driven autonomy loop. Combined with CRON_SECRET, this lets Axiom run unattended.",
    status: env.autonomySchedulerEnabled && Boolean(env.cronSecret)
      ? "complete"
      : env.autonomySchedulerEnabled || Boolean(env.cronSecret)
        ? "partial"
        : "pending",
    missingHint: env.autonomySchedulerEnabled && Boolean(env.cronSecret)
      ? undefined
      : !env.autonomySchedulerEnabled && !env.cronSecret
        ? "Set AUTONOMY_SCHEDULER_ENABLED=true + CRON_SECRET=<random>."
        : !env.autonomySchedulerEnabled
          ? "Set AUTONOMY_SCHEDULER_ENABLED=true."
          : "Set CRON_SECRET=<random>.",
    helpEntryId: "autonomy-cockpit",
  });

  // 7. GitHub deep posture (optional but enables Phase 47-style CI/CD insight)
  steps.push({
    id: "github.deep_posture",
    order: 7,
    label: "GitHub deep posture",
    description: "Provide a GitHub PAT or App credentials so Axiom can extract PRs, Dependabot alerts, branch protection.",
    status: env.githubPatConfigured || env.githubAppConfigured ? "complete" : "pending",
    missingHint:
      env.githubPatConfigured || env.githubAppConfigured
        ? undefined
        : "Set GITHUB_PAT or wire a GitHub App.",
    helpEntryId: "setup",
  });

  const completeCount = steps.filter((s) => s.status === "complete").length;
  const partialCount = steps.filter((s) => s.status === "partial").length;
  const pendingCount = steps.filter((s) => s.status === "pending").length;

  return {
    totalSteps: steps.length,
    completeCount,
    partialCount,
    pendingCount,
    completionRatio: steps.length > 0 ? completeCount / steps.length : 0,
    steps,
    generatedAt: new Date().toISOString(),
  };
}
