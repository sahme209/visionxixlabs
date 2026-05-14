/**
 * Tenant isolation guarantees.
 *
 * The single rule: every customer-data query passes through a TenantScope
 * gate. `tenantScope.ts` provides the structural type; this module wraps it
 * with audit emission and Prisma-shaped helpers so callers can't accidentally
 * forget the audit trail on cross-tenant attempts.
 *
 * Tenant isolation in Axiom rests on three guarantees:
 *  (1) The session carries `organizationId` — without it, all guards throw.
 *  (2) Every `findMany`/`update`/`delete` includes an `organizationId`
 *      filter — `tenantWhere()` produces it.
 *  (3) Cross-tenant access attempts are *logged*, not just rejected — the
 *      audit row exists so security teams can spot probing.
 */

import { AxiomErrors, isAxiomError } from "@/lib/errors/axiomErrors";
import type { OrganizationId } from "@/lib/domain/ids";
import type { Tenanted } from "@/lib/domain/tenancy";
import type { TenantScope } from "./tenantScope";
import { redactDeep } from "./redaction";

// ---------------------------------------------------------------------------
// Prisma helpers
// ---------------------------------------------------------------------------

/**
 * Build a tenant-scoped `where` clause. Use as a spread or as the base of a
 * larger where:
 *
 *   prisma.connector.findMany({ where: { ...tenantWhere(scope), kind: "aws" } })
 *
 * Centralising this stops callers from typing the wrong key
 * (`orgId` vs `organizationId`).
 */
export function tenantWhere(scope: TenantScope): { organizationId: OrganizationId } {
  if (!scope?.organizationId) {
    throw AxiomErrors.tenancy("tenancy.missing_scope", "Tenant scope is required for this query.");
  }
  return { organizationId: scope.organizationId };
}

/** Build a tenant-scoped `data` block to attach `organizationId` on create. */
export function tenantData(scope: TenantScope): { organizationId: OrganizationId } {
  return tenantWhere(scope);
}

// ---------------------------------------------------------------------------
// Cross-tenant detection
// ---------------------------------------------------------------------------

export interface CrossTenantAuditSink {
  /**
   * Called when a record was fetched but belongs to a different tenant than
   * the scope. The sink writes an audit event with the redacted record
   * identifier so security teams can investigate probing.
   */
  recordCrossTenantAttempt(input: {
    scope: TenantScope;
    recordOrganizationId: OrganizationId;
    entityKind: string;
    entityId: string;
    /** Optional extra metadata — keys are redacted before persistence. */
    context?: Record<string, unknown>;
  }): Promise<void> | void;
}

let _crossTenantSink: CrossTenantAuditSink | null = null;

/** Wire an audit sink — the canonical secureAudit module installs one at boot. */
export function setCrossTenantSink(sink: CrossTenantAuditSink | null): void {
  _crossTenantSink = sink;
}

/**
 * Enforce that `record` belongs to `scope`. On mismatch:
 *  1. Emit a cross-tenant audit event (best-effort).
 *  2. Throw an AxiomError(tenancy.mismatch) whose user-facing message says
 *     "Resource not found" — never "belongs to org X". We don't leak the
 *     existence of other tenants' data.
 */
export async function enforceIsolation<T extends Tenanted>(
  scope: TenantScope,
  record: T | null | undefined,
  opts: { entityKind: string; entityId: string }
): Promise<T> {
  if (!record) {
    throw AxiomErrors.notFound(`${opts.entityKind}.not_found`, "Resource not found.", { id: opts.entityId });
  }
  if (record.organizationId !== scope.organizationId) {
    if (_crossTenantSink) {
      try {
        await _crossTenantSink.recordCrossTenantAttempt({
          scope,
          recordOrganizationId: record.organizationId,
          entityKind: opts.entityKind,
          entityId: opts.entityId,
          context: redactDeep({ scopeOrg: scope.organizationId, recordOrg: record.organizationId }),
        });
      } catch {
        // Audit failures must not block the security decision.
      }
    }
    // Deliberately map to not-found shape so the response is indistinguishable
    // from a genuine miss — never confirm the resource exists elsewhere.
    throw AxiomErrors.notFound(`${opts.entityKind}.not_found`, "Resource not found.", { id: opts.entityId });
  }
  return record;
}

/** Synchronous variant for places that can't await (e.g. iterators / pure code). */
export function enforceIsolationSync<T extends Tenanted>(
  scope: TenantScope,
  record: T | null | undefined,
  opts: { entityKind: string; entityId: string }
): T {
  if (!record) {
    throw AxiomErrors.notFound(`${opts.entityKind}.not_found`, "Resource not found.", { id: opts.entityId });
  }
  if (record.organizationId !== scope.organizationId) {
    throw AxiomErrors.notFound(`${opts.entityKind}.not_found`, "Resource not found.", { id: opts.entityId });
  }
  return record;
}

// ---------------------------------------------------------------------------
// Read-result filtering
// ---------------------------------------------------------------------------

/** Defensive filter — strips any rows that don't match the tenant scope. */
export function strictTenantFilter<T extends Tenanted>(scope: TenantScope, records: T[]): T[] {
  return records.filter((r) => r.organizationId === scope.organizationId);
}

/** Returns true iff `wrapper` only contains records matching `scope`. */
export function allInTenant<T extends Tenanted>(scope: TenantScope, records: T[]): boolean {
  return records.every((r) => r.organizationId === scope.organizationId);
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

/**
 * Map an internal error to a tenant-safe error before sending to the wire.
 * Specifically: tenancy / not_found shapes never disclose details that would
 * confirm the existence of records in another tenant.
 */
export function sanitizeForTenant(err: unknown): { code: string; userMessage: string } {
  if (isAxiomError(err) && (err.category === "tenancy" || err.category === "not_found")) {
    return { code: err.code, userMessage: "Resource not found." };
  }
  if (isAxiomError(err)) {
    return { code: err.code, userMessage: err.userMessage };
  }
  return { code: "internal.unknown", userMessage: "Something went wrong." };
}
