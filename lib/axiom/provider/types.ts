import type { CloudSnapshot } from "../cloudSnapshot";
import type { CostSummary } from "../costSignals";
import type { ExecutionPlan, ExecutionPlanItem } from "../executionPlan";
import type { VerificationResult } from "../verificationEngine";
import type { RollbackPlan } from "../rollbackPlanner";

// ---------------------------------------------------------------------------
// Adapter result — every adapter method returns this discriminated union
// ---------------------------------------------------------------------------

export type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: AdapterErrorCode };

export type AdapterErrorCode =
  | "provider_not_implemented"
  | "invalid_credentials"
  | "connection_failed"
  | "permission_denied"
  | "snapshot_failed"
  | "apply_failed"
  | "verify_failed"
  | "rollback_failed"
  | "unknown";

// ---------------------------------------------------------------------------
// Shared sub-types
// ---------------------------------------------------------------------------

export type ConnectionValidation = {
  connected: boolean;
  accountId: string;
  regions: string[];
  permissions: string[];
};

export type ApplyActionResult = {
  success: boolean;
  message: string;
  resourceIds: string[];
  /** True when the underlying handler never called a real cloud SDK —
   *  see StepResult["simulated"] in lib/axiom/applyEngine.ts. Callers
   *  must not treat success+simulated as a completed mutation. */
  simulated?: boolean;
};

// ---------------------------------------------------------------------------
// The unified provider adapter interface
// ---------------------------------------------------------------------------

export interface CloudProviderAdapter {
  readonly provider: "aws" | "azure" | "gcp";

  /** Test credentials and list available regions/permissions. */
  validateConnection(
    userId: string,
    credentialRef: string,
  ): Promise<AdapterResult<ConnectionValidation>>;

  /** Scan the account and return a normalized resource inventory. */
  collectSnapshot(
    userId: string,
    credentialRef: string,
  ): Promise<AdapterResult<CloudSnapshot>>;

  /** Analyze a snapshot for cost optimization opportunities. */
  estimateCosts(
    snapshot: CloudSnapshot,
  ): AdapterResult<CostSummary>;

  /** Convert cost signals into a concrete execution plan. */
  generateExecutionPlan(
    snapshot: CloudSnapshot,
  ): AdapterResult<ExecutionPlan>;

  /** Execute a single optimization action against the cloud provider. */
  applyAction(
    item: ExecutionPlanItem,
  ): Promise<AdapterResult<ApplyActionResult>>;

  /** Verify that a previously applied action took effect (read-only). */
  verifyAction(
    item: ExecutionPlanItem,
  ): AdapterResult<VerificationResult>;

  /** Generate and optionally execute a rollback for a previously applied action. */
  rollbackAction(
    item: ExecutionPlanItem,
  ): Promise<AdapterResult<RollbackPlan>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function notImplemented(provider: string, method: string): AdapterResult<never> {
  return {
    ok: false,
    error: `${provider}: ${method} is not yet implemented. This provider is in preview.`,
    code: "provider_not_implemented",
  };
}

export function adapterError(code: AdapterErrorCode, error: unknown): AdapterResult<never> {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message, code };
}
