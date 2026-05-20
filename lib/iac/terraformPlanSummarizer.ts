/**
 * Pure terraform-plan summarizer.
 *
 * Operator pastes a `terraform plan -json`-style resource_changes
 * array; we fold it into per-action counts + per-provider counts +
 * a list of destructive changes that operators should review before
 * approving the PR.
 *
 * Pure / deterministic. No DB.
 */

export type PlanActionKind = "create" | "read" | "update" | "delete" | "no-op" | "replace";

export interface PlanResourceChange {
  address: string;             // e.g. "aws_s3_bucket.axiom"
  /** Provider stem like "aws", "google", "azurerm". */
  provider: string;
  /**
   * Raw action array from terraform plan JSON, e.g. ["create"] or
   * ["delete", "create"] (which we normalize to a single "replace").
   */
  actions: readonly string[];
}

export interface PlanRow {
  address: string;
  provider: string;
  kind: PlanActionKind;
}

export interface PlanSummary {
  rows: PlanRow[];
  counts: Record<PlanActionKind, number>;
  byProvider: Array<{ provider: string; count: number }>;
  destructive: PlanRow[];      // rows with kind "delete" or "replace"
  /** Severity ladder for the plan. */
  severity: "noop" | "low" | "medium" | "high";
}

const normalize = (actions: readonly string[]): PlanActionKind => {
  const set = new Set(actions);
  // "delete" + "create" → replace.
  if (set.has("delete") && set.has("create")) return "replace";
  if (set.has("delete")) return "delete";
  if (set.has("create")) return "create";
  if (set.has("update")) return "update";
  if (set.has("read"))   return "read";
  return "no-op";
};

export function summarizeTerraformPlan(changes: readonly PlanResourceChange[]): PlanSummary {
  const rows: PlanRow[] = changes.map((c) => ({
    address: c.address,
    provider: c.provider,
    kind: normalize(c.actions),
  }));

  const counts: PlanSummary["counts"] = {
    create: 0, read: 0, update: 0, delete: 0, "no-op": 0, replace: 0,
  };
  const byProviderMap = new Map<string, number>();
  for (const r of rows) {
    counts[r.kind] += 1;
    byProviderMap.set(r.provider, (byProviderMap.get(r.provider) ?? 0) + 1);
  }

  const byProvider = [...byProviderMap.entries()]
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count);

  const destructive = rows.filter((r) => r.kind === "delete" || r.kind === "replace");

  let severity: PlanSummary["severity"] = "noop";
  if (destructive.length >= 5) severity = "high";
  else if (destructive.length >= 1) severity = "medium";
  else if (counts.create + counts.update >= 1) severity = "low";

  return { rows, counts, byProvider, destructive, severity };
}
