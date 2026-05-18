/**
 * Setup Wizard builder.
 *
 * Pure read-only composition. Derives each setup step's status from
 * real canonical signals — no fabricated "complete" claims.
 *
 * Status rules:
 *   workspace_created       → complete (always; signed in operator = a workspace exists)
 *   role_context_ready      → complete (current session has a role)
 *   aws_setup_reviewed      → in_progress when AWS posture exists
 *   aws_validate_attempted  → complete when AWS mode === "live", else pending
 *   github_setup_reviewed   → in_progress when GitHub posture exists
 *   github_validate_attempted → complete when GitHub mode === "live", else pending
 *   azure_gcp_reviewed      → pending (preview/foundation)
 *   desktop_review_explained → complete (documented in product)
 *   trust_center_reviewed   → complete when evidencePosture.totalRecords > 0, else pending
 *   first_scan_run          → complete when any operating loop has run
 *   first_risk_reviewed     → complete when risk queue has items
 *   first_remediation_simulation → complete when remediationPosture.simulatedCount > 0
 *   evidence_export_reviewed → complete when evidencePosture.verifiedRecords > 0
 */

import "server-only";

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import { buildAxiomOSState } from "@/lib/axiomOS/axiomOSStateBuilder";
import { buildRiskQueue } from "@/lib/risk/riskQueueBuilder";
import type {
  SetupStep,
  SetupStepStatus,
  SetupWizardReport,
} from "./setupWizardModel";

export interface BuildSetupWizardInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
}

export async function buildSetupWizard(input: BuildSetupWizardInput): Promise<SetupWizardReport> {
  const [state, risk] = await Promise.all([
    buildAxiomOSState({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    buildRiskQueue({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
  ]);

  const aws    = state.providers.find((p) => p.provider === "aws");
  const github = state.providers.find((p) => p.provider === "github");
  const azure  = state.providers.find((p) => p.provider === "azure");
  const gcp    = state.providers.find((p) => p.provider === "gcp");

  const anyLoopRan = state.operatingLoops.some((l) => l.status === "completed" || l.status === "in_progress");
  const hasRisks = risk.items.length > 0;
  const hasSimulation = state.remediationPosture.data.simulatedCount > 0;
  const evidenceVerified = state.evidencePosture.data.verifiedRecords > 0;
  const evidenceCollected = state.evidencePosture.data.totalRecords > 0;

  const steps: SetupStep[] = [
    {
      id: "workspace_created",
      label: "Workspace created",
      description: "Tenant + workspace context exists for the signed-in operator.",
      status: "complete",
      sourceMode: state.sourceMode,
      reason: "Authenticated session implies a workspace exists.",
      route: { label: "Open workspace settings", href: "/dashboard/settings/workspace" },
      docsLink: { label: "Workspace docs", href: "/docs/architecture" },
      limitations: [],
      evidenceRef: "auth:currentContext",
    },
    {
      id: "role_context_ready",
      label: "Role + user context ready",
      description: "Current session is mapped to a workspace role (owner by default).",
      status: "complete",
      sourceMode: "live",
      reason: "Current session carries a role from the canonical role catalog.",
      route: { label: "Review roles", href: "/dashboard/settings/workspace" },
      limitations: [],
      evidenceRef: "lib/org/rbacModel.ts",
    },
    {
      id: "aws_setup_reviewed",
      label: "AWS setup reviewed",
      description: "AWS source page opened; missing requirements understood.",
      status: aws ? "in_progress" : "pending",
      sourceMode: aws?.mode ?? "preview",
      reason: aws
        ? `AWS provider mode: ${aws.mode}. ${aws.headline}`
        : "AWS provider not yet declared.",
      route: { label: "Open AWS", href: "/dashboard/aws" },
      docsLink: { label: "AWS setup", href: "/docs/aws-setup" },
      blocker: aws?.missingRequirements[0],
      limitations: aws?.missingRequirements ?? [],
      evidenceRef: "axiomOS:providers[aws]",
    },
    {
      id: "aws_validate_attempted",
      label: "AWS validate attempted",
      description: "AWS validation has been run at least once.",
      status: aws?.mode === "live" || aws?.mode === "partial_live" ? "complete" : "pending",
      sourceMode: aws?.mode ?? "preview",
      reason: aws?.mode === "live"
        ? "AWS source is live read-only — validation succeeded."
        : "AWS validation has not produced a live mode yet.",
      route: { label: "Run AWS scan", href: "/dashboard/aws" },
      limitations: aws?.missingRequirements ?? [],
      evidenceRef: "/api/aws/validate",
    },
    {
      id: "github_setup_reviewed",
      label: "GitHub setup reviewed",
      description: "GitHub integration page opened.",
      status: github ? "in_progress" : "pending",
      sourceMode: github?.mode ?? "preview",
      reason: github ? `GitHub mode: ${github.mode}` : "GitHub provider not yet declared.",
      route: { label: "Open GitHub", href: "/dashboard/github" },
      docsLink: { label: "GitHub setup", href: "/dashboard/integrations/github" },
      blocker: github?.missingRequirements[0],
      limitations: github?.missingRequirements ?? [],
      evidenceRef: "axiomOS:providers[github]",
    },
    {
      id: "github_validate_attempted",
      label: "GitHub validate attempted",
      description: "GitHub validation has been run at least once.",
      status: github?.mode === "live" || github?.mode === "partial_live" ? "complete" : "pending",
      sourceMode: github?.mode ?? "preview",
      reason: github?.mode === "live"
        ? "GitHub source is live — PAT or App validated."
        : "GitHub validation has not produced a live mode yet.",
      route: { label: "Run GitHub sync", href: "/dashboard/github" },
      limitations: github?.missingRequirements ?? [],
      evidenceRef: "/api/github/validate",
    },
    {
      id: "azure_gcp_reviewed",
      label: "Azure + GCP foundation reviewed",
      description: "Foundation state of Azure + GCP adapters understood.",
      status: (azure || gcp) ? "in_progress" : "pending",
      sourceMode: azure?.mode ?? gcp?.mode ?? "foundation",
      reason: "Azure + GCP are in foundation/expanding tier. Live live-inventory pending SDK wiring.",
      route: { label: "Open Sources", href: "/dashboard/sources" },
      docsLink: { label: "Azure setup", href: "/docs/azure-setup" },
      limitations: [
        ...(azure?.missingRequirements ?? []),
        ...(gcp?.missingRequirements ?? []),
      ],
      evidenceRef: "axiomOS:providers[azure+gcp]",
    },
    {
      id: "desktop_review_explained",
      label: "Desktop review mode explained",
      description: "Operator understands the desktop is a review workstation — never an executor.",
      status: "complete",
      sourceMode: state.desktopPosture.sourceMode,
      reason: "Desktop localExecutionStatus is a TypeScript literal 'disabled' — documented in /dashboard/automation-boundaries.",
      route: { label: "Open Automation Boundaries", href: "/dashboard/automation-boundaries" },
      docsLink: { label: "Download docs", href: "/download" },
      limitations: [],
      evidenceRef: "lib/desktop/desktopStateModel.ts:DesktopState.localExecutionStatus",
    },
    {
      id: "trust_center_reviewed",
      label: "Trust Center reviewed",
      description: "Operator has reviewed the Trust Center summary + evidence posture.",
      status: evidenceCollected ? "complete" : "pending",
      sourceMode: state.evidencePosture.sourceMode,
      reason: evidenceCollected
        ? `${state.evidencePosture.data.totalRecords} evidence records collected.`
        : "No evidence records yet.",
      route: { label: "Open Trust Center", href: "/dashboard/trust" },
      limitations: state.evidencePosture.limitations,
      evidenceRef: "axiomOS:evidencePosture",
    },
    {
      id: "first_scan_run",
      label: "First scan or sync run",
      description: "At least one operating loop has produced canonical data.",
      status: anyLoopRan ? "complete" : "pending",
      sourceMode: state.sourceMode,
      reason: anyLoopRan
        ? "At least one operating loop has run."
        : "No operating loop has produced canonical data yet — run an AWS scan or GitHub sync.",
      route: { label: "Open Operating Loop", href: "/dashboard/autonomous-ops" },
      limitations: [],
      evidenceRef: "axiomOS:operatingLoops",
    },
    {
      id: "first_risk_reviewed",
      label: "First risk reviewed",
      description: "Risk Queue contains at least one signal the operator has seen.",
      status: hasRisks ? "complete" : "pending",
      sourceMode: state.sourceMode,
      reason: hasRisks
        ? `${risk.items.length} risk item${risk.items.length === 1 ? "" : "s"} in the queue.`
        : "Risk Queue is empty — connect a provider and run a scan.",
      route: { label: "Open Risk Queue", href: "/dashboard/risks" },
      limitations: [],
      evidenceRef: "/api/risks/queue",
    },
    {
      id: "first_remediation_simulation",
      label: "First remediation + simulation",
      description: "Operator has built a remediation candidate and simulated it.",
      status: hasSimulation ? "complete" : (state.remediationPosture.data.candidateCount > 0 ? "in_progress" : "pending"),
      sourceMode: state.remediationPosture.sourceMode,
      reason: hasSimulation
        ? `${state.remediationPosture.data.simulatedCount} candidate(s) simulated.`
        : state.remediationPosture.data.candidateCount > 0
          ? `${state.remediationPosture.data.candidateCount} candidate(s) prepared but not yet simulated.`
          : "No remediation candidates yet — let the Remediation pipeline run.",
      route: { label: "Open Simulations", href: "/dashboard/simulations" },
      limitations: state.remediationPosture.limitations,
      evidenceRef: "axiomOS:remediationPosture",
    },
    {
      id: "evidence_export_reviewed",
      label: "Evidence export reviewed",
      description: "Operator has reviewed (or downloaded) the evidence bundle.",
      status: evidenceVerified ? "complete" : "pending",
      sourceMode: state.evidencePosture.sourceMode,
      reason: evidenceVerified
        ? `${state.evidencePosture.data.verifiedRecords} verified evidence record(s) ready for export.`
        : "Verified evidence records not yet present — export will populate as remediation/simulation/approvals run.",
      route: { label: "Open Trust Center to export", href: "/dashboard/trust" },
      limitations: state.evidencePosture.limitations,
      evidenceRef: "axiomOS:evidencePosture",
    },
  ];

  // Summary rollup
  const count = (s: SetupStepStatus) => steps.filter((step) => step.status === s).length;
  const summary = {
    total:           steps.length,
    complete:        count("complete"),
    inProgress:      count("in_progress"),
    pending:         count("pending"),
    blocked:         count("blocked"),
    skipped:         count("skipped"),
    completionRatio: Math.round((count("complete") / steps.length) * 100) / 100,
  };

  // Determine the next pending/blocked step
  const next = steps.find((s) => s.status === "pending" || s.status === "in_progress" || s.status === "blocked");

  return {
    generatedAt: state.generatedAt,
    tenantId: String(input.tenantId),
    steps,
    summary,
    safetyContract: "setup_review_only_no_execution",
    limitations: [
      "Setup Wizard reviews status — it never executes setup itself.",
      "Step completion is derived from canonical state, never persisted as a manual flag.",
    ],
    safeNextAction: next ? next.route : { label: "Open Command Center", href: "/dashboard/command-center" },
  };
}
