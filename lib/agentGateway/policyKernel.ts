/**
 * Agent governance gateway policy kernel (A10). Pure, deterministic, no I/O.
 *
 * Any AI agent (Cursor, Claude Code, Codex, Copilot, Axiom's own agents)
 * describes the action it wants to take; the kernel returns one closed-union
 * decision. It never executes anything. A "require_approval" decision means a
 * workspace admin must approve this exact action (bound by digest) before the
 * agent proceeds. Agents self-report actions, so this is a cooperative control
 * point, not a sandbox: it cannot stop an agent that ignores it.
 */
import { createHash } from "node:crypto";

export const ACTION_KINDS = [
  "read",              // inspect code, logs, configs
  "code_change",       // edit files on a branch
  "open_pull_request",
  "merge",             // merge to a protected/default branch
  "dependency_change", // add/upgrade packages
  "infra_change",      // Terraform/IaC or cloud resource change
  "deploy",
  "data_migration",
  "secret_access",
  "delete_resource",
  "run_command",       // arbitrary shell/tool command
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export const ENVIRONMENTS = ["development", "staging", "production", "unknown"] as const;
export type GatewayEnvironment = (typeof ENVIRONMENTS)[number];
export type RiskLevel = "low" | "medium" | "high";
export type PolicyDecision = "allow" | "require_approval" | "deny";

export interface GatewayActionInput { actionKind: ActionKind; environment: GatewayEnvironment; target: string; summary: string }
export interface PolicyResult { decision: PolicyDecision; riskLevel: RiskLevel; reasons: string[] }

export const isActionKind = (v: unknown): v is ActionKind => typeof v === "string" && (ACTION_KINDS as readonly string[]).includes(v);
export const isEnvironment = (v: unknown): v is GatewayEnvironment => typeof v === "string" && (ENVIRONMENTS as readonly string[]).includes(v);

const BASE_RISK: Readonly<Record<ActionKind, RiskLevel>> = {
  read: "low", code_change: "low", open_pull_request: "low",
  merge: "medium", dependency_change: "medium", run_command: "medium",
  infra_change: "high", deploy: "high", data_migration: "high", secret_access: "high", delete_resource: "high",
};
const bump = (r: RiskLevel): RiskLevel => (r === "low" ? "medium" : "high");

export function evaluateGatewayPolicy(input: GatewayActionInput): PolicyResult {
  const reasons: string[] = [];
  let risk = BASE_RISK[input.actionKind];
  reasons.push(`${input.actionKind} is ${risk} risk by default.`);

  if (input.environment === "production") { risk = bump(risk); reasons.push("Production raises the risk one level."); }
  if (input.environment === "unknown" && input.actionKind !== "read") { risk = bump(risk); reasons.push("The environment is unknown, so it is treated as riskier."); }

  // Hard denials: never approvable through the gateway.
  if (input.actionKind === "secret_access" && input.environment === "production") {
    return { decision: "deny", riskLevel: "high", reasons: [...reasons, "Agents may not read production secrets through the gateway. Use brokered, scoped credentials instead."] };
  }
  if (input.actionKind === "delete_resource" && input.environment === "production") {
    return { decision: "deny", riskLevel: "high", reasons: [...reasons, "Deleting production resources is not approvable for agents. A person must do it directly."] };
  }

  if (risk === "low") return { decision: "allow", riskLevel: risk, reasons: [...reasons, "Allowed without approval. The outcome should still be reported."] };
  return { decision: "require_approval", riskLevel: risk, reasons: [...reasons, "A workspace admin must approve this exact action first."] };
}

/** Binds an approval to one exact action; any change to it needs a new approval. */
export function gatewayActionDigest(organizationId: string, apiKeyId: string, input: GatewayActionInput): string {
  return createHash("sha256").update(JSON.stringify(["agent-gateway-v1", organizationId, apiKeyId, input.actionKind, input.environment, input.target, input.summary])).digest("hex");
}

/** Validates untrusted agent input into a GatewayActionInput, or returns an error code. */
export function parseGatewayAction(raw: unknown): { ok: true; value: GatewayActionInput & { agentName: string } } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "invalid_body" };
  const r = raw as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v) ? v.trim() : null);
  if (!isActionKind(r.actionKind)) return { ok: false, error: "invalid_action_kind" };
  const environment = r.environment === undefined ? "unknown" : r.environment;
  if (!isEnvironment(environment)) return { ok: false, error: "invalid_environment" };
  const target = text(r.target, 300); const summary = text(r.summary, 2000); const agentName = text(r.agentName ?? "unnamed-agent", 80);
  if (!target) return { ok: false, error: "invalid_target" };
  if (!summary) return { ok: false, error: "invalid_summary" };
  if (!agentName) return { ok: false, error: "invalid_agent_name" };
  return { ok: true, value: { actionKind: r.actionKind, environment, target, summary, agentName } };
}

export const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;
export const OUTCOMES = ["succeeded", "failed", "abandoned"] as const;
export type GatewayOutcome = (typeof OUTCOMES)[number];
export const isOutcome = (v: unknown): v is GatewayOutcome => typeof v === "string" && (OUTCOMES as readonly string[]).includes(v);

/** Whether the agent may proceed now, given a stored request's state. Pure. */
export function mayProceed(req: { status: string; policyDecision: string; expiresAt: Date }, now: Date): { proceed: boolean; reason: string } {
  if (req.policyDecision === "deny") return { proceed: false, reason: "denied_by_policy" };
  if (req.status === "rejected") return { proceed: false, reason: "rejected" };
  if (req.expiresAt.getTime() <= now.getTime() && (req.status === "pending" || req.status === "approved")) return { proceed: false, reason: "expired" };
  if (req.policyDecision === "allow" || req.status === "approved") return { proceed: true, reason: req.policyDecision === "allow" ? "allowed_by_policy" : "approved" };
  if (req.status === "pending") return { proceed: false, reason: "awaiting_approval" };
  return { proceed: false, reason: req.status };
}
