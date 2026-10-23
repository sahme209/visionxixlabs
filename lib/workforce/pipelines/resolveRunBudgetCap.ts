/**
 * Pure budget-cap resolution kernel — Phase 401.
 *
 * Decides the effective per-run cost cap for a pipeline run by walking
 * a strict priority chain. Closed-union BudgetCapSource so the audit
 * trail records WHY a given cap was used (debug for "why did this
 * enterprise run halt at $5?").
 *
 * Saved administrator policy selects the allowance: pipeline override,
 * workspace default, then the finite platform default. Request metadata
 * may only tighten that allowance. A caller cannot grant itself a larger
 * cap or unlimited spending by supplying run metadata.
 *
 * Pure — no I/O.
 */

import { DEFAULT_RUN_MAX_CENTS } from "./assertRunCostBudget";

export type BudgetCapSource =
  | "metadata_explicit_cap"
  | "metadata_unlimited"
  | "org_pipeline_override"
  | "org_pipeline_override_unlimited"
  | "org_default"
  | "org_default_unlimited"
  | "platform_default";

export interface OrganizationBudgetConfigShape {
  /** null = unlimited at the workspace level (Enterprise). */
  defaultMaxCostCents: number | null;
  /** Per-pipeline overrides. null cap = unlimited for that pipeline. */
  pipelineOverrides: ReadonlyArray<{
    pipelineId: string;
    maxCostCents: number | null;
  }>;
}

export interface ResolveBudgetCapInput {
  pipelineId: string;
  /** Run-level metadata as supplied by the trigger. */
  runMetadata?: Record<string, unknown> | null;
  /** Per-org config (null when the workspace hasn't set one). */
  orgConfig?: OrganizationBudgetConfigShape | null;
}

export interface ResolveBudgetCapResult {
  /** Effective cap in cents. null = unlimited. */
  maxCents: number | null;
  /** Which source resolved the cap (for audit). */
  source: BudgetCapSource;
}

function readMetadataCap(metadata: Record<string, unknown> | null | undefined):
  | { kind: "explicit"; cents: number }
  | { kind: "absent" }
{
  if (!metadata) return { kind: "absent" };
  const m = metadata.maxCostCents;
  if (typeof m === "number" && Number.isFinite(m) && m > 0) {
    return { kind: "explicit", cents: Math.floor(m) };
  }
  return { kind: "absent" };
}

export function resolveRunBudgetCap(input: ResolveBudgetCapInput): ResolveBudgetCapResult {
  const policy = resolveConfiguredBudgetCap(input);
  const meta = readMetadataCap(input.runMetadata);
  if (meta.kind === "explicit" && (policy.maxCents === null || meta.cents < policy.maxCents)) {
    return { maxCents: meta.cents, source: "metadata_explicit_cap" };
  }
  return policy;
}

function resolveConfiguredBudgetCap(input: ResolveBudgetCapInput): ResolveBudgetCapResult {
  // 3. Per-pipeline override on the org config.
  if (input.orgConfig) {
    const hit = input.orgConfig.pipelineOverrides.find(
      (p) => p.pipelineId === input.pipelineId,
    );
    if (hit) {
      if (hit.maxCostCents === null) {
        return { maxCents: null, source: "org_pipeline_override_unlimited" };
      }
      if (Number.isFinite(hit.maxCostCents) && hit.maxCostCents > 0) {
        return { maxCents: Math.floor(hit.maxCostCents), source: "org_pipeline_override" };
      }
    }

    // 4. Org-level default.
    if (input.orgConfig.defaultMaxCostCents === null) {
      return { maxCents: null, source: "org_default_unlimited" };
    }
    if (
      Number.isFinite(input.orgConfig.defaultMaxCostCents) &&
      input.orgConfig.defaultMaxCostCents > 0
    ) {
      return {
        maxCents: Math.floor(input.orgConfig.defaultMaxCostCents),
        source: "org_default",
      };
    }
  }

  // 5. Platform default. Never null — defense in depth.
  return { maxCents: DEFAULT_RUN_MAX_CENTS, source: "platform_default" };
}
