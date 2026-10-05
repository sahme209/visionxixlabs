/**
 * Governed execution — canonical contract.
 *
 * Turns docs/GOVERNED_EXECUTION_BOUNDARY.md's six prerequisites into
 * actual enforceable TypeScript, so the next real execution path
 * composes this module instead of reinventing a fourth independent
 * kill-switch (this codebase already has three: lib/terraform/runner.ts,
 * lib/plugins/aws/disable-unused-access-key.ts, and applyEngine.ts's
 * blanket "nothing is wired up" state).
 *
 * This module enables NOTHING by itself. It is pure decision logic — no
 * I/O, no cloud SDK, no database call. A real execution path provides
 * real implementations of each prerequisite check (querying the actual
 * tenant/role/approval/environment/audit/rollback state) and calls
 * evaluateGovernedExecutionPrerequisites() before ever touching a live
 * SDK. defaultDenyPrerequisites() is the safe starting point for any
 * new path — every check fails closed until someone deliberately wires
 * a real implementation in, one prerequisite at a time.
 */

export type GovernedExecutionPrerequisiteName =
  | "tenant_authorization"
  | "role_check"
  | "explicit_approval"
  | "environment_safeguard"
  | "immutable_evidence"
  | "rollback_and_validation";

export const GOVERNED_EXECUTION_PREREQUISITE_ORDER: readonly GovernedExecutionPrerequisiteName[] = [
  "tenant_authorization",
  "role_check",
  "explicit_approval",
  "environment_safeguard",
  "immutable_evidence",
  "rollback_and_validation",
];

export type PrerequisiteCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * One real implementation per prerequisite, given whatever context a
 * specific execution path needs (organizationId, actor, target resource,
 * etc. — intentionally untyped here since every path's context differs;
 * the TYPE SAFETY this contract provides is in the six-name closed
 * union and the mandatory presence of all six, not in the context
 * shape).
 */
export interface GovernedExecutionPrerequisites<TContext> {
  tenantAuthorization(ctx: TContext): Promise<PrerequisiteCheckResult>;
  roleCheck(ctx: TContext): Promise<PrerequisiteCheckResult>;
  explicitApproval(ctx: TContext): Promise<PrerequisiteCheckResult>;
  environmentSafeguard(ctx: TContext): Promise<PrerequisiteCheckResult>;
  immutableEvidence(ctx: TContext): Promise<PrerequisiteCheckResult>;
  rollbackAndValidation(ctx: TContext): Promise<PrerequisiteCheckResult>;
}

export type GovernedExecutionEvaluation =
  | { allowed: true }
  | { allowed: false; failedPrerequisite: GovernedExecutionPrerequisiteName; reason: string };

/**
 * Runs all six prerequisites in the canonical order, short-circuiting on
 * the first failure. Fails closed on anything unexpected: a prerequisite
 * implementation that throws is treated identically to one that
 * explicitly returns {ok:false} — it is never silently skipped or
 * treated as a pass.
 */
export async function evaluateGovernedExecutionPrerequisites<TContext>(
  prerequisites: GovernedExecutionPrerequisites<TContext>,
  ctx: TContext,
): Promise<GovernedExecutionEvaluation> {
  const checks: Record<GovernedExecutionPrerequisiteName, (c: TContext) => Promise<PrerequisiteCheckResult>> = {
    tenant_authorization: prerequisites.tenantAuthorization,
    role_check: prerequisites.roleCheck,
    explicit_approval: prerequisites.explicitApproval,
    environment_safeguard: prerequisites.environmentSafeguard,
    immutable_evidence: prerequisites.immutableEvidence,
    rollback_and_validation: prerequisites.rollbackAndValidation,
  };

  for (const name of GOVERNED_EXECUTION_PREREQUISITE_ORDER) {
    let result: PrerequisiteCheckResult;
    try {
      result = await checks[name](ctx);
    } catch (err) {
      result = { ok: false, reason: err instanceof Error ? err.message : "prerequisite check threw" };
    }
    if (!result.ok) {
      return { allowed: false, failedPrerequisite: name, reason: result.reason };
    }
  }
  return { allowed: true };
}

/**
 * The safe starting point for any new execution path. Every check
 * fails closed with a named reason — this is what a path should use
 * BEFORE any individual prerequisite has a real implementation, and
 * what remains after it does for whichever prerequisites still lack
 * one. Never silently passes a prerequisite just because it hasn't
 * been implemented yet.
 */
export function defaultDenyPrerequisites<TContext>(): GovernedExecutionPrerequisites<TContext> {
  const deny = (reason: string) => async (): Promise<PrerequisiteCheckResult> => ({ ok: false, reason });
  return {
    tenantAuthorization: deny("tenant_authorization: no real implementation wired for this execution path"),
    roleCheck: deny("role_check: no real implementation wired for this execution path"),
    explicitApproval: deny("explicit_approval: no real implementation wired for this execution path"),
    environmentSafeguard: deny("environment_safeguard: no real implementation wired for this execution path"),
    immutableEvidence: deny("immutable_evidence: no real implementation wired for this execution path"),
    rollbackAndValidation: deny("rollback_and_validation: no real implementation wired for this execution path"),
  };
}
