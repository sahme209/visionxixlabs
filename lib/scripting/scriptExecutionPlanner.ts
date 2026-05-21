/**
 * Pure script execution planner.
 *
 * Input: a validated Python script manifest + caller-supplied params
 * + chosen execution mode + approval state + (when desktop) local
 * capability set. Output: a typed ExecutionPlan with a closed-union
 * verdict — only `ready` plans are eligible to dispatch.
 *
 * No I/O. Composers (server actions / runtime hosts) call this to
 * decide whether to dispatch a script and what the plan looks like.
 * The audit row hashes the JSON-serialised ExecutionPlan so the
 * exact bytes that executed are replayable.
 *
 * Closed unions on every state so new shapes break the build.
 */

import {
  validateInputs,
  type PythonScriptManifest,
  type ValidatedInputValue,
  type ScriptRiskTier,
} from "./pythonScriptContract";
import { resolveScriptForRuntime, type DesktopCapability, type DesktopOs } from "@/lib/desktop/desktopScriptCatalog";

export type ExecutionMode = "cloud" | "desktop";

export type PlanVerdict =
  | "ready"
  | "blocked_input_invalid"
  | "blocked_missing_approval"
  | "blocked_dry_run_required"
  | "blocked_capability_missing"
  | "blocked_os_unsupported"
  | "blocked_script_unknown";

export interface ScriptExecutionPlan {
  /** Script manifest id — the exact script. */
  scriptId: string;
  /** Execution mode chosen by the operator. */
  mode: ExecutionMode;
  /** Validated input values — only present when verdict=ready. */
  inputs: Readonly<Record<string, ValidatedInputValue>>;
  /** Closed-union risk tier (mirrors manifest). */
  riskTier: ScriptRiskTier;
  /** True when the operator requested dry-run. */
  dryRun: boolean;
  /** Whether the platform has the approval packet signed. */
  approved: boolean;
  /** Approver email (for audit hash). */
  approverEmail: string | null;
  /** Timeout the runtime should enforce. */
  timeoutSeconds: number;
  /** Allowed exit codes — runtime fails anything else. */
  allowedExitCodes: readonly number[];
  /** Verdict — only `ready` plans are eligible to dispatch. */
  verdict: PlanVerdict;
  /** Operator-readable rationale for the verdict. */
  rationale: string;
  /** Optional rollback note from the manifest. */
  rollbackNote: string | null;
}

export interface PlanRequest {
  manifest: PythonScriptManifest;
  inputs: Readonly<Record<string, unknown>>;
  mode: ExecutionMode;
  dryRun: boolean;
  approval: { state: "pending" | "approved" | "rejected"; approverEmail?: string };
  /** For mode=desktop, the runtime's OS + capability inventory. */
  desktopContext?: { os: DesktopOs; available: ReadonlyArray<DesktopCapability> };
}

function blocked(req: PlanRequest, verdict: Exclude<PlanVerdict, "ready">, rationale: string): ScriptExecutionPlan {
  return {
    scriptId: req.manifest.id,
    mode: req.mode,
    inputs: {},
    riskTier: req.manifest.riskTier,
    dryRun: req.dryRun,
    approved: req.approval.state === "approved",
    approverEmail: req.approval.approverEmail ?? null,
    timeoutSeconds: req.manifest.timeoutSeconds,
    allowedExitCodes: req.manifest.allowedExitCodes,
    verdict,
    rationale,
    rollbackNote: req.manifest.rollbackNote,
  };
}

export function planScriptExecution(req: PlanRequest): ScriptExecutionPlan {
  const m = req.manifest;

  // Rule 1: high/critical risk requires dry-run on first pass.
  // Cloud + desktop both enforce: if the operator asks for a real run
  // at high/critical risk without supportsDryRun, refuse.
  if ((m.riskTier === "high" || m.riskTier === "critical") && !req.dryRun && !m.supportsDryRun) {
    return blocked(
      req,
      "blocked_dry_run_required",
      `Script ${m.id} is ${m.riskTier} risk but the manifest doesn't declare dry-run support — refuse.`,
    );
  }

  // Rule 2: approval state.
  // dry-run can proceed without approval (it's read-only by contract).
  // Real runs require approved.
  if (!req.dryRun && req.approval.state !== "approved") {
    return blocked(
      req,
      "blocked_missing_approval",
      `Real run requires an approved packet. Current approval state: ${req.approval.state}.`,
    );
  }

  // Rule 3: input validation.
  const inputCheck = validateInputs(m, req.inputs);
  if (!inputCheck.ok) {
    return blocked(
      req,
      "blocked_input_invalid",
      `Input validation failed: ${inputCheck.errors.map((e) => `${e.name}: ${e.message}`).join("; ")}`,
    );
  }

  // Rule 4: when mode=desktop, the runtime must have every required
  // capability. The catalog resolver is the canonical answer.
  if (req.mode === "desktop") {
    if (!req.desktopContext) {
      return blocked(req, "blocked_capability_missing", "desktopContext required when mode=desktop.");
    }
    const r = resolveScriptForRuntime(m.id, req.desktopContext.os, req.desktopContext.available);
    if (!r.ok) {
      if (r.reason === "unknown_script") {
        return blocked(req, "blocked_script_unknown", `Script ${m.id} is not registered in the desktop catalog.`);
      }
      if (r.reason === "os_unsupported") {
        return blocked(req, "blocked_os_unsupported", `Script ${m.id} does not support OS ${req.desktopContext.os}.`);
      }
      return blocked(
        req,
        "blocked_capability_missing",
        `Desktop runtime is missing required capability: ${r.missing}.`,
      );
    }
  }

  // All gates passed — plan is ready.
  return {
    scriptId: m.id,
    mode: req.mode,
    inputs: inputCheck.values,
    riskTier: m.riskTier,
    dryRun: req.dryRun,
    approved: req.approval.state === "approved",
    approverEmail: req.approval.approverEmail ?? null,
    timeoutSeconds: m.timeoutSeconds,
    allowedExitCodes: m.allowedExitCodes,
    verdict: "ready",
    rationale: req.dryRun
      ? `Dry-run cleared on ${req.mode} runtime. No mutations expected.`
      : `Approved real run on ${req.mode} runtime. Timeout ${m.timeoutSeconds}s.`,
    rollbackNote: m.rollbackNote,
  };
}

/**
 * Stable JSON serializer for the execution plan — used by the auditor
 * to hash the plan bytes before dispatch. Sorts object keys so two
 * equivalent plans hash to the same digest.
 */
export function canonicalPlanJson(plan: ScriptExecutionPlan): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(o).sort()) sorted[k] = sortKeys(o[k]);
      return sorted;
    }
    return v;
  };
  return JSON.stringify(sortKeys(plan));
}
