/**
 * Secure audit guarantees.
 *
 * The previous `lib/security/auditLog.ts` writes to a Prisma `AuditLog`
 * model but lacks tenant scoping, correlation IDs, role context, and
 * redaction. This module is the canonical audit interface — every sensitive
 * action funnels through it, the canonical event bus subscribes to it, and
 * cross-tenant attempts are recorded automatically.
 *
 * The store is intentionally an interface — production wires the Prisma
 * implementation, while tests can substitute an in-memory recorder.
 */

import type { OrganizationId, UserId, CorrelationId, AuditEventId } from "@/lib/domain/ids";
import type { DataSource } from "@/lib/domain/source";
import { redactDeep } from "@/lib/security/redaction";
import { setCrossTenantSink } from "@/lib/security/tenantIsolation";

// ---------------------------------------------------------------------------
// Audit action taxonomy — keep this stable, callers switch on it.
// ---------------------------------------------------------------------------

export type AuditAction =
  // Auth / session
  | "auth.signin"
  | "auth.signout"
  | "auth.failed"
  // Tenant isolation
  | "tenant.cross_attempt"
  // Connectors
  | "connector.connect"
  | "connector.disconnect"
  | "connector.validate.attempt"
  | "connector.validate.success"
  | "connector.validate.failure"
  // Scans
  | "scan.start"
  | "scan.success"
  | "scan.failure"
  // Findings / recommendations
  | "recommendation.generated"
  // Execution
  | "execution_plan.create"
  | "execution_plan.export"
  | "execution_plan.submit"
  | "execution_plan.execute"
  | "rollback.prepare"
  | "rollback.execute"
  // Approvals
  | "approval.grant"
  | "approval.deny"
  // Desktop
  | "desktop.pair"
  | "desktop.revoke"
  | "desktop.handoff.issue"
  | "desktop.handoff.verify"
  | "desktop.handoff.reject"
  // Governance / policy
  | "policy.update"
  | "governance.update"
  | "autonomy.change"
  | "members.invite"
  | "members.remove"
  // Audit data
  | "audit.export"
  // Copilot
  | "copilot.query"
  | "copilot.blocked"
  // AI Workforce — runtime enforcement (Phase 362)
  | "engineer.action_attempted"
  | "engineer.action_allowed"
  | "engineer.action_requires_approval"
  | "engineer.action_blocked"
  | "engineer.approval_created"
  | "engineer.approval_voted"
  | "engineer.approval_expired"
  | "engineer.action_executed"
  | "engineer.action_execution_failed"
  | "engineer.policy_override_updated"
  | "engineer.registry_synced"
  // Pipelines — Phase 377.
  | "pipeline.run_started"
  | "pipeline.stage_started"
  | "pipeline.stage_completed"
  | "pipeline.stage_failed"
  | "pipeline.run_completed"
  | "pipeline.run_failed"
  // Generic
  | "system.error";

export type AuditOutcome = "success" | "failure" | "blocked";

export interface AuditRecord {
  id: AuditEventId;
  organizationId: OrganizationId;
  /** Null for system actors. */
  actorUserId?: UserId;
  actorKind: "user" | "system" | "external";
  action: AuditAction;
  outcome: AuditOutcome;
  /** Entity affected (e.g. `connector:aws_prod`). */
  entityRef?: string;
  /** Correlation/trace id binding this audit to a workflow/event. */
  correlationId: CorrelationId;
  source: DataSource;
  occurredAt: string;
  /** Redacted structured detail. Never raw payloads. */
  detail?: Record<string, string | number | boolean>;
  /** Error code if outcome is failure/blocked. */
  errorCode?: string;
}

export interface SecureAuditStore {
  append(record: AuditRecord): Promise<void>;
  query(input: { organizationId: OrganizationId; action?: AuditAction; sinceIso?: string; limit?: number }): Promise<AuditRecord[]>;
}

let _store: SecureAuditStore | null = null;
let _seq = 0;

/** Wire the production store (Prisma-backed). Tests pass a fake. */
export function configureAuditStore(store: SecureAuditStore | null): void {
  _store = store;
}

/** Generate a stable, sortable audit id. */
export function newAuditId(): AuditEventId {
  _seq = (_seq + 1) % 1_000_000;
  const id = `aud_${Date.now().toString(36)}_${_seq.toString(36).padStart(4, "0")}`;
  return id as AuditEventId;
}

// ---------------------------------------------------------------------------
// Recording API
// ---------------------------------------------------------------------------

export interface RecordInput {
  organizationId: OrganizationId;
  actorUserId?: UserId;
  actorKind?: AuditRecord["actorKind"];
  action: AuditAction;
  outcome?: AuditOutcome;
  entityRef?: string;
  correlationId: CorrelationId;
  source?: DataSource;
  detail?: Record<string, unknown>;
  errorCode?: string;
}

/**
 * Append an audit record. Audit failures are swallowed — they must never
 * break the user-facing action, but they emit a console error so operators
 * can spot a store outage.
 */
export async function record(input: RecordInput): Promise<void> {
  if (!_store) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[secureAudit] no store configured — drop", input.action);
    }
    return;
  }
  const detail = input.detail
    ? sanitizeDetail(redactDeep(input.detail))
    : undefined;
  const rec: AuditRecord = {
    id: newAuditId(),
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorKind: input.actorKind ?? (input.actorUserId ? "user" : "system"),
    action: input.action,
    outcome: input.outcome ?? "success",
    entityRef: input.entityRef,
    correlationId: input.correlationId,
    source: input.source ?? "live",
    occurredAt: new Date().toISOString(),
    detail,
    errorCode: input.errorCode,
  };
  try {
    await _store.append(rec);
  } catch (err) {
    console.error("[secureAudit] append failed", { action: input.action, err });
  }
}

/** Convert arbitrary redacted detail into the audit's flat scalar shape. */
function sanitizeDetail(detail: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (v !== null && v !== undefined) out[k] = JSON.stringify(v).slice(0, 512);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tenant isolation integration
// ---------------------------------------------------------------------------

/**
 * Wire `secureAudit` as the cross-tenant audit sink. After this call,
 * `enforceIsolation()` will record every cross-tenant attempt automatically.
 */
export function installCrossTenantAuditSink(): void {
  setCrossTenantSink({
    recordCrossTenantAttempt: async (input) => {
      const correlationId = `tenant_${Date.now().toString(36)}` as CorrelationId;
      await record({
        organizationId: input.scope.organizationId,
        actorUserId: input.scope.userId,
        actorKind: "user",
        action: "tenant.cross_attempt",
        outcome: "blocked",
        entityRef: `${input.entityKind}:${input.entityId}`,
        correlationId,
        source: "live",
        detail: input.context as Record<string, unknown> | undefined,
        errorCode: "tenancy.mismatch",
      });
    },
  });
}
