/**
 * Blocking-check gate (pure). Before a stage starts, every enabled blocking check attached to an
 * earlier stage must have a passing result reported by CI for this exact commit, at the check's
 * current version, within the freshness window. Manual checklists count once a person confirms
 * them for the commit in V19; health checks count once your monitoring reports a result through
 * the results API. Nothing is ever silently passed.
 */
import { CHECK_STAGES, type CheckKind, type CheckStage } from "./deploymentChecks";

export const RESULT_FRESHNESS_HOURS = 72;
export interface GateCheck { key: string; name: string; kind: CheckKind; stage: CheckStage; mode: "blocking" | "advisory"; enabled: boolean; version: number }
export interface GateResult { checkKey: string; checkVersion: number; status: string; releaseRef: string | null; reportedAt: Date }
export type GateBlock = { key: string; name: string; stage: CheckStage; reason: "no_result" | "failed" | "stale_version" | "expired" };
export type GateOutcome = { ok: true; satisfied: string[]; notEnforceable: string[] } | { ok: false; blocked: GateBlock[]; satisfied: string[]; notEnforceable: string[] };

const REPORTED: ReadonlySet<CheckKind> = new Set(["smoke_test", "custom_script", "migration_dry_run", "manual_checklist", "health_check", "security_scan", "supply_chain", "resilience_experiment", "marketplace_action", "cost_estimate"]);

export function evaluateStageGate(input: { checks: readonly GateCheck[]; results: readonly GateResult[]; startingStage: CheckStage; commitSha: string; now: Date }): GateOutcome {
  const before = new Set(CHECK_STAGES.slice(0, CHECK_STAGES.indexOf(input.startingStage)));
  const blocked: GateBlock[] = []; const satisfied: string[] = []; const notEnforceable: string[] = [];
  const oldest = input.now.getTime() - RESULT_FRESHNESS_HOURS * 3_600_000;
  for (const c of input.checks) {
    if (!c.enabled || c.mode !== "blocking" || !before.has(c.stage)) continue;
    if (!REPORTED.has(c.kind)) { notEnforceable.push(c.key); continue; }
    const forCommit = input.results.filter((r) => r.checkKey === c.key && r.releaseRef === input.commitSha).sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
    const latest = forCommit[0];
    const block = (reason: GateBlock["reason"]) => blocked.push({ key: c.key, name: c.name, stage: c.stage, reason });
    if (!latest) block("no_result");
    else if (latest.status !== "passed") block("failed");
    else if (latest.checkVersion !== c.version) block("stale_version");
    else if (latest.reportedAt.getTime() < oldest) block("expired");
    else satisfied.push(c.key);
  }
  return blocked.length ? { ok: false, blocked, satisfied, notEnforceable } : { ok: true, satisfied, notEnforceable };
}
