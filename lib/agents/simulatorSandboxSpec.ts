/**
 * Pure simulator-agent sandbox-spec builder.
 *
 * The simulator agent verifies a proposed change in a sandbox before
 * letting policy_gate / boundary_gate review it. This module builds
 * the typed sandbox spec from a hypothesis — what to clone, what
 * dependencies to materialize, what assertions to evaluate after the
 * simulated change lands.
 *
 * Pure / deterministic. The actual sandbox runner is external.
 */

export type SandboxBackend = "ephemeral_vm" | "k8s_namespace" | "localstack" | "in_memory_mock";

export interface SandboxAssertion {
  /** Closed-union assertion kind so we can validate before running. */
  kind: "no_destructive_calls" | "policy_pass" | "boundary_pass" | "metric_in_range" | "logs_clean";
  detail: string;
}

export interface SandboxSpec {
  backend: SandboxBackend;
  /** Resources to clone into the sandbox (ids from the inventory). */
  cloneResources: readonly string[];
  /** Hypothesis being evaluated. */
  hypothesisId: string;
  /** Proposed change description — operator-readable. */
  proposedChange: string;
  /** Pre/post assertions. */
  assertions: SandboxAssertion[];
  /** Hard timeout for the sandbox run. */
  timeoutSec: number;
  /** True iff the runner can use real cloud creds. */
  needsLiveCreds: boolean;
}

export interface SandboxSpecInput {
  hypothesisId: string;
  hypothesisKind: string;
  proposedChange: string;
  targetResourceIds: readonly string[];
  /** Number of agents that supported this hypothesis (caller's choice). */
  supportWeight?: number;
}

function backendFor(kind: string): SandboxBackend {
  if (kind.startsWith("drift_") || kind.startsWith("policy_drift")) return "localstack";
  if (kind.startsWith("slo_burn") || kind.startsWith("scale_up")) return "k8s_namespace";
  if (kind.startsWith("exploit_")) return "ephemeral_vm";
  return "in_memory_mock";
}

function timeoutFor(kind: string): number {
  if (kind.startsWith("scale_up") || kind.startsWith("slo_burn")) return 600;
  if (kind.startsWith("exploit_")) return 900;
  return 300;
}

function assertionsFor(kind: string): SandboxAssertion[] {
  const base: SandboxAssertion[] = [
    { kind: "no_destructive_calls", detail: "simulator may not delete real resources" },
  ];
  if (kind.startsWith("drift_") || kind.startsWith("policy_drift")) {
    base.push(
      { kind: "policy_pass",   detail: "policy_gate must succeed inside the sandbox" },
      { kind: "boundary_pass", detail: "boundary_gate must succeed" },
      { kind: "logs_clean",    detail: "no ERROR / FATAL lines emitted" },
    );
  }
  if (kind.startsWith("slo_burn") || kind.startsWith("scale_up")) {
    base.push(
      { kind: "metric_in_range", detail: "synthetic p95 latency stays within 1.5× pre-change baseline" },
      { kind: "logs_clean",      detail: "no panics / 5xx burst" },
    );
  }
  if (kind.startsWith("exploit_")) {
    base.push(
      { kind: "policy_pass",     detail: "least-privilege roles still hold" },
      { kind: "boundary_pass",   detail: "boundary class unchanged" },
      { kind: "metric_in_range", detail: "no privilege-escalation hits" },
    );
  }
  return base;
}

export function buildSandboxSpec(input: SandboxSpecInput): SandboxSpec {
  return {
    backend: backendFor(input.hypothesisKind),
    cloneResources: [...input.targetResourceIds].sort(),
    hypothesisId: input.hypothesisId,
    proposedChange: input.proposedChange.slice(0, 1000),
    assertions: assertionsFor(input.hypothesisKind),
    timeoutSec: timeoutFor(input.hypothesisKind),
    needsLiveCreds: input.hypothesisKind.startsWith("exploit_") || input.hypothesisKind.startsWith("drift_"),
  };
}
