/**
 * Pure budget-cap resolution kernel — Phase 401.
 *
 * Decides the effective per-run cost cap for a pipeline run by walking
 * a strict priority chain. Closed-union BudgetCapSource so the audit
 * trail records WHY a given cap was used (debug for "why did this
 * enterprise run halt at $5?").
 *
 * Priority (highest wins):
 *
 *   1. metadata.maxCostCents           — operator overrode this single run
 *   2. metadata.unlimitedBudget        — operator explicitly waived the cap
 *   3. orgConfig.pipelineOverrides[id] — per-pipeline cap for this workspace
 *   4. orgConfig.defaultMaxCostCents   — per-workspace default
 *   5. DEFAULT_RUN_MAX_CENTS           — platform-wide default ($5.00)
 *
 * Each source can resolve to `null` (= unlimited) ONLY at levels 2-4;
 * the platform default is never null (defense in depth so a missing
 * config doesn't accidentally enable unlimited spend).
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
  | { kind: "unlimited" }
  | { kind: "absent" }
{
  if (!metadata) return { kind: "absent" };
  if (metadata.unlimitedBudget === true) return { kind: "unlimited" };
  const m = metadata.maxCostCents;
  if (typeof m === "number" && Number.isFinite(m) && m > 0) {
    return { kind: "explicit", cents: Math.floor(m) };
  }
  return { kind: "absent" };
}

export function resolveRunBudgetCap(input: ResolveBudgetCapInput): ResolveBudgetCapResult {
  // 1 / 2. Per-run metadata overrides.
  const meta = readMetadataCap(input.runMetadata ?? null);
  if (meta.kind === "explicit") {
    return { maxCents: meta.cents, source: "metadata_explicit_cap" };
  }
  if (meta.kind === "unlimited") {
    return { maxCents: null, source: "metadata_unlimited" };
  }

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
