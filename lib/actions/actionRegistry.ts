/**
 * Canonical Action Registry — Phase 650.
 *
 * Single typed catalog of every concrete operator action the Axiom
 * platform exposes. Each entry carries:
 *
 *   · kind            — stable id used in audit logs and API routing
 *   · category        — for grouping in /dashboard/capabilities
 *   · label / summary — human-readable
 *   · route           — the canonical surface that fires the action
 *   · method          — POST for mutations, GET for safe queries
 *   · wireStatus      — "live" | "preview" | "needs_setup" | "blocked" | "planned"
 *   · evidence        — file path that backs the claim (cross-checked
 *                       against lib/validation/platformValidationMatrix.ts)
 *   · requiresAuth    — does the operator need to sign in
 *   · requiresConnector — which connector (if any) gates this action
 *   · isMutation      — does this change cloud state (still preview/governed)
 *   · safetyTier      — read_only | preview | governed | unsafe
 *   · nextBestActionTag — id used by nextBestActionEngine to surface it
 *
 * This is the source-of-truth the Command Center, Capabilities page,
 * and Copilot all introspect to answer "what can Axiom do right now?".
 *
 * NOT a runtime dispatcher — this is metadata only. Each route is its
 * own server-side implementation. We add a registry so the founder +
 * operator + Copilot can audit the action surface in one place
 * without grepping 200 route files.
 */

export type ActionKind =
  // Provider validation + scanning
  | "aws.validate"
  | "aws.scan"
  | "aws.preview_scan"
  | "azure.validate"
  | "azure.scan"
  | "azure.preview_scan"
  | "gcp.validate"
  | "gcp.scan"
  | "gcp.preview_scan"
  // GitHub / ReleaseOps
  | "github.validate"
  | "github.scan"
  | "github.preview_sync"
  | "releaseops.scan"
  // Security + remediation
  | "security.run_scan"
  | "remediation.generate"
  | "remediation.terraform_preview"
  | "remediation.cli_preview"
  | "remediation.desktop_handoff"
  // Simulation
  | "simulation.create"
  | "simulation.digital_twin"
  // Approvals + governance
  | "approval.request"
  | "approval.decide"
  | "preflight.run"
  // Execution (always governed, never bypasses approval)
  | "execution.terraform_apply"
  | "execution.cli_run"
  | "execution.rollback"
  // Operating loop / autonomy
  | "autonomy.next_actions"
  | "autonomy.run_safe_loop"
  | "autonomy.refresh_state"
  // Copilot + reasoning
  | "copilot.explain"
  | "copilot.next_step"
  // Audit + compliance
  | "audit.export_bundle"
  | "audit.validation_run"
  // Integration action layer (Phase 644-649)
  | "integration.github_issue"
  | "integration.slack_action_post"
  | "integration.linear_ticket"
  | "integration.dispatch_from_memory"
  // Workforce engineers (28+ engineers each fire their own action)
  | "engineer.run_domain"
  | "engineer.ask";

export type ActionCategory =
  | "providers"
  | "github_releaseops"
  | "security_remediation"
  | "simulation"
  | "approvals_governance"
  | "execution"
  | "operating_loop"
  | "copilot"
  | "audit_compliance"
  | "integrations"
  | "engineers";

export type WireStatus = "live" | "preview" | "needs_setup" | "blocked" | "planned";

export type SafetyTier = "read_only" | "preview" | "governed" | "unsafe";

export interface ActionDescriptor {
  kind: ActionKind;
  category: ActionCategory;
  label: string;
  summary: string;
  route: string;
  method: "GET" | "POST";
  wireStatus: WireStatus;
  /** File / module path that backs the claim. Cross-check with
   *  lib/validation/platformValidationMatrix.ts where applicable. */
  evidence: string;
  requiresAuth: boolean;
  requiresConnector?: "aws" | "azure" | "gcp" | "github" | "linear" | "slack";
  isMutation: boolean;
  safetyTier: SafetyTier;
  /** Honest blocker when wireStatus is "blocked" or "needs_setup". */
  blockedReason?: string;
  /** When ready, this is the engineer / system that runs it. */
  runner?: string;
}

/**
 * Phase 654: map an action to the operator-facing dashboard surface
 * where the action can be fired. Distinct from `route` (the API
 * endpoint). Returns undefined when no public surface fires this
 * action (e.g., blocked execution kinds, generic template routes).
 *
 * Kept as a pure lookup so the registry stays a flat data table.
 */
export function surfaceForAction(kind: ActionKind): string | undefined {
  // Cloud-provider validate + scan land on the connectors page where
  // the operator sets credentials and fires the live/preview run.
  if (kind === "aws.validate" || kind === "azure.validate" || kind === "gcp.validate") return "/dashboard/connectors";
  if (kind === "aws.scan" || kind === "aws.preview_scan")     return "/dashboard/security-scanner";
  if (kind === "azure.scan" || kind === "azure.preview_scan") return "/dashboard/security-scanner";
  if (kind === "gcp.scan" || kind === "gcp.preview_scan")     return "/dashboard/security-scanner";

  // GitHub + ReleaseOps
  if (kind === "github.validate" || kind === "github.scan" || kind === "github.preview_sync") return "/dashboard/connectors";
  if (kind === "releaseops.scan") return "/dashboard/releaseops";

  // Security + remediation
  if (kind === "security.run_scan") return "/dashboard/security-scanner";
  if (kind === "remediation.generate" || kind === "remediation.terraform_preview" || kind === "remediation.cli_preview") {
    return "/dashboard/remediation";
  }
  if (kind === "remediation.desktop_handoff") return "/dashboard/desktop";

  // Simulation
  if (kind === "simulation.create" || kind === "simulation.digital_twin") return "/dashboard/simulations";

  // Approvals + governance
  if (kind === "approval.request" || kind === "approval.decide" || kind === "preflight.run") return "/dashboard/approvals";

  // Operating loop
  if (kind === "autonomy.next_actions" || kind === "autonomy.run_safe_loop" || kind === "autonomy.refresh_state") {
    return "/dashboard/command-center";
  }

  // Copilot
  if (kind === "copilot.explain" || kind === "copilot.next_step") return "/dashboard/copilot";

  // Audit / compliance
  if (kind === "audit.export_bundle")  return "/dashboard/trust";
  if (kind === "audit.validation_run") return "/dashboard/validation";

  // Phase 644-649 integrations
  if (kind === "integration.github_issue" || kind === "integration.slack_action_post" || kind === "integration.linear_ticket") {
    return "/dashboard/workforce/integrations";
  }
  if (kind === "integration.dispatch_from_memory") return "/dashboard/agi-memory";

  // Workforce engineers
  if (kind === "engineer.run_domain" || kind === "engineer.ask") return "/dashboard/workforce";

  // Execution (intentionally no surface — blocked actions can't be
  // fired from the dashboard).
  return undefined;
}

export const ACTION_REGISTRY: ReadonlyArray<ActionDescriptor> = [
  // ─── PROVIDERS ─────────────────────────────────────────────────
  {
    kind: "aws.validate",
    category: "providers",
    label: "Validate AWS connection",
    summary: "STS AssumeRole + GetCallerIdentity against the configured AWS role.",
    route: "/api/aws/validate",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/cloud/aws/awsValidator.ts",
    requiresAuth: true,
    requiresConnector: "aws",
    isMutation: false,
    safetyTier: "read_only",
    runner: "awsValidator",
  },
  {
    kind: "aws.scan",
    category: "providers",
    label: "Run AWS read-only scan",
    summary: "Multi-region EC2 / S3 / RDS / VPC / SG inventory + findings + recommendations.",
    route: "/api/aws/scan",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/cloud/aws/awsMultiRegionInventory.ts + app/api/aws/scan/route.ts",
    requiresAuth: true,
    requiresConnector: "aws",
    isMutation: false,
    safetyTier: "read_only",
    runner: "cloudScanPipeline",
  },
  {
    kind: "aws.preview_scan",
    category: "providers",
    label: "AWS preview scan",
    summary: "Synthetic snapshot — runs without credentials so operators see the shape of findings.",
    route: "/api/aws/scan",
    method: "POST",
    wireStatus: "preview",
    evidence: "lib/cloud/aws/awsPreviewScanner.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "preview",
  },
  {
    kind: "azure.validate",
    category: "providers",
    label: "Validate Azure connection",
    summary: "Service principal validation via @azure/identity getToken + ARM REST.",
    route: "/api/azure/validate",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/cloud/azure/azureValidator.ts",
    requiresAuth: true,
    requiresConnector: "azure",
    isMutation: false,
    safetyTier: "read_only",
  },
  {
    kind: "azure.scan",
    category: "providers",
    label: "Run Azure scan",
    summary: "Live ARM resource inventory (VMs / Storage / VNet / NSG / SQL).",
    route: "/api/azure/scan",
    method: "POST",
    wireStatus: "needs_setup",
    evidence: "lib/cloud/azure/ — live inventory blocked pending arm-* SDK read traversal",
    requiresAuth: true,
    requiresConnector: "azure",
    isMutation: false,
    safetyTier: "read_only",
    blockedReason: "Live ARM inventory not yet wired — see VALIDATION_MATRIX azure.live_inventory.",
  },
  {
    kind: "azure.preview_scan",
    category: "providers",
    label: "Azure preview scan",
    summary: "Synthetic Azure snapshot — runs without credentials.",
    route: "/api/azure/scan",
    method: "POST",
    wireStatus: "preview",
    evidence: "lib/cloud/azure/azurePreviewScanner.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "preview",
  },
  {
    kind: "gcp.validate",
    category: "providers",
    label: "Validate GCP connection",
    summary: "Service account validation via @google-cloud/resource-manager.",
    route: "/api/gcp/validate",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/cloud/gcp/gcpValidator.ts",
    requiresAuth: true,
    requiresConnector: "gcp",
    isMutation: false,
    safetyTier: "read_only",
  },
  {
    kind: "gcp.scan",
    category: "providers",
    label: "Run GCP scan",
    summary: "Live Compute / Storage / Firewall inventory.",
    route: "/api/gcp/scan",
    method: "POST",
    wireStatus: "needs_setup",
    evidence: "lib/cloud/gcp/ — live inventory blocked pending @google-cloud/compute + storage read traversal",
    requiresAuth: true,
    requiresConnector: "gcp",
    isMutation: false,
    safetyTier: "read_only",
    blockedReason: "Live GCP inventory not yet wired — see VALIDATION_MATRIX gcp.live_inventory.",
  },
  {
    kind: "gcp.preview_scan",
    category: "providers",
    label: "GCP preview scan",
    summary: "Synthetic GCP snapshot — runs without credentials.",
    route: "/api/gcp/scan",
    method: "POST",
    wireStatus: "preview",
    evidence: "lib/cloud/gcp/gcpPreviewScanner.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "preview",
  },

  // ─── GITHUB / RELEASEOPS ───────────────────────────────────────
  {
    kind: "github.validate",
    category: "github_releaseops",
    label: "Validate GitHub token",
    summary: "Token check via /user endpoint.",
    route: "/api/connectors/github/validate",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/connectors/github/githubValidator.ts",
    requiresAuth: true,
    requiresConnector: "github",
    isMutation: false,
    safetyTier: "read_only",
  },
  {
    kind: "github.scan",
    category: "github_releaseops",
    label: "Scan GitHub workflows + branch protection",
    summary: "Live repo + workflow + branch-protection discovery.",
    route: "/api/connectors/github/sync",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/connectors/github/githubLiveScanner.ts",
    requiresAuth: true,
    requiresConnector: "github",
    isMutation: false,
    safetyTier: "read_only",
  },
  {
    kind: "github.preview_sync",
    category: "github_releaseops",
    label: "Preview GitHub repo + workflows",
    summary: "Preview inventory without credentials.",
    route: "/api/connectors/github/sync",
    method: "POST",
    wireStatus: "preview",
    evidence: "lib/connectors/github/githubPreviewSync.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "preview",
  },
  {
    kind: "releaseops.scan",
    category: "github_releaseops",
    label: "Run ReleaseOps scan",
    summary: "Detect pipeline blockers and release blockers across GitHub Actions.",
    route: "/api/releaseops/scan",
    method: "POST",
    wireStatus: "live",
    evidence: "app/api/releaseops/scan/route.ts",
    requiresAuth: true,
    requiresConnector: "github",
    isMutation: false,
    safetyTier: "read_only",
  },

  // ─── SECURITY + REMEDIATION ────────────────────────────────────
  {
    kind: "security.run_scan",
    category: "security_remediation",
    label: "Run security scan",
    summary: "Cloud misconfig + app + supply-chain + desktop boundary checks.",
    route: "/api/security-scan",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/securityScanner/securityScanner.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "read_only",
  },
  {
    kind: "remediation.generate",
    category: "security_remediation",
    label: "Generate remediation candidates",
    summary: "Convert findings into typed remediation candidates with terraform/CLI previews.",
    route: "/api/dashboard/remediation-generate",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/remediation/remediationPlanner.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "preview",
  },
  {
    kind: "remediation.terraform_preview",
    category: "security_remediation",
    label: "Generate Terraform preview",
    summary: "Typed HCL preview — no execution, no apply.",
    route: "/api/execution/terraform-preview",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/execution/terraformPreviewGenerator.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "preview",
  },
  {
    kind: "remediation.cli_preview",
    category: "security_remediation",
    label: "Generate CLI preview",
    summary: "AWS / Azure / GCP CLI command preview — copy-pasteable, no execution.",
    route: "/api/execution/cli-preview",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/execution/cliPreviewGenerator.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "preview",
  },
  {
    kind: "remediation.desktop_handoff",
    category: "security_remediation",
    label: "Hand off remediation to desktop",
    summary: "Signed HMAC handoff contract — operator reviews on desktop workstation before execution.",
    route: "/api/remediation/desktop-handoff",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/desktop/handoffContract.ts + handoffSigner.ts + handoffValidator.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "governed",
  },

  // ─── SIMULATION ────────────────────────────────────────────────
  {
    kind: "simulation.create",
    category: "simulation",
    label: "Simulate remediation",
    summary: "Build digital twin, run change, return before/after delta + blast radius estimate.",
    route: "/api/dashboard/simulation-run",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/simulation/executionSimulator.ts + lib/digitalTwin/digitalTwinBuilder.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "preview",
  },
  {
    kind: "simulation.digital_twin",
    category: "simulation",
    label: "Build digital twin",
    summary: "Project current cloud state into an in-memory replica for what-if analysis.",
    route: "/api/digital-twin/build",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/digitalTwin/digitalTwinBuilder.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "preview",
  },

  // ─── APPROVALS + GOVERNANCE ────────────────────────────────────
  {
    kind: "approval.request",
    category: "approvals_governance",
    label: "Request approval",
    summary: "Open AxiomApprovalChain — multi-level voting, quorum-enforced.",
    route: "/api/approvals/request",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/workforce/approvalQuorum.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "governed",
  },
  {
    kind: "approval.decide",
    category: "approvals_governance",
    label: "Approve / reject pending action",
    summary: "Cast vote on an AxiomApprovalItem.",
    route: "/api/approvals/decide",
    method: "POST",
    wireStatus: "live",
    evidence: "app/api/approvals/decide/route.ts",
    requiresAuth: true,
    isMutation: true,
    safetyTier: "governed",
  },
  {
    kind: "preflight.run",
    category: "approvals_governance",
    label: "Run preflight checks",
    summary: "Policy evaluation + blast radius + rollback plan before execution.",
    route: "/api/preflight/run",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/execution/preflightEngine.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "preview",
  },

  // ─── EXECUTION (always governed) ───────────────────────────────
  {
    kind: "execution.terraform_apply",
    category: "execution",
    label: "Apply Terraform plan",
    summary: "Execute approved Terraform plan against the connected cloud.",
    route: "/api/terraform/apply",
    method: "POST",
    wireStatus: "blocked",
    evidence: "app/api/terraform/apply/route.ts — credential handling + apply path not yet wired",
    requiresAuth: true,
    requiresConnector: "aws",
    isMutation: true,
    safetyTier: "unsafe",
    blockedReason: "Execution intentionally disabled until: (1) sandbox-tested credential provider via STS AssumeRole, (2) approval signature verification, (3) rollback plan attached.",
  },
  {
    kind: "execution.cli_run",
    category: "execution",
    label: "Execute CLI command via desktop",
    summary: "Operator executes approved CLI on their workstation — never server-side.",
    route: "(desktop-only)",
    method: "POST",
    wireStatus: "blocked",
    evidence: "lib/desktop/ — local execution intentionally disabled (localExecutionStatus: 'disabled')",
    requiresAuth: true,
    isMutation: true,
    safetyTier: "unsafe",
    blockedReason: "Local execution intentionally blocked at TypeScript level — desktop is read/review only until signed binaries ship.",
  },
  {
    kind: "execution.rollback",
    category: "execution",
    label: "Execute rollback",
    summary: "Run the pre-generated rollback plan for a failed apply.",
    route: "/api/execution/rollback",
    method: "POST",
    wireStatus: "blocked",
    evidence: "lib/execution/rollbackPlanGenerator.ts — plan generator wired, executor blocked on execution.terraform_apply",
    requiresAuth: true,
    isMutation: true,
    safetyTier: "unsafe",
    blockedReason: "Rollback path follows execution.terraform_apply — both ship together.",
  },

  // ─── OPERATING LOOP / AUTONOMY ─────────────────────────────────
  {
    kind: "autonomy.next_actions",
    category: "operating_loop",
    label: "Compute next best actions",
    summary: "Pure function over control-plane state — ranks safe self-serve actions ahead of contact CTAs.",
    route: "/api/control-plane/next-actions",
    method: "GET",
    wireStatus: "live",
    evidence: "lib/controlPlane/nextBestActionEngine.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "read_only",
  },
  {
    kind: "autonomy.run_safe_loop",
    category: "operating_loop",
    label: "Run autonomous safe loop",
    summary: "Observe → reason → plan → validate → govern → approve → prepare → verify → audit → remember. Stops at any approval gate.",
    route: "/api/control-plane/run-safe-task",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/controlPlane/autonomousOpsLoop.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "governed",
  },
  {
    kind: "autonomy.refresh_state",
    category: "operating_loop",
    label: "Refresh control plane state",
    summary: "Re-pull provider + connector + finding + approval state into the canonical CommandCenterState.",
    route: "/api/control-plane/refresh",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/controlPlane/controlPlaneBuilder.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "read_only",
  },

  // ─── COPILOT ───────────────────────────────────────────────────
  {
    kind: "copilot.explain",
    category: "copilot",
    label: "Ask Copilot to explain",
    summary: "Reasoning over real workspace state — explains findings, blockers, missing setup.",
    route: "/api/copilot",
    method: "POST",
    wireStatus: "live",
    evidence: "app/api/copilot/route.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "read_only",
  },
  {
    kind: "copilot.next_step",
    category: "copilot",
    label: "Ask Copilot what's next",
    summary: "Copilot computes next best action with rationale tied to workspace state.",
    route: "/api/copilot",
    method: "POST",
    wireStatus: "live",
    evidence: "app/api/copilot/route.ts (intent=next_step)",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "read_only",
  },

  // ─── AUDIT + COMPLIANCE ────────────────────────────────────────
  {
    kind: "audit.export_bundle",
    category: "audit_compliance",
    label: "Export evidence bundle",
    summary: "JSON / NDJSON compliance bundle covering 19 typed controls.",
    route: "/api/compliance/bundle",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/compliance/evidenceBundle.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "read_only",
  },
  {
    kind: "audit.validation_run",
    category: "audit_compliance",
    label: "Run platform validation",
    summary: "Walk every row of platformValidationMatrix.ts and re-verify the evidence ref still resolves.",
    route: "/api/control-plane/validate",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/validation/platformValidationMatrix.ts + lib/validation/deepValidationRunner.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "read_only",
  },

  // ─── INTEGRATIONS (Phase 644-649) ──────────────────────────────
  {
    kind: "integration.github_issue",
    category: "integrations",
    label: "Open GitHub issue from finding",
    summary: "POST issues to api.github.com/repos/{repo}/issues via configured PAT (env://, vault://, secretsmanager://).",
    route: "/api/workforce/integrations/github/test",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/workforce/domains/actionExecutor.ts (Phase 644-647)",
    requiresAuth: true,
    requiresConnector: "github",
    isMutation: true,
    safetyTier: "governed",
  },
  {
    kind: "integration.slack_action_post",
    category: "integrations",
    label: "Post finding to Slack",
    summary: "Block Kit message to configured hooks.slack.com webhook.",
    route: "/api/workforce/integrations/slack-actions",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/workforce/domains/actionExecutor.ts",
    requiresAuth: true,
    requiresConnector: "slack",
    isMutation: true,
    safetyTier: "governed",
  },
  {
    kind: "integration.linear_ticket",
    category: "integrations",
    label: "File Linear ticket",
    summary: "GraphQL issueCreate against api.linear.app for non-engineering trackers (PM, ops, finance).",
    route: "/api/workforce/integrations/linear/test",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/workforce/domains/actionExecutor.ts (Phase 648)",
    requiresAuth: true,
    requiresConnector: "linear",
    isMutation: true,
    safetyTier: "governed",
  },
  {
    kind: "integration.dispatch_from_memory",
    category: "integrations",
    label: "Dispatch any rationale row to integrations",
    summary: "Operator-initiated fan-out from /dashboard/agi-memory drilldown to all enabled integrations in parallel.",
    route: "/api/workforce/integrations/dispatch-from-memory",
    method: "POST",
    wireStatus: "live",
    evidence: "app/api/workforce/integrations/dispatch-from-memory/route.ts (Phase 649)",
    requiresAuth: true,
    isMutation: true,
    safetyTier: "governed",
  },

  // ─── WORKFORCE ENGINEERS ───────────────────────────────────────
  {
    kind: "engineer.run_domain",
    category: "engineers",
    label: "Run engineer domain task",
    summary: "Invoke one of the 28+ specialized engineers (anomaly, finops, compliance_framework, dr_planner, workload_performance, etc.).",
    route: "/api/workforce/{engineer_id}/run-domain",
    method: "POST",
    wireStatus: "live",
    evidence: "lib/workforce/agentWorkforceRegistry.ts + 28 engineer domain modules",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "read_only",
  },
  {
    kind: "engineer.ask",
    category: "engineers",
    label: "Ask an engineer a question",
    summary: "Free-form question against a specific engineer's domain expertise.",
    route: "/api/workforce/{engineer_id}/ask",
    method: "POST",
    wireStatus: "live",
    evidence: "app/api/workforce/[id]/ask/route.ts",
    requiresAuth: true,
    isMutation: false,
    safetyTier: "read_only",
  },
];

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

export function getActionsByCategory(): Record<ActionCategory, ActionDescriptor[]> {
  const out: Partial<Record<ActionCategory, ActionDescriptor[]>> = {};
  for (const a of ACTION_REGISTRY) {
    if (!out[a.category]) out[a.category] = [];
    out[a.category]!.push(a);
  }
  return out as Record<ActionCategory, ActionDescriptor[]>;
}

export function getActionsByStatus(): Record<WireStatus, ActionDescriptor[]> {
  const out: Record<WireStatus, ActionDescriptor[]> = {
    live: [], preview: [], needs_setup: [], blocked: [], planned: [],
  };
  for (const a of ACTION_REGISTRY) out[a.wireStatus].push(a);
  return out;
}

export interface RegistryHonestyCounts {
  total: number;
  live: number;
  preview: number;
  needs_setup: number;
  blocked: number;
  planned: number;
  mutations: number;
  governed: number;
  unsafe: number;
}

export function computeHonestyCounts(): RegistryHonestyCounts {
  const status = getActionsByStatus();
  return {
    total: ACTION_REGISTRY.length,
    live: status.live.length,
    preview: status.preview.length,
    needs_setup: status.needs_setup.length,
    blocked: status.blocked.length,
    planned: status.planned.length,
    mutations: ACTION_REGISTRY.filter((a) => a.isMutation).length,
    governed: ACTION_REGISTRY.filter((a) => a.safetyTier === "governed").length,
    unsafe: ACTION_REGISTRY.filter((a) => a.safetyTier === "unsafe").length,
  };
}

export const CATEGORY_LABEL: Record<ActionCategory, string> = {
  providers: "Cloud providers",
  github_releaseops: "GitHub & ReleaseOps",
  security_remediation: "Security & remediation",
  simulation: "Simulation & digital twin",
  approvals_governance: "Approvals & governance",
  execution: "Execution",
  operating_loop: "Operating loop & autonomy",
  copilot: "Copilot & reasoning",
  audit_compliance: "Audit & compliance",
  integrations: "Action integrations",
  engineers: "Workforce engineers",
};

export const STATUS_LABEL: Record<WireStatus, string> = {
  live: "Live",
  preview: "Preview",
  needs_setup: "Needs setup",
  blocked: "Blocked",
  planned: "Planned",
};

export const SAFETY_LABEL: Record<SafetyTier, string> = {
  read_only: "Read-only",
  preview: "Preview only",
  governed: "Governed (approval-gated)",
  unsafe: "Unsafe (execution-blocked)",
};

/**
 * Phase 665: composite platform-state score for /api/capabilities/health.
 *
 * Pure function so external monitoring + Copilot get a stable
 * 0..100 score they can chart. Weighted blend, NOT a synthetic SLO:
 *
 *   · 40% action liveness — (live actions) / (total actions in registry)
 *   · 60% validation matrix score — already 0..1 weighted by status
 *     (passing=1.0, partial=0.6, preview=0.4, blocked=0.2, failing=0)
 *
 * The matrix has more weight because it's evidence-backed; the
 * registry counts what's CLAIMED to be live. A drift between the
 * two (high registry liveness but low matrix score) signals
 * overclaiming.
 *
 * Inputs clamped to [0, 1] for honest behavior on bad calls.
 */
export function computeCompositeHealthScore(liveActionRatio: number, matrixScore: number): number {
  const a = Math.max(0, Math.min(1, liveActionRatio));
  const m = Math.max(0, Math.min(1, matrixScore));
  return Math.round(((a * 0.4) + (m * 0.6)) * 100);
}
