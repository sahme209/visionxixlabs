import "server-only";
import { hasDesktopCapability, type DesktopWorkspaceRole } from "@/lib/desktop/desktopAuthorization";
import { loadBatchClient } from "@/lib/integrations/batch/batchConnection";
import type { BatchProvider } from "@/lib/integrations/batch/batchProviders";
import type { PrefectClient } from "@/lib/integrations/prefect/prefectClient";
import type { DagsterClient } from "@/lib/integrations/dagster/dagsterClient";
import type { ArgoWorkflowsClient } from "@/lib/integrations/argo/argoWorkflowsClient";
import type { CloudObservationContext } from "./cloudObservation";

/**
 * Read-only Batches observation (Prefect, Dagster, Argo Workflows), mirroring
 * the Airflow observation boundary: the paired desktop session and accepted
 * membership are re-checked before AND after the provider read, the connection
 * must be unchanged across the read, and results are bounded to 20 entries.
 * No trigger, retry, cancel or state change exists. Not yet registered in the
 * Agent tool allowlist; registration needs its own review.
 */
export type BatchObservationTool =
  | "list_prefect_flows" | "read_prefect_flow_runs" | "read_prefect_task_runs"
  | "list_dagster_jobs" | "read_dagster_runs"
  | "list_argo_templates" | "list_argo_workflows";

const TOOLS: Readonly<Record<BatchObservationTool, { provider: BatchProvider; args: readonly string[] }>> = Object.freeze({
  list_prefect_flows: { provider: "prefect", args: [] },
  read_prefect_flow_runs: { provider: "prefect", args: ["flowId"] },
  read_prefect_task_runs: { provider: "prefect", args: ["flowRunId"] },
  list_dagster_jobs: { provider: "dagster", args: [] },
  read_dagster_runs: { provider: "dagster", args: ["jobName"] },
  list_argo_templates: { provider: "argo_workflows", args: [] },
  list_argo_workflows: { provider: "argo_workflows", args: [] },
});
export const BATCH_OBSERVATION_TOOLS = Object.freeze(Object.keys(TOOLS) as BatchObservationTool[]);

const MAX = 20;
type Result = { ok: true; result: Record<string, unknown> } | { ok: false; error: string };
const roles: readonly DesktopWorkspaceRole[] = ["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"];
const validArg = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200 && v.trim() === v && !/[\x00-\x1f\x7f]/.test(v);

async function assertAuthority(context: CloudObservationContext) {
  const { principal, repo } = context;
  const [device, member] = await Promise.all([
    repo.desktopSessionRecord.findUnique({ where: { id: principal.sessionId } }),
    repo.orgMembership.findUnique({ where: { userId_organizationId: { userId: principal.userId, organizationId: principal.organizationId } } }),
  ]);
  if (!device || device.id !== principal.sessionId || device.userId !== principal.userId || device.organizationId !== principal.organizationId || device.revokedAt || device.expiresAt <= new Date()
    || !member?.acceptedAt || !roles.includes(member.role) || !hasDesktopCapability(member.role, "workspace:read")) throw new Error("authority_unavailable");
}

async function read(tool: BatchObservationTool, client: unknown, args: Record<string, string>): Promise<{ items: unknown[]; extra?: Record<string, unknown> }> {
  switch (tool) {
    case "list_prefect_flows": return { items: await (client as PrefectClient).listFlows() };
    case "read_prefect_flow_runs": return { items: await (client as PrefectClient).listFlowRuns(args.flowId), extra: { flowId: args.flowId } };
    case "read_prefect_task_runs": return { items: await (client as PrefectClient).listTaskRuns(args.flowRunId), extra: { flowRunId: args.flowRunId } };
    case "list_dagster_jobs": return { items: await (client as DagsterClient).listJobs() };
    case "read_dagster_runs": return { items: await (client as DagsterClient).listRuns(args.jobName), extra: { jobName: args.jobName } };
    case "list_argo_templates": return { items: await (client as ArgoWorkflowsClient).listTemplates() };
    case "list_argo_workflows": return { items: await (client as ArgoWorkflowsClient).listWorkflows() };
  }
}

export async function executeBatchObservationTool(organizationId: string, tool: BatchObservationTool, args: Record<string, unknown>, context?: CloudObservationContext): Promise<Result> {
  const spec = TOOLS[tool];
  if (!spec) return { ok: false, error: "unknown_batch_observation_tool" };
  if (!context || context.principal.organizationId !== organizationId) return { ok: false, error: "paired_batch_observation_required" };
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).some((k) => !spec.args.includes(k)) || spec.args.some((k) => !validArg(args[k]))) return { ok: false, error: "invalid_batch_observation_args" };
  try {
    await assertAuthority(context);
    const connection = await loadBatchClient(organizationId, spec.provider);
    const { items, extra } = await read(tool, connection.client, args as Record<string, string>);
    await assertAuthority(context);
    // A replaced or rotated connection invalidates the read; never return old provider data.
    const current = await loadBatchClient(organizationId, spec.provider);
    if (current.connectionId !== connection.connectionId || current.connectionUpdatedAt.getTime() !== connection.connectionUpdatedAt.getTime()) return { ok: false, error: "batch_observation_changed" };
    return { ok: true, result: { kind: "batch_observation", provider: spec.provider, authority: "observation_only", observedAt: new Date().toISOString(), coverage: { complete: false, maximumEntries: MAX, pagination: "first_page" }, ...extra, items: items.slice(0, MAX), truncated: items.length > MAX } };
  } catch {
    return { ok: false, error: "batch_observation_unavailable" };
  }
}
