import { createHash } from "node:crypto";

/** Stable provider identity for one tenant/rule/DAG scheduled occurrence. */
export function scheduledDagRunId(input: { organizationId: string; automationId: string; dagId: string; scheduledAt: Date }): string {
  const digest = createHash("sha256").update(JSON.stringify([input.organizationId, input.automationId, input.dagId, input.scheduledAt.toISOString()])).digest("hex");
  return `axiom_schedule__${digest}`;
}
