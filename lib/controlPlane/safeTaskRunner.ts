/**
 * Safe Task Runner.
 *
 * Executes non-destructive control-plane tasks. Every task type is on an
 * allow-list — anything not on the list is rejected with a typed blocked
 * response. Destructive operations (apply / mutate / delete) are never
 * allowed here; they go through the approval + execution adapter path.
 */

import "server-only";

import { runSecurityScan, type SecurityScanOutcome } from "@/lib/securityScanner/securityScanner";
import { runAutonomousValidationLoop, type AutonomousValidationReport } from "@/lib/validation/autonomousValidationLoop";
import { runDeepValidation, type DeepValidationReport } from "@/lib/validation/deepValidationRunner";
import { runRemediationPipeline, type RemediationPipelineOutcome } from "@/lib/remediation/remediationPipeline";
import { runPreflight, type PreflightOutcome, type PreflightInput } from "@/lib/execution/preflightEngine";
import { runSimulation, type SimulationResult } from "@/lib/simulation/executionSimulator";
import { buildDigitalTwin } from "@/lib/digitalTwin/digitalTwinBuilder";
import type { DigitalTwin } from "@/lib/digitalTwin/digitalTwinModel";
import { changeSetFromCandidate } from "@/lib/simulation/changeSetModel";
import { listDiagnoses, diagnoseFromError, type Diagnosis } from "@/lib/troubleshooting/selfServeTroubleshooter";
import { loadAppEnv } from "@/lib/config/env";

// ---------------------------------------------------------------------------
// Task taxonomy
// ---------------------------------------------------------------------------

export type SafeTaskKind =
  | "validate_provider_config"
  | "run_preview_scan"
  | "run_live_readonly_scan"
  | "run_security_scanner"
  | "build_digital_twin"
  | "build_remediation_candidates"
  | "build_simulation"
  | "run_preflight"
  | "run_validation_loop"
  | "run_deep_validation"
  | "generate_audit_bundle"
  | "diagnose_failure"
  | "refresh_control_plane";

export type SafeTaskRunStatus = "completed" | "completed_with_warnings" | "blocked" | "failed";

export interface SafeTaskRunInput {
  kind: SafeTaskKind;
  /** Free-form payload — each task validates its own shape. */
  payload?: unknown;
}

export interface SafeTaskRunResult {
  kind: SafeTaskKind;
  status: SafeTaskRunStatus;
  /** Plain-language outcome. */
  summary: string;
  /** Typed task payload — narrow to the task kind on the caller side. */
  data?:
    | SecurityScanOutcome
    | AutonomousValidationReport
    | DeepValidationReport
    | RemediationPipelineOutcome
    | PreflightOutcome
    | SimulationResult
    | DigitalTwin
    | Diagnosis[]
    | { knownTasks: SafeTaskKind[] };
  /** Refs callers can deep-link to. */
  evidenceRefs: { label: string; ref: string }[];
  /** When blocked, the reason. */
  blockedReason?: string;
  /** Safe alternative the operator can run instead. */
  safeAlternative?: { label: string; href?: string };
}

// ---------------------------------------------------------------------------
// Blocklist — kinds that must NEVER be allowed via this runner.
// ---------------------------------------------------------------------------

const BLOCKED_TASKS = new Set<string>([
  "apply_terraform",
  "execute_cloud_cli",
  "modify_iam",
  "change_security_group",
  "change_storage_access",
  "change_branch_protection",
  "deploy_production",
  "desktop_local_execute",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function blocked(kind: SafeTaskKind, reason: string, alt?: SafeTaskRunResult["safeAlternative"]): SafeTaskRunResult {
  return {
    kind,
    status: "blocked",
    summary: `${kind} blocked: ${reason}`,
    evidenceRefs: [],
    blockedReason: reason,
    safeAlternative: alt,
  };
}

function failure(kind: SafeTaskKind, err: unknown): SafeTaskRunResult {
  return {
    kind,
    status: "failed",
    summary: `${kind} failed`,
    evidenceRefs: [{ label: "error", ref: String(err).slice(0, 240) }],
  };
}

// ---------------------------------------------------------------------------
// Task implementations
// ---------------------------------------------------------------------------

async function runSafeSecurityScan(): Promise<SafeTaskRunResult> {
  const env = loadAppEnv();
  const outcome = await runSecurityScan({
    app: {
      redactionActive: true,
      auditStoreConfigured: true,
      copilotContextSafe: true,
      tenantScopeEnforcedServerSide: false,
      rbacWiredOnRoutes: false,
      desktopApplyBlockedByDefault: true,
    },
    supplyChain: {
      lockfileCommitted: true,
      dependencyScanRun: false,
      secretScanningActive: false,
      buildSigningWired: false,
    },
    desktop: {
      macosSigned: false,
      macosNotarized: false,
      windowsSigned: false,
      linuxSigned: false,
      handoffSignerConfigured: env.desktopHandoffSigningKeySet || Boolean(env.nextAuthSecret),
      localApplyBlockedByDefault: true,
    },
  });
  return {
    kind: "run_security_scanner",
    status: "completed",
    summary: `${outcome.results.length} checks · score ${outcome.summary.score}/100`,
    data: outcome,
    evidenceRefs: [{ label: "results", ref: `${outcome.results.length}` }],
  };
}

async function runSafeValidationLoop(): Promise<SafeTaskRunResult> {
  const report = await runAutonomousValidationLoop();
  return {
    kind: "run_validation_loop",
    status: report.brokenFlows.length === 0 ? "completed" : "completed_with_warnings",
    summary: `${report.overall.passing}/${report.overall.total} probes passing`,
    data: report,
    evidenceRefs: [{ label: "score", ref: `${report.overall.score}` }],
  };
}

async function runSafeDeepValidation(): Promise<SafeTaskRunResult> {
  const report = await runDeepValidation();
  return {
    kind: "run_deep_validation",
    status: report.summary.failing > 0 ? "completed_with_warnings" : "completed",
    summary: report.narrative,
    data: report,
    evidenceRefs: [{ label: "score", ref: `${report.summary.score}` }],
  };
}

async function runSafeRemediationBuild(): Promise<SafeTaskRunResult> {
  const outcome = await runRemediationPipeline();
  return {
    kind: "build_remediation_candidates",
    status: "completed",
    summary: `${outcome.summary.total} candidate(s) · ${outcome.summary.approvalGated} approval-gated`,
    data: outcome,
    evidenceRefs: [{ label: "candidates", ref: `${outcome.summary.total}` }],
  };
}

async function runSafeTwinBuild(): Promise<SafeTaskRunResult> {
  const twin = await buildDigitalTwin();
  return {
    kind: "build_digital_twin",
    status: "completed",
    summary: `${twin.resources.length} resources · ${twin.relationships.length} relationships · source ${twin.sourceMode}`,
    data: twin,
    evidenceRefs: [{ label: "twin", ref: twin.id }],
  };
}

async function runSafeSimulation(payload: unknown): Promise<SafeTaskRunResult> {
  const v = payload as { candidateId?: string } | null | undefined;
  if (!v || typeof v.candidateId !== "string") {
    return blocked("build_simulation", "Missing candidateId in payload.", { label: "Open Remediation Center", href: "/dashboard/remediation" });
  }
  const [pipeline, twin] = await Promise.all([runRemediationPipeline(), buildDigitalTwin()]);
  const bundle = pipeline.bundles.find((b) => b.candidate.id === v.candidateId);
  if (!bundle) return blocked("build_simulation", "Candidate not found in current pipeline run.");
  const target = twin.resources.find((r) => bundle.candidate.resourceIds.includes(r.id));
  const cs = changeSetFromCandidate(bundle.candidate, target);
  const result = runSimulation({ twin, changeSet: cs });
  return {
    kind: "build_simulation",
    status: "completed",
    summary: result.summary,
    data: result,
    evidenceRefs: [{ label: "twin", ref: twin.id }, { label: "changeSet", ref: cs.id }],
  };
}

function runSafePreflight(payload: unknown): SafeTaskRunResult {
  const v = payload as Partial<PreflightInput> | null | undefined;
  if (!v) return blocked("run_preflight", "Missing preflight signals.");
  // Defensive defaults so partial payloads still produce a result.
  const filled: PreflightInput = {
    sourceMode: (v.sourceMode ?? "preview") as PreflightInput["sourceMode"],
    providerConnected: v.providerConnected ?? false,
    resourceExists: v.resourceExists ?? false,
    snapshotAgeMs: v.snapshotAgeMs,
    maxSnapshotAgeMs: v.maxSnapshotAgeMs,
    simulationPresent: v.simulationPresent ?? false,
    policyPresent: v.policyPresent ?? false,
    approvalPresent: v.approvalPresent ?? false,
    approvalStatus: v.approvalStatus ?? "pending",
    rollbackPresent: v.rollbackPresent ?? false,
    verificationPresent: v.verificationPresent ?? false,
    auditWired: v.auditWired ?? false,
    desktopHandoffValid: v.desktopHandoffValid,
    hasRequiredPermissions: v.hasRequiredPermissions ?? false,
    featureModeAllows: v.featureModeAllows ?? false,
    unknownDestructive: v.unknownDestructive ?? false,
    stalePlan: v.stalePlan ?? false,
    conflictingWorkflowRunning: v.conflictingWorkflowRunning ?? false,
  };
  const result = runPreflight(filled);
  return {
    kind: "run_preflight",
    status: result.status === "failed" ? "completed_with_warnings" : "completed",
    summary: `${result.checks.length} checks · status ${result.status}`,
    data: result,
    evidenceRefs: [{ label: "checks", ref: `${result.checks.length}` }],
  };
}

function runSafeDiagnose(payload: unknown): SafeTaskRunResult {
  const v = payload as { message?: string; diagnosisId?: string } | null | undefined;
  let matches: Diagnosis[] = [];
  if (v?.diagnosisId) {
    const all = listDiagnoses();
    matches = all.filter((d) => d.id === v.diagnosisId);
  } else if (v?.message) {
    matches = diagnoseFromError(v.message);
  }
  return {
    kind: "diagnose_failure",
    status: "completed",
    summary: `${matches.length} diagnosis match(es)`,
    data: matches,
    evidenceRefs: matches.map((d) => ({ label: "id", ref: d.id })),
  };
}

// ---------------------------------------------------------------------------
// Public runner
// ---------------------------------------------------------------------------

export async function runSafeTask(input: SafeTaskRunInput): Promise<SafeTaskRunResult> {
  // Hard block — explicit unsafe task names.
  if (BLOCKED_TASKS.has(String(input.kind))) {
    return blocked(input.kind, "This task class is destructive and is never permitted via the safe task runner.", {
      label: "Open Orchestration Center", href: "/dashboard/orchestration",
    });
  }

  try {
    switch (input.kind) {
      case "validate_provider_config":
      case "run_preview_scan":
      case "run_live_readonly_scan":
        return runSafeSecurityScan();
      case "run_security_scanner":         return runSafeSecurityScan();
      case "build_digital_twin":           return runSafeTwinBuild();
      case "build_remediation_candidates": return runSafeRemediationBuild();
      case "build_simulation":             return runSafeSimulation(input.payload);
      case "run_preflight":                return runSafePreflight(input.payload);
      case "run_validation_loop":          return runSafeValidationLoop();
      case "run_deep_validation":          return runSafeDeepValidation();
      case "diagnose_failure":             return runSafeDiagnose(input.payload);
      case "generate_audit_bundle":
        return blocked("generate_audit_bundle", "Audit bundle export wiring is preview-only at this layer; use /dashboard/trust to export.", {
          label: "Open Trust Center", href: "/dashboard/trust",
        });
      case "refresh_control_plane":
        return {
          kind: "refresh_control_plane",
          status: "completed",
          summary: "Control plane refresh is idempotent — re-call /api/control-plane/state.",
          evidenceRefs: [],
          data: { knownTasks: listSafeTaskKinds() },
        };
      default: {
        return blocked(input.kind, "Unknown task kind.");
      }
    }
  } catch (err) {
    return failure(input.kind, err);
  }
}

export function listSafeTaskKinds(): SafeTaskKind[] {
  return [
    "validate_provider_config",
    "run_preview_scan",
    "run_live_readonly_scan",
    "run_security_scanner",
    "build_digital_twin",
    "build_remediation_candidates",
    "build_simulation",
    "run_preflight",
    "run_validation_loop",
    "run_deep_validation",
    "generate_audit_bundle",
    "diagnose_failure",
    "refresh_control_plane",
  ];
}

export function isSafeTaskKind(kind: string): kind is SafeTaskKind {
  return (listSafeTaskKinds() as string[]).includes(kind);
}
