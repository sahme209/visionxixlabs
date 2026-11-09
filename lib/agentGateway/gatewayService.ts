import "server-only";

import { prisma } from "@/lib/db";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatchWebhookEvent";
import {
  APPROVAL_TTL_MS, evaluateGatewayPolicyWithImpact, gatewayActionDigest, isOutcome, mayProceed, parseGatewayAction,
  type GatewayOutcome, type PolicyResult,
} from "./policyKernel";

/**
 * IO boundary for the agent governance gateway (A10). Composes the pure
 * policy kernel with Prisma. Every lookup is scoped to the caller's
 * organization (and, for agent calls, to the calling API key), so one
 * workspace or key can never read or settle another's request.
 */
export interface GatewayCaller { organizationId: string; apiKeyId: string }

type Row = Awaited<ReturnType<typeof prisma.agentGatewayRequest.findFirst>>;
export function publicRequest(row: NonNullable<Row>, now = new Date()) {
  const gate = mayProceed(row, now);
  return {
    id: row.id, agentName: row.agentName, actionKind: row.actionKind, environment: row.environment, target: row.target, summary: row.summary,
    riskLevel: row.riskLevel, policyDecision: row.policyDecision, policyReasons: row.policyReasons, actionDigest: row.actionDigest,
    status: gate.reason === "expired" ? "expired" : row.status, mayProceed: gate.proceed, reason: gate.reason,
    decidedAt: row.decidedAt, decisionNote: row.decisionNote, outcome: row.outcome, expiresAt: row.expiresAt, createdAt: row.createdAt,
  };
}

/** Best-effort webhook so approvers hear about agent requests (Slack, PagerDuty, email bridges). */
async function notify(organizationId: string, eventKind: "agent_gateway.request_pending" | "agent_gateway.request_decided" | "agent_gateway.outcome_recorded", data: Record<string, unknown>) {
  try { await dispatchWebhookEvent({ organizationId, eventKind, data, fireImmediately: true }); } catch { /* best-effort */ }
}

async function audit(organizationId: string, kind: string, subjectId: string, summary: string, actorUserId: string | null) {
  try { await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind, subjectKind: "agent_gateway_request", subjectId, summary, actorUserId }); } catch { /* best-effort */ }
}

/** Policy check only: nothing is stored. */
export function checkPolicy(raw: unknown): { ok: true; policy: PolicyResult; impact: unknown } | { ok: false; error: string } {
  const parsed = parseGatewayAction(raw);
  if (!parsed.ok) return parsed;
  const { impact, ...policy } = evaluateGatewayPolicyWithImpact(parsed.value);
  return { ok: true, policy, impact };
}

export async function createGatewayRequest(caller: GatewayCaller, raw: unknown, now = new Date()) {
  const parsed = parseGatewayAction(raw);
  if (!parsed.ok) return parsed;
  const { agentName, changedFiles, ...action } = parsed.value;
  const { impact, ...policy } = evaluateGatewayPolicyWithImpact({ ...action, changedFiles });
  const status = policy.decision === "deny" ? "rejected" : policy.decision === "allow" ? "approved" : "pending";
  const row = await prisma.agentGatewayRequest.create({ data: {
    organizationId: caller.organizationId, apiKeyId: caller.apiKeyId, agentName, ...action,
    riskLevel: policy.riskLevel, policyDecision: policy.decision, policyReasons: policy.reasons,
    actionDigest: gatewayActionDigest(caller.organizationId, caller.apiKeyId, { ...action, changedFiles }),
    status, expiresAt: new Date(now.getTime() + APPROVAL_TTL_MS),
  } });
  await audit(caller.organizationId, "agent_gateway.request", row.id, `${agentName} requested ${action.actionKind} on ${action.target.slice(0, 80)} (${policy.decision})`, null);
  if (row.status === "pending") await notify(caller.organizationId, "agent_gateway.request_pending", { requestId: row.id, agentName, actionKind: action.actionKind, environment: action.environment, target: action.target.slice(0, 200), riskLevel: policy.riskLevel, expiresAt: row.expiresAt.toISOString(), reviewUrl: "/control/agent-gateway" });
  return { ok: true as const, request: publicRequest(row, now), impact };
}

export async function getGatewayRequest(caller: GatewayCaller, id: string) {
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
  const row = await prisma.agentGatewayRequest.findFirst({ where: { id, organizationId: caller.organizationId, apiKeyId: caller.apiKeyId } });
  return row ? publicRequest(row) : null;
}

export async function recordGatewayOutcome(caller: GatewayCaller, id: string, raw: unknown) {
  const body = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  if (!isOutcome(body.outcome)) return { ok: false as const, error: "invalid_outcome", status: 400 };
  const detail = typeof body.detail === "string" ? body.detail.slice(0, 2000) : null;
  const row = await prisma.agentGatewayRequest.findFirst({ where: { id, organizationId: caller.organizationId, apiKeyId: caller.apiKeyId } });
  if (!row) return { ok: false as const, error: "not_found", status: 404 };
  // Only an action that was allowed or approved (and not already settled) can report an outcome.
  if (!(row.status === "approved" && row.outcome === null)) return { ok: false as const, error: "not_reportable", status: 409 };
  const outcome = body.outcome as GatewayOutcome;
  const saved = await prisma.agentGatewayRequest.updateMany({ where: { id: row.id, status: "approved", outcome: null }, data: { outcome, outcomeDetail: detail, outcomeAt: new Date(), status: outcome === "succeeded" ? "completed" : "failed" } });
  if (saved.count !== 1) return { ok: false as const, error: "not_reportable", status: 409 };
  await audit(caller.organizationId, "agent_gateway.outcome", row.id, `${row.agentName} reported ${outcome} for ${row.actionKind}`, null);
  await notify(caller.organizationId, "agent_gateway.outcome_recorded", { requestId: row.id, agentName: row.agentName, actionKind: row.actionKind, outcome });
  const fresh = await prisma.agentGatewayRequest.findFirst({ where: { id: row.id, organizationId: caller.organizationId } });
  return { ok: true as const, request: publicRequest(fresh!) };
}

/** Human decision by a workspace admin. Separation of duties: the person who minted the agent's key cannot approve its requests. */
export async function decideGatewayRequest(input: { organizationId: string; userId: string; userEmail: string | null; id: string; decision: unknown; note?: unknown }, now = new Date()) {
  if (input.decision !== "approve" && input.decision !== "reject") return { ok: false as const, error: "invalid_decision", status: 400 };
  const row = await prisma.agentGatewayRequest.findFirst({ where: { id: input.id, organizationId: input.organizationId } });
  if (!row) return { ok: false as const, error: "not_found", status: 404 };
  if (row.status !== "pending" || row.policyDecision !== "require_approval") return { ok: false as const, error: "not_pending", status: 409 };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false as const, error: "expired", status: 409 };
  const key = await prisma.apiKey.findFirst({ where: { id: row.apiKeyId, organizationId: input.organizationId }, select: { createdBy: true } });
  // Fail closed: without a verified email we cannot prove the approver did not mint the key.
  if (!input.userEmail) return { ok: false as const, error: "approver_identity_unverified", status: 403 };
  if (key && key.createdBy.trim().toLowerCase() === input.userEmail.trim().toLowerCase()) return { ok: false as const, error: "self_approval_forbidden", status: 403 };
  const status = input.decision === "approve" ? "approved" : "rejected";
  const note = typeof input.note === "string" ? input.note.slice(0, 1000) : null;
  const saved = await prisma.agentGatewayRequest.updateMany({ where: { id: row.id, status: "pending", actionDigest: row.actionDigest }, data: { status, decidedByUserId: input.userId, decidedAt: now, decisionNote: note } });
  if (saved.count !== 1) return { ok: false as const, error: "not_pending", status: 409 };
  await audit(input.organizationId, `agent_gateway.${status}`, row.id, `${status} ${row.agentName} ${row.actionKind} on ${row.target.slice(0, 80)}`, input.userId);
  await notify(input.organizationId, "agent_gateway.request_decided", { requestId: row.id, agentName: row.agentName, actionKind: row.actionKind, decision: status, decidedByUserId: input.userId });
  const fresh = await prisma.agentGatewayRequest.findFirst({ where: { id: row.id, organizationId: input.organizationId } });
  return { ok: true as const, request: publicRequest(fresh!, now) };
}

export async function listGatewayRequests(organizationId: string, status?: string) {
  const rows = await prisma.agentGatewayRequest.findMany({ where: { organizationId, ...(status && ["pending", "approved", "rejected", "completed", "failed"].includes(status) ? { status } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
  const now = new Date();
  return rows.map((r) => publicRequest(r, now));
}

/** Per-agent scorecards over the last 90 days (A14). Read-only evidence; never changes policy. */
export async function listAgentScorecards(organizationId: string, now = new Date()) {
  const { buildScorecards } = await import("./scorecardKernel");
  const rows = await prisma.agentGatewayRequest.findMany({ where: { organizationId, createdAt: { gte: new Date(now.getTime() - 90 * 86_400_000) } }, select: { apiKeyId: true, agentName: true, status: true, policyDecision: true, riskLevel: true, outcome: true, createdAt: true }, take: 20_000 });
  return buildScorecards(rows);
}
