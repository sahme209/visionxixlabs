/** Shared wire contract. Drafts never carry executable proposals or receipts. */
export const AGENT_STREAM_CONTENT_TYPE = "application/x-ndjson";
export const MAX_AGENT_STREAM_FRAME_BYTES = 2 * 1024 * 1024;
export const MAX_AGENT_STREAM_BYTES = 8 * 1024 * 1024;
export const AGENT_TOOL_ACTIVITY_FEATURE = "tool_activity_v1";
export const MAX_AGENT_ACTIVITY_STEPS = 8;
/** Presentation only: this list never grants tool authority. */
export const AGENT_TOOL_ACTIVITY_LABELS: Readonly<Record<string, string>> = {
  list_airflow_dags: "Inspecting Airflow DAGs",
  read_airflow_runs: "Inspecting Airflow runs",
  read_airflow_tasks: "Inspecting Airflow tasks",
  list_prefect_flows: "Inspecting Prefect flows",
  read_prefect_flow_runs: "Inspecting Prefect runs",
  read_prefect_task_runs: "Inspecting Prefect task runs",
  list_dagster_jobs: "Inspecting Dagster jobs",
  read_dagster_runs: "Inspecting Dagster runs",
  list_argo_templates: "Inspecting Argo templates",
  list_argo_workflows: "Inspecting Argo workflows",
  search_microsoft_docs: "Searching public Microsoft documentation",
  list_cloud_accounts: "Checking connected cloud accounts",
  read_aws_inventory: "Reading AWS inventory",
  list_environments: "Checking environments",
  list_integrations: "Checking integrations",
  check_deploy_status: "Reading deployment status",
  list_deployment_executions: "Reading deployment history",
  list_github_files: "Listing repository files",
  inspect_github_repository: "Inspecting repository",
  search_github_code: "Searching repository code",
  read_github_file: "Reading repository file",
  preview_scim_lifecycle: "Previewing identity lifecycle",
};
export interface AgentToolActivity { step: number; toolName: string; state: "running" | "completed" | "failed" }
export interface AgentMessageExecutionStream {
  abortSignal: AbortSignal;
  onDraft: (text: string) => void;
  onActivity?: (activity: AgentToolActivity) => void;
}
export function isAgentToolActivity(value: unknown): value is AgentToolActivity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return Object.keys(event).length === 3
    && Number.isSafeInteger(event.step) && (event.step as number) >= 1 && (event.step as number) <= MAX_AGENT_ACTIVITY_STEPS
    && typeof event.toolName === "string" && Object.prototype.hasOwnProperty.call(AGENT_TOOL_ACTIVITY_LABELS, event.toolName)
    && ["running", "completed", "failed"].includes(event.state as string);
}

export const AGENT_MESSAGE_ISSUES = [
  "workspace_ai_disabled", "workspace_ai_provider_unavailable", "workspace_ai_model_not_allowed", "workspace_ai_policy_unavailable",
  "workspace_ai_credit_meter_unavailable", "workspace_ai_credit_pool_exhausted", "workspace_agent_disabled", "workspace_agent_policy_unavailable",
  "agent_tool_not_allowed", "decision_malformed", "max_iterations_exceeded", "tool_execution_failed", "request_failed",
] as const;
export type AgentMessageIssue = typeof AGENT_MESSAGE_ISSUES[number];
export function isAgentMessageIssue(value: unknown): value is AgentMessageIssue { return typeof value === "string" && (AGENT_MESSAGE_ISSUES as readonly string[]).includes(value); }
export interface AgentMessageReply {
  issue?: AgentMessageIssue;
  reply: string;
  proposal: { id: string; requiresIndependentReviewer?: boolean; toolName: string; argsJson: unknown; riskLevel: string; status: string } | null;
  usage?: { decisionSteps: number; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } | null;
}
export type AgentMessageStreamEvent =
  | { type: "tool_activity"; activity: AgentToolActivity }
  | { type: "draft_reset" }
  | { type: "draft_delta"; text: string }
  | { type: "result"; data: AgentMessageReply }
  | { type: "error"; error: "agent_stream_interrupted" };

export function isAgentMessageReply(value: unknown): value is AgentMessageReply {
  if (!value || typeof value !== "object") return false;
  const v = value as AgentMessageReply;
  if (v.issue !== undefined && (!isAgentMessageIssue(v.issue) || v.proposal !== null)) return false;
  if (typeof v.reply !== "string" || v.reply.length > 131_072) return false;
  if (v.proposal !== null) {
    const p = v.proposal;
    if (!p || typeof p !== "object" || typeof p.id !== "string" || !p.id || typeof p.toolName !== "string" || !p.toolName || p.status !== "proposed" || !["low", "medium", "high"].includes(p.riskLevel) || !p.argsJson || typeof p.argsJson !== "object" || Array.isArray(p.argsJson)) return false;
  }
  if (v.usage != null && (typeof v.usage !== "object" || !Number.isSafeInteger(v.usage.decisionSteps) || v.usage.decisionSteps < 0 || ![v.usage.inputTokens, v.usage.outputTokens, v.usage.totalTokens].every(n => n === null || Number.isSafeInteger(n) && n! >= 0))) return false;
  return true;
}
