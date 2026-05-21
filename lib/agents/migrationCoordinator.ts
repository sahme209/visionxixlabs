/**
 * Pure AGI-Engineer migration coordinator.
 *
 * Input: a single migration descriptor — what's changing, the kind
 * of change, the dual-write window the operator wants, and whether
 * a reverse path exists. Output: a typed runbook with stages, gate
 * checks between stages, and a rollback plan per stage.
 *
 * Why this kernel exists: schema and API migrations are where
 * autonomous engineering most often goes wrong, because the safe
 * answer involves a backwards-compat *window* — not a single
 * commit. This kernel forces that window to be explicit.
 *
 * Pure / deterministic. Closed unions on migration kind + stage
 * verdict so new shapes break the build.
 */

export type MigrationKind =
  | "add_column"
  | "drop_column"
  | "rename_column"
  | "add_table"
  | "drop_table"
  | "alter_index"
  | "alter_api_contract";

export type StageKind =
  | "preflight"          // dry-run on copy of prod
  | "dual_write"         // write both old + new shape
  | "backfill"           // backfill historical rows
  | "cutover_read"       // read from new shape
  | "stop_dual_write"    // stop writing the old shape
  | "decommission";      // drop the old shape

export interface MigrationDescriptor {
  id: string;
  kind: MigrationKind;
  target: string;           // table name or API contract id
  /** Operator-readable rationale: why this migration. */
  rationale: string;
  /** True if the operator confirms a reverse migration script exists. */
  hasReverseScript: boolean;
  /** True if there are active write callers that must dual-write during the window. */
  hasActiveWriters: boolean;
  /** Row count estimate. Drives whether backfill needs to be staged. */
  estimatedRowCount: number;
  /** Hours the operator wants between dual_write and stop_dual_write. */
  windowHours: number;
}

export type StageVerdict = "ready" | "needs_dry_run" | "blocked";

export interface RunbookStage {
  order: number;
  kind: StageKind;
  description: string;
  verdict: StageVerdict;
  rollback: string;
  /** Things that must be true before this stage advances. */
  gateChecks: readonly string[];
}

export interface MigrationRunbook {
  descriptor: MigrationDescriptor;
  stages: readonly RunbookStage[];
  /** Closed-union verdict at the runbook level — worst stage wins. */
  overallVerdict: StageVerdict;
  /** Set when at least one structural rule was violated. */
  errors: readonly string[];
}

const DESTRUCTIVE_KINDS: ReadonlySet<MigrationKind> = new Set(["drop_column", "drop_table"]);

const STAGES_BY_KIND: Record<MigrationKind, readonly StageKind[]> = {
  add_column:          ["preflight", "dual_write", "backfill", "cutover_read", "stop_dual_write"],
  drop_column:         ["preflight", "cutover_read", "stop_dual_write", "decommission"],
  rename_column:       ["preflight", "dual_write", "backfill", "cutover_read", "stop_dual_write", "decommission"],
  add_table:           ["preflight", "backfill", "cutover_read"],
  drop_table:          ["preflight", "cutover_read", "stop_dual_write", "decommission"],
  alter_index:         ["preflight", "cutover_read"],
  alter_api_contract:  ["preflight", "dual_write", "cutover_read", "stop_dual_write", "decommission"],
};

export function buildRunbook(desc: MigrationDescriptor): MigrationRunbook {
  const errors: string[] = [];

  if (desc.windowHours < 0) {
    errors.push("windowHours must be >= 0.");
  }
  if (DESTRUCTIVE_KINDS.has(desc.kind) && !desc.hasReverseScript) {
    errors.push(`${desc.kind} is destructive and requires a reverse migration script.`);
  }
  if (desc.kind === "rename_column" && desc.hasActiveWriters && desc.windowHours < 1) {
    errors.push("rename_column with active writers needs a dual-write window > 0 hours.");
  }
  if (desc.estimatedRowCount < 0) {
    errors.push("estimatedRowCount must be >= 0.");
  }

  const plannedKinds = STAGES_BY_KIND[desc.kind];
  const stages: RunbookStage[] = plannedKinds.map((kind, index) => ({
    order: index,
    kind,
    description: descriptionFor(kind, desc),
    verdict: verdictFor(kind, desc, errors.length > 0),
    rollback: rollbackFor(kind, desc),
    gateChecks: gateChecksFor(kind, desc),
  }));

  const overallVerdict: StageVerdict = stages.reduce<StageVerdict>(
    (acc, s) => worse(acc, s.verdict),
    "ready",
  );

  return { descriptor: desc, stages, overallVerdict, errors };
}

function descriptionFor(stage: StageKind, desc: MigrationDescriptor): string {
  switch (stage) {
    case "preflight":
      return `Apply ${desc.kind} on a copy of ${desc.target}. Confirm row count ≈ ${desc.estimatedRowCount.toLocaleString()} and that the forward script is idempotent.`;
    case "dual_write":
      return `Begin writing both the old and new shape for ${desc.target}. Any caller writing only the old shape needs to be patched first.`;
    case "backfill":
      return `Backfill historical rows for ${desc.target}. Chunked and idempotent so it can be resumed after a pause.`;
    case "cutover_read":
      return `Switch reads to the new shape for ${desc.target}. Writers continue dual-writing until the window closes.`;
    case "stop_dual_write":
      return `Stop writing the old shape for ${desc.target}. Window of ${desc.windowHours} hours must have elapsed since dual-write started.`;
    case "decommission":
      return `Decommission the old shape for ${desc.target}. Final irreversible step — requires a signed approval packet.`;
  }
}

function verdictFor(stage: StageKind, desc: MigrationDescriptor, hasErrors: boolean): StageVerdict {
  if (hasErrors) return "blocked";
  if (stage === "preflight") return "needs_dry_run";
  if (stage === "decommission" && DESTRUCTIVE_KINDS.has(desc.kind) && !desc.hasReverseScript) {
    return "blocked";
  }
  return "ready";
}

function rollbackFor(stage: StageKind, desc: MigrationDescriptor): string {
  switch (stage) {
    case "preflight":
      return "No production impact — drop the copy schema.";
    case "dual_write":
      return "Revert the writer patch; writes return to old shape only.";
    case "backfill":
      return "Pause and inspect — partial backfill is safe because writes are dual.";
    case "cutover_read":
      return "Flip the read flag back to the old shape. Dual-write is still active so no data loss.";
    case "stop_dual_write":
      return "Re-enable dual-write. Any rows written to new-shape-only since cutover need replay onto the old shape.";
    case "decommission":
      return desc.hasReverseScript
        ? "Run the reverse migration script. Requires a fresh approval packet — decommission is irreversible without it."
        : "BLOCKED — destructive migration without a reverse script cannot be safely rolled back.";
  }
}

function gateChecksFor(stage: StageKind, desc: MigrationDescriptor): readonly string[] {
  switch (stage) {
    case "preflight":
      return [
        "Forward script applied successfully on prod-copy.",
        "Idempotency verified — second apply is a no-op.",
        desc.hasReverseScript ? "Reverse script applied + verified on prod-copy." : "Operator acknowledged no reverse script is available.",
      ];
    case "dual_write":
      return ["All writer paths emit both shapes.", "Error rate on write path within 0.5% of baseline."];
    case "backfill":
      return ["Backfill script chunked.", "Last 1 000 rows verified for shape parity."];
    case "cutover_read":
      return ["Read parity sample passes.", "Latency on new-shape read path within 10% of old."];
    case "stop_dual_write":
      return [`Dual-write window of ≥ ${desc.windowHours}h elapsed.`, "Final parity sample passes."];
    case "decommission":
      return ["Approval packet signed.", "Reverse-script availability confirmed.", "Audit row staged for the destructive action."];
  }
}

const VERDICT_ORDER: Record<StageVerdict, number> = { ready: 0, needs_dry_run: 1, blocked: 2 };
function worse(a: StageVerdict, b: StageVerdict): StageVerdict {
  return VERDICT_ORDER[a] >= VERDICT_ORDER[b] ? a : b;
}
