/**
 * Engineer executor registry — Phase 376.
 *
 * Each gated engineer has a registered ExecutorFn that runs the
 * real action after an approval transitions to "approved". Until a
 * real executor is wired per engineer, every entry defaults to the
 * `dryRunExecutor` — a safe no-op that records what *would* have
 * happened. Future phases swap in real apply paths per engineer.
 *
 * The registry is process-local: imports of this module on the
 * server share the same Map. The /execute route imports
 * `bootstrapExecutorRegistry` to ensure the defaults are wired
 * before the registry is read.
 */

import "server-only";

import { AGENT_WORKFORCE_REGISTRY } from "@/lib/workforce/agentWorkforceRegistry";

export interface ExecutionContext {
  organizationId: string;
  approvalRequestId: string;
  engineerId: string;
  action: string;
  attemptId: string | null;
  correlationId: string;
  /** Operator who triggered the /execute call. */
  executedByUserId: string;
}

export interface ExecutorOk {
  ok: true;
  summary: string;
  detail?: Record<string, unknown>;
}

export interface ExecutorErr {
  ok: false;
  error: string;
  detail?: Record<string, unknown>;
}

export type ExecutorResult = ExecutorOk | ExecutorErr;

export type ExecutorFn = (ctx: ExecutionContext) => Promise<ExecutorResult>;

const EXECUTORS = new Map<string, ExecutorFn>();
let bootstrapped = false;

export function registerExecutor(engineerId: string, fn: ExecutorFn): void {
  EXECUTORS.set(engineerId, fn);
}

export function getExecutor(engineerId: string): ExecutorFn | null {
  return EXECUTORS.get(engineerId) ?? null;
}

export function hasExecutor(engineerId: string): boolean {
  return EXECUTORS.has(engineerId);
}

/**
 * Default executor: records what would have happened, no side effects.
 * Wired automatically for every client engineer until a real path lands.
 */
export const dryRunExecutor: ExecutorFn = async (ctx) => {
  return {
    ok: true,
    summary: `[dry-run] would execute ${ctx.action}`,
    detail: {
      engineerId: ctx.engineerId,
      action: ctx.action,
      dryRun: true,
      note: "No side effects — replace with a real executor when the apply path is wired for this engineer.",
    },
  };
};

/**
 * Idempotent — safe to call from every entrypoint that needs the
 * registry populated. First call seeds dry-run defaults for every
 * client engineer. Subsequent calls are no-ops UNLESS an engineer
 * has been added to the registry since.
 */
export function bootstrapExecutorRegistry(): void {
  for (const e of AGENT_WORKFORCE_REGISTRY) {
    if (e.productLayer !== "client") continue;
    if (!EXECUTORS.has(e.id)) EXECUTORS.set(e.id, dryRunExecutor);
  }
  bootstrapped = true;
}

export function isExecutorRegistryBootstrapped(): boolean {
  return bootstrapped;
}

/** Testing helper — clears the registry. Server only. */
export function __resetExecutorRegistry(): void {
  EXECUTORS.clear();
  bootstrapped = false;
}
