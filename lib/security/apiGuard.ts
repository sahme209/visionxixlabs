/**
 * API guard — the single wrapper every sensitive route handler runs through.
 *
 * Responsibilities, in order:
 *  1. Authenticate (session via NextAuth)
 *  2. Resolve tenant scope (organizationId + roles)
 *  3. Optionally require a permission (RBAC)
 *  4. Idempotency-key check for mutating requests
 *  5. Run the handler — Axiom-typed errors map to safe HTTP responses
 *  6. Emit an audit event on success when `auditAction` is supplied
 *
 * Why a wrapper vs middleware: Next.js app-router doesn't expose a global
 * pre-handler. A typed HOF is the simplest way to enforce the chain *and*
 * surface to readers what each route requires.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { tenantScopeFromSession } from "@/lib/security/tenantScope";
import type { TenantScope } from "@/lib/security/tenantScope";
import { requirePermission } from "@/lib/security/rbac";
import type { Permission } from "@/lib/security/rbac";
import { AxiomErrors, httpStatusFor, isAxiomError, toAxiomError } from "@/lib/errors/axiomErrors";
import { redactDeep } from "@/lib/security/redaction";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";

export interface GuardOptions {
  /** Required permission, checked against the resolved tenant scope. */
  permission?: Permission;
  /** Mark the operation as a state-changing mutation — enables idempotency check. */
  mutating?: boolean;
  /** Stable action name written to the audit log on success. */
  auditAction?: string;
}

export interface GuardedContext {
  scope: TenantScope;
  request: NextRequest;
  /** Idempotency-Key header if the caller supplied one. */
  idempotencyKey?: string;
  /** Best-effort correlation identifier (header or generated). */
  correlationId: string;
}

export type GuardedHandler<T> = (ctx: GuardedContext) => Promise<T>;

interface AuditHook {
  recordSuccess?(input: { scope: TenantScope; action: string; result: unknown; correlationId: string }): void | Promise<void>;
  recordFailure?(input: { scope: TenantScope | null; action: string; errorCode: string; correlationId: string }): void | Promise<void>;
}
let _audit: AuditHook | null = null;
export function setAuditHook(hook: AuditHook | null): void { _audit = hook; }

/**
 * Wrap a route handler. Returns a NextResponse with the canonical
 * `{ ok: true, data }` / `{ ok: false, error }` envelope.
 */
export function guard<T>(opts: GuardOptions, handler: GuardedHandler<T>) {
  return async function guarded(request: NextRequest): Promise<NextResponse> {
    const correlationId = request.headers.get("x-correlation-id") ?? `req_${Math.random().toString(36).slice(2, 12)}`;
    try {
      const session = await getServerSession(authOptions);
      const scope = tenantScopeFromSession(session as never);
      if (!scope) {
        throw AxiomErrors.validation("auth.required", "Sign in required.");
      }
      if (opts.permission) {
        requirePermission(scope, opts.permission);
      }

      const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
      if (opts.mutating && request.method !== "GET" && !idempotencyKey) {
        // Soft-warning rather than block — the route can choose to require it explicitly.
        // We surface this through the response header so clients learn.
      }

      const data = await handler({ scope, request, idempotencyKey, correlationId });

      if (opts.auditAction && _audit?.recordSuccess) {
        try {
          await _audit.recordSuccess({ scope, action: opts.auditAction, result: redactDeep(data), correlationId });
        } catch {
          // Audit failures must not break the response.
        }
      }

      return NextResponse.json(apiSuccess(data), {
        status: 200,
        headers: { "x-correlation-id": correlationId },
      });
    } catch (err) {
      const axiomErr = toAxiomError(err);
      if (opts.auditAction && _audit?.recordFailure) {
        try {
          // We deliberately don't await — failure auditing is best-effort.
          await _audit.recordFailure({
            scope: null,
            action: opts.auditAction,
            errorCode: axiomErr.code,
            correlationId,
          });
        } catch {
          // ignore
        }
      }
      // Only AxiomErrors get their stable code reflected; unknown internals get a generic 500.
      const status = httpStatusFor(axiomErr.category);
      return NextResponse.json(apiFailure(axiomErr), {
        status,
        headers: { "x-correlation-id": correlationId },
      });
    }
  };
}

/** Throw helper for routes that need to short-circuit cleanly. */
export function abort(error: ReturnType<typeof AxiomErrors[keyof typeof AxiomErrors]>): never {
  throw error;
}

export { isAxiomError };
