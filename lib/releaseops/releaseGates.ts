/**
 * Release gates shared by every deployment path (desktop dispatch and approved Agent actions), so an
 * Agent can never reach an environment by a route with fewer controls than a person has. Order:
 * change window and freezes, blocking deployment checks for this commit, then rings. Fails closed:
 * an unreadable store or rule blocks. The audited production emergency bypass is a desktop-only path
 * and is not offered here.
 */
import { evaluateChangeWindow, parseChangeWindowRule, type WindowDecision } from "./environmentChangeWindow";
import { readDeploymentCheckGate, type DeploymentCheckGateRepo } from "./deploymentCheckGateStore";
import { readRingGate, type RingGateRepo } from "./ringGate";

export type ReleaseGateBlock =
  | { ok: false; error: "change_window_unreadable"; detail: string }
  | ({ ok: false; error: "outside_change_window" | "deployment_freeze_active" } & Omit<Extract<WindowDecision, { open: false }>, "open">)
  | { ok: false; error: "deployment_checks_unavailable" | "ring_gate_unavailable" }
  | { ok: false; error: "deployment_checks_blocking"; blocked: unknown }
  | { ok: false; error: "previous_ring_not_deployed"; ring: number; previousRing: number; reason: string };
export type ReleaseGateOutcome = { ok: true } | ReleaseGateBlock;

/** Change window only (cheap, no provider work): run it before any GitHub call. */
export function changeWindowGate(changeWindowRuleJson: unknown, now: Date): ReleaseGateOutcome {
  const rule = parseChangeWindowRule(changeWindowRuleJson);
  if (rule.kind === "unreadable") return { ok: false, error: "change_window_unreadable", detail: rule.error };
  const decision = evaluateChangeWindow(rule, now);
  if (decision.open) return { ok: true };
  const { open: _open, ...rest } = decision;
  return { ok: false, error: decision.reason === "freeze" ? "deployment_freeze_active" : "outside_change_window", ...rest } as ReleaseGateBlock;
}

/** Checks and rings for one resolved commit. */
export async function commitGates(repo: DeploymentCheckGateRepo & RingGateRepo, input: { organizationId: string; environmentId: string; repositoryFullName: string; commitSha: string; now: Date }): Promise<ReleaseGateOutcome> {
  const gate = await readDeploymentCheckGate(repo, { organizationId: input.organizationId, commitSha: input.commitSha, now: input.now });
  if (gate === "unavailable") return { ok: false, error: "deployment_checks_unavailable" };
  if (!gate.ok) return { ok: false, error: "deployment_checks_blocking", blocked: gate.blocked };
  const ring = await readRingGate(repo, input);
  if (ring === "unavailable") return { ok: false, error: "ring_gate_unavailable" };
  if (!ring.ok) return { ok: false, error: "previous_ring_not_deployed", ring: ring.ring, previousRing: ring.previousRing, reason: ring.reason };
  return { ok: true };
}
