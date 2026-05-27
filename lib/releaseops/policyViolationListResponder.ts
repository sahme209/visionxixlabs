/**
 * Phase 477 — policy-violation inbox responder.
 *
 * Read-only list of PolicyViolation rows for an org, joined to the
 * PolicyRule label + severity so the UI doesn't need a second
 * round-trip. Closed-union narrowing happens at the row boundary
 * (older-write status values degrade to "unknown").
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-union status (matches schema comment).
   ────────────────────────────────────────────────────────────── */

export const ALL_VIOLATION_STATUSES = [
  "open", "exception_pending", "exception_granted", "resolved",
] as const;
export type ViolationStatus = (typeof ALL_VIOLATION_STATUSES)[number];

export type ViolationSeverity = "advisory" | "warning" | "blocker";
const ALL_SEVERITIES: ReadonlyArray<ViolationSeverity> = ["advisory", "warning", "blocker"];

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ViolationRow {
  id: string;
  organizationId: string;
  ruleId: string;
  releaseId: string;
  detectedAt: Date;
  status: string;
  message: string;
  remediation: string | null;
  exceptionGrantedByUserId: string | null;
  exceptionGrantedAt: Date | null;
  contextJson: unknown;
  rule: {
    key: string;
    label: string;
    severity: string;
    blocking: boolean;
    exceptionAllowed: boolean;
  };
}

export interface PolicyViolationListRepo {
  policyViolation: {
    findMany(args: {
      where: { organizationId: string; status?: { in: ViolationStatus[] } };
      include: { rule: true };
      orderBy: { detectedAt: "desc" };
      take?: number;
    }): Promise<ViolationRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface PolicyViolationListRow {
  id: string;
  releaseId: string;
  ruleKey: string;
  ruleLabel: string;
  severity: ViolationSeverity | "unknown";
  blocking: boolean;
  exceptionAllowed: boolean;
  status: ViolationStatus | "unknown";
  message: string;
  remediation: string | null;
  detectedAtIso: string;
  exceptionGrantedByUserId: string | null;
  exceptionGrantedAtIso: string | null;
}

export type PolicyViolationListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        violations: PolicyViolationListRow[];
        summary: {
          total: number;
          byStatus: Record<ViolationStatus | "unknown", number>;
          bySeverity: Record<ViolationSeverity | "unknown", number>;
          blockingOpen: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: PolicyViolationListBody }

export interface BuildPolicyViolationListOptions {
  now?: Date;
  correlationId?: string;
  statusFilter?: ReadonlyArray<ViolationStatus>;
  take?: number;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildPolicyViolationListResponse(
  repo: PolicyViolationListRepo,
  organizationId: string,
  opts: BuildPolicyViolationListOptions = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const where: { organizationId: string; status?: { in: ViolationStatus[] } } = { organizationId };
    if (opts.statusFilter && opts.statusFilter.length > 0) {
      where.status = { in: Array.from(opts.statusFilter) };
    }
    const rows = await repo.policyViolation.findMany({
      where,
      include: { rule: true },
      orderBy: { detectedAt: "desc" },
      ...(opts.take ? { take: opts.take } : {}),
    });

    const violations: PolicyViolationListRow[] = rows.map((r) => ({
      id: r.id,
      releaseId: r.releaseId,
      ruleKey: r.rule.key,
      ruleLabel: r.rule.label,
      severity: narrowSeverity(r.rule.severity),
      blocking: r.rule.blocking,
      exceptionAllowed: r.rule.exceptionAllowed,
      status: narrowStatus(r.status),
      message: r.message,
      remediation: r.remediation,
      detectedAtIso: r.detectedAt.toISOString(),
      exceptionGrantedByUserId: r.exceptionGrantedByUserId,
      exceptionGrantedAtIso: r.exceptionGrantedAt ? r.exceptionGrantedAt.toISOString() : null,
    }));

    const byStatus: Record<ViolationStatus | "unknown", number> = {
      open: 0, exception_pending: 0, exception_granted: 0, resolved: 0, unknown: 0,
    };
    const bySeverity: Record<ViolationSeverity | "unknown", number> = {
      advisory: 0, warning: 0, blocker: 0, unknown: 0,
    };
    let blockingOpen = 0;
    for (const v of violations) {
      byStatus[v.status] += 1;
      bySeverity[v.severity] += 1;
      if (v.blocking && v.status === "open") blockingOpen += 1;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          violations,
          summary: { total: violations.length, byStatus, bySeverity, blockingOpen },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 442 migration must be applied for policy violations." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

function narrowStatus(s: string): ViolationStatus | "unknown" {
  return (ALL_VIOLATION_STATUSES as readonly string[]).includes(s) ? (s as ViolationStatus) : "unknown";
}
function narrowSeverity(s: string): ViolationSeverity | "unknown" {
  return (ALL_SEVERITIES as readonly string[]).includes(s) ? (s as ViolationSeverity) : "unknown";
}
