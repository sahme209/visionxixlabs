import type { AutomationMode, SignalKey, StepStatus } from "@/lib/founder/blueprint";
import type { StatusTone } from "@/lib/cockpit/statusTone";

export const STATUS_LABEL: Record<StepStatus, string> = { draft: "Draft", in_progress: "In progress", testing: "Testing", live: "Live", archived: "Archived" };
export const STATUS_TONE: Record<StepStatus, StatusTone> = { draft: "idle", in_progress: "running", testing: "attention", live: "success", archived: "idle" };
export const SIGNAL_TEXT: Record<SignalKey, string> = {
  feedback_30d: "Feedback, 30 days", leads_30d: "Leads, 30 days", deployments_7d: "Deployments, 7 days", deployments_failed_7d: "Failed deployments, 7 days",
  incidents_open: "Open incidents", freezes_active: "Frozen environments", ai_cost_30d_cents: "AI cost, 30 days", agent_requests_pending: "Agent requests waiting",
  webhook_failures_7d: "Webhooks given up, 7 days", workspaces_total: "Workspaces", workspaces_new_30d: "New workspaces, 30 days",
};
export const ATTENTION_SIGNALS: ReadonlySet<SignalKey> = new Set(["deployments_failed_7d", "incidents_open", "freezes_active", "agent_requests_pending", "webhook_failures_7d"]);
export const AUTOMATION_LABEL: Record<AutomationMode, string> = { manual: "Person", assisted: "Assisted", approval: "Agent, you approve", autonomous: "Autonomous" };
export const AUTOMATION_SHORT: Record<AutomationMode, string> = { manual: "Person", assisted: "Assisted", approval: "Approval", autonomous: "Auto" };
export const AUTOMATION_HELP: Record<AutomationMode, string> = {
  manual: "A person does this step.",
  assisted: "A person does this step with an agent drafting or preparing the work.",
  approval: "An agent prepares and carries out this step only after you approve it.",
  autonomous: "V19 or an agent runs this step on its own and records what it did.",
};
export const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
export const signalValue = (k: SignalKey, v: number | null | undefined) => (v === null || v === undefined ? "Unavailable" : k === "ai_cost_30d_cents" ? usd(v / 100) : v.toLocaleString());
