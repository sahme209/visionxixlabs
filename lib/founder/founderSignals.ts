/**
 * Live company signals for the founder blueprint, computed across all workspaces. Founder-only: callers
 * must have passed the founder gate. Each signal is read on its own; one that cannot be read is null,
 * never zero, so the map never shows a guessed value.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { activeFreezes } from "@/lib/releaseops/deploymentFreeze";
import type { SignalKey } from "./blueprint";

export type FounderSignals = Record<SignalKey, number | null>;
const DAY = 86_400_000;
const safe = async (read: () => Promise<number>): Promise<number | null> => { try { return await read(); } catch { return null; } };

export async function readFounderSignals(now = new Date()): Promise<FounderSignals> {
  const d7 = new Date(now.getTime() - 7 * DAY), d30 = new Date(now.getTime() - 30 * DAY);
  const [feedback, leads, deploys7, failed7, incidents, freezes, aiCost, agentPending, webhookFails, workspaces, newWorkspaces] = await Promise.all([
    safe(() => prisma.feedbackRecord.count({ where: { createdAt: { gte: d30 } } })),
    safe(() => prisma.lead.count({ where: { createdAt: { gte: d30 } } })),
    safe(() => prisma.deploymentExecution.count({ where: { createdAt: { gte: d7 } } })),
    safe(() => prisma.deploymentExecution.count({ where: { createdAt: { gte: d7 }, status: "completed", conclusion: { in: ["failure", "timed_out", "startup_failure"] } } })),
    safe(() => prisma.deploymentIncident.count({ where: { status: "open" } })),
    safe(async () => { const envs = await prisma.environment.findMany({ where: { changeWindowRuleJson: { not: undefined } }, take: 5000, select: { id: true, name: true, tier: true, changeWindowRuleJson: true } }); return activeFreezes(envs, now).freezes.reduce((n, f) => n + f.environments.length, 0); }),
    safe(async () => (await prisma.usageEvent.aggregate({ where: { eventKind: { in: ["ai_invocation", "agent_run"] }, createdAt: { gte: d30 } }, _sum: { billedCents: true } }))._sum.billedCents ?? 0),
    safe(() => prisma.agentGatewayRequest.count({ where: { status: "pending" } })),
    safe(() => prisma.webhookDelivery.count({ where: { status: "deadletter", createdAt: { gte: d7 } } })),
    safe(async () => (await prisma.orgMembership.groupBy({ by: ["organizationId"], where: { acceptedAt: { not: null } } })).length),
    safe(async () => (await prisma.orgMembership.groupBy({ by: ["organizationId"], _min: { createdAt: true } })).filter((g) => (g._min.createdAt ?? now) >= d30).length),
  ]);
  return { feedback_30d: feedback, leads_30d: leads, deployments_7d: deploys7, deployments_failed_7d: failed7, incidents_open: incidents, freezes_active: freezes, ai_cost_30d_cents: aiCost, agent_requests_pending: agentPending, webhook_failures_7d: webhookFails, workspaces_total: workspaces, workspaces_new_30d: newWorkspaces };
}

export const SIGNAL_LABEL: Record<SignalKey, { label: string; format: "count" | "cents"; attentionWhenAbove?: number }> = {
  feedback_30d: { label: "Feedback in the last 30 days", format: "count" },
  leads_30d: { label: "Leads in the last 30 days", format: "count" },
  deployments_7d: { label: "Deployments in the last 7 days", format: "count" },
  deployments_failed_7d: { label: "Failed deployments in the last 7 days", format: "count", attentionWhenAbove: 0 },
  incidents_open: { label: "Open incidents", format: "count", attentionWhenAbove: 0 },
  freezes_active: { label: "Environments frozen now", format: "count", attentionWhenAbove: 0 },
  ai_cost_30d_cents: { label: "AI cost in the last 30 days", format: "cents" },
  agent_requests_pending: { label: "Agent requests waiting for a person", format: "count", attentionWhenAbove: 0 },
  webhook_failures_7d: { label: "Webhook deliveries given up in 7 days", format: "count", attentionWhenAbove: 0 },
  workspaces_total: { label: "Workspaces", format: "count" },
  workspaces_new_30d: { label: "New workspaces in the last 30 days", format: "count" },
};
