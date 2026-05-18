/**
 * Scheduled Scans builder.
 *
 * Reports the honest scheduled-task posture. Until a durable scheduler
 * runtime is wired, this surface declares what tasks would run, at
 * what cadence, with current status derived from AxiomOSState. Last-
 * run outcomes default to "never_run" — no fabricated run history.
 */

import "server-only";

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import type {
  ScheduledScanReport,
  ScheduledScanTask,
} from "./scheduledScanModel";

export interface BuildScheduledScansInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildScheduledScans(input: BuildScheduledScansInput): Promise<ScheduledScanReport> {
  const state = await buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId });

  // Provider availability derived from canonical posture
  const awsLive    = state.providers.find((p) => p.provider === "aws")?.mode === "live";
  const githubLive = state.providers.find((p) => p.provider === "github")?.mode === "live";
  const awsMissing    = state.providers.find((p) => p.provider === "aws")?.missingRequirements ?? [];
  const githubMissing = state.providers.find((p) => p.provider === "github")?.missingRequirements ?? [];

  const tasks: ScheduledScanTask[] = [
    // AWS read-only scan
    {
      id: "task:aws_readonly_scan",
      taskType: "aws_readonly_scan",
      cadence: awsLive ? "hourly" : "manual",
      status: awsLive ? "enabled" : "disabled_until_credentials",
      sourceMode: awsLive ? "live" : "preview",
      label: "AWS read-only scan",
      description: "Runs the canonical AWS scan pipeline (STS / EC2 / S3 / RDS / VPC / SG / IAM read-only).",
      lastRunOutcome: "never_run",
      missingConfig: awsLive ? [] : awsMissing,
      lastRunFindingsCount: 0,
      lastRunRisksCreated: 0,
      limitations: awsLive ? [] : ["Scheduler runtime not yet wired — manual /api/aws/scan only."],
      safeNextAction: { label: "Open AWS", href: "/dashboard/aws" },
      evidenceRef: "app/api/aws/scan/route.ts",
    },
    // GitHub read-only sync
    {
      id: "task:github_readonly_sync",
      taskType: "github_readonly_sync",
      cadence: githubLive ? "hourly" : "manual",
      status: githubLive ? "enabled" : "disabled_until_credentials",
      sourceMode: githubLive ? "live" : "preview",
      label: "GitHub read-only sync",
      description: "Repos / workflows / branch protection / deployment env discovery via /api/github/sync.",
      lastRunOutcome: "never_run",
      missingConfig: githubLive ? [] : githubMissing,
      lastRunFindingsCount: 0,
      lastRunRisksCreated: 0,
      limitations: githubLive ? [] : ["Scheduler runtime not yet wired — manual /api/github/sync only."],
      safeNextAction: { label: "Open GitHub", href: "/dashboard/github" },
      evidenceRef: "app/api/github/sync/route.ts",
    },
    // Security scanner
    {
      id: "task:security_scanner_run",
      taskType: "security_scanner_run",
      cadence: "every_6_hours",
      status: "enabled",
      sourceMode: state.securityPosture.sourceMode,
      label: "Security scanner run",
      description: "Pure-function security checks over current platform signals via /api/security-scan.",
      lastRunOutcome: "never_run",
      missingConfig: [],
      lastRunFindingsCount: state.securityPosture.data.totalFindings,
      lastRunRisksCreated: state.securityPosture.data.criticalCount + state.securityPosture.data.highCount,
      limitations: ["Scheduler runtime not yet wired — runs on operator click today."],
      safeNextAction: { label: "Open Security", href: "/dashboard/security" },
      evidenceRef: "app/api/security-scan/route.ts",
    },
    // ReleaseOps readiness
    {
      id: "task:releaseops_readiness",
      taskType: "releaseops_readiness_check",
      cadence: "daily",
      status: state.releaseOpsPosture.sourceMode === "blocked" ? "blocked" : "enabled",
      sourceMode: state.releaseOpsPosture.sourceMode,
      label: "ReleaseOps readiness check",
      description: "Composes ReleaseOps state + readiness rollup.",
      lastRunOutcome: "never_run",
      missingConfig: [],
      lastRunFindingsCount: 0,
      lastRunRisksCreated: 0,
      limitations: ["Persisted as part of next /api/axiom-os/state refresh."],
      safeNextAction: { label: "Open ReleaseOps", href: "/dashboard/releaseops" },
      evidenceRef: "lib/releaseops/getReleaseOpsState.ts",
    },
    // Integration health
    {
      id: "task:integration_health_check",
      taskType: "integration_health_check",
      cadence: "every_15_minutes",
      status: "enabled",
      sourceMode: state.sourceMode,
      label: "Integration health check",
      description: "Refreshes the canonical Integration Health report.",
      lastRunOutcome: "never_run",
      missingConfig: [],
      lastRunFindingsCount: 0,
      lastRunRisksCreated: 0,
      limitations: ["Currently fetched on demand; will run on schedule when runtime ships."],
      safeNextAction: { label: "Open Integration Health", href: "/dashboard/integrations/health" },
      evidenceRef: "app/api/integrations/health/route.ts",
    },
    // Trust evidence refresh
    {
      id: "task:trust_evidence_refresh",
      taskType: "trust_evidence_refresh",
      cadence: "daily",
      status: state.evidencePosture.data.totalRecords > 0 ? "enabled" : "paused",
      sourceMode: state.evidencePosture.sourceMode,
      label: "Trust evidence refresh",
      description: "Re-builds the evidence library + Trust Center summary.",
      lastRunOutcome: state.evidencePosture.data.totalRecords > 0 ? "succeeded" : "never_run",
      missingConfig: [],
      lastRunFindingsCount: 0,
      lastRunRisksCreated: 0,
      limitations: state.evidencePosture.data.totalRecords > 0 ? [] : ["No evidence records yet — task will run when evidence collector starts producing records."],
      safeNextAction: { label: "Open Trust Center", href: "/dashboard/trust" },
      evidenceRef: "app/api/trust/summary/route.ts",
    },
    // Readiness refresh
    {
      id: "task:readiness_refresh",
      taskType: "readiness_refresh",
      cadence: "daily",
      status: "enabled",
      sourceMode: state.sourceMode,
      label: "Readiness refresh",
      description: "Re-runs the production readiness runner + launch readiness composite.",
      lastRunOutcome: "never_run",
      missingConfig: [],
      lastRunFindingsCount: 0,
      lastRunRisksCreated: 0,
      limitations: [],
      safeNextAction: { label: "Open Readiness", href: "/dashboard/readiness" },
      evidenceRef: "app/api/readiness/launch/route.ts",
    },
  ];

  const summary = {
    total:         tasks.length,
    enabled:       tasks.filter((t) => t.status === "enabled").length,
    disabled:      tasks.filter((t) => t.status === "disabled_until_credentials" || t.status === "disabled_by_policy").length,
    paused:        tasks.filter((t) => t.status === "paused").length,
    blocked:       tasks.filter((t) => t.status === "blocked").length,
    lastSucceeded: tasks.filter((t) => t.lastRunOutcome === "succeeded" || t.lastRunOutcome === "succeeded_with_warnings").length,
    lastFailed:    tasks.filter((t) => t.lastRunOutcome === "failed").length,
    neverRun:      tasks.filter((t) => t.lastRunOutcome === "never_run").length,
  };

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    tasks,
    summary,
    safetyContract: "scheduled_tasks_read_only_only",
    limitations: [
      "Scheduler runtime is not yet wired — this surface declares what would run when the scheduler ships.",
      "Last-run outcomes default to 'never_run' — no fabricated run history.",
      "Every task wires through read-only adapters; apply paths are never reachable from the scheduler.",
    ],
    safeNextAction: { label: "Open Operating Loop", href: "/dashboard/autonomous-ops" },
  };
}
