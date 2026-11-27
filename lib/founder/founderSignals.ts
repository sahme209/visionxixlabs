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
  const [feedback, leads, deploys7, failed7, incidents, freezes, aiCost, agentPending, webhookFails, workspaces, newWorkspaces, revenue, unanswered, atRisk] = await Promise.all([
    safe(() => prisma.feedbackRecord.count({ where: { createdAt: { gte: d30 } } })),
    safe(() => prisma.lead.count({ where: { createdAt: { gte: d30 } } })),
    safe(() => prisma.deploymentExecution.count({ where: { createdAt: { gte: d7 } } })),
    safe(() => prisma.deploymentExecution.count({ where: { createdAt: { gte: d7 }, status: "completed", conclusion: { in: ["failure", "timed_out", "startup_failure"] } } })),
    safe(() => prisma.deploymentIncident.count({ where: { status: "open" } })),
    safe(async () => { const envs = await prisma.environment.findMany({ where: { changeWindowRuleJson: { not: undefined } }, take: 5000, select: { id: true, name: true, tier: true, changeWindowRuleJson: true } }); return activeFreezes(envs, now).freezes.reduce((n, f) => n + f.environments.length, 0); }),
    safe(async () => (await prisma.usageEvent.aggregate({ where: { eventKind: { in: ["ai_invocation", "agent_run"] }, createdAt: { gte: d30 } }, _sum: { billedCents: true } }))._sum.billedCents ?? 0),
    safe(() => prisma.agentGatewayRequest.count({ where: { status: "pending" } })),
    safe(() => prisma.webhookDelivery.count({ where: { status: "deadletter", eventKind: { not: "webhook.ping" }, createdAt: { gte: d7 } } })),
    safe(async () => (await prisma.orgMembership.groupBy({ by: ["organizationId"], where: { acceptedAt: { not: null } } })).length),
    safe(async () => (await prisma.orgMembership.groupBy({ by: ["organizationId"], _min: { createdAt: true } })).filter((g) => (g._min.createdAt ?? now) >= d30).length),
    safe(async () => {
      const [addOns, settled, supporters] = await Promise.all([
        prisma.addOnPurchase.aggregate({ where: { status: { in: ["paid", "partially_refunded"] }, createdAt: { gte: d30 } }, _sum: { pricePaidCents: true, refundedAmountCents: true } }),
        prisma.aIUsageBillingSettlement.aggregate({ where: { status: "submitted", createdAt: { gte: d30 } }, _sum: { amountCents: true } }),
        prisma.foundingSupporterPurchase.aggregate({ where: { status: "paid", createdAt: { gte: d30 } }, _sum: { amountCents: true, refundedAmountCents: true } }),
      ]);
      return (addOns._sum.pricePaidCents ?? 0) - (addOns._sum.refundedAmountCents ?? 0) + (settled._sum.amountCents ?? 0) + (supporters._sum.amountCents ?? 0) - (supporters._sum.refundedAmountCents ?? 0);
    }),
    safe(() => prisma.helpQueryRecord.count({ where: { verdict: "ask_axiom_unanswered", createdAt: { gte: d30 } } })),
    safe(async () => {
      const d14 = new Date(now.getTime() - 14 * DAY);
      const plans = await prisma.tenantBillingPlan.findMany({ where: { OR: [{ status: "past_due" }, { cancelAtPeriodEnd: true }, { status: "active", tier: { not: "free" } }] }, select: { organizationId: true, status: true, cancelAtPeriodEnd: true }, take: 10_000 });
      const [usage, deploys] = await Promise.all([prisma.usageEvent.groupBy({ by: ["organizationId"], where: { createdAt: { gte: d14 } } }), prisma.deploymentExecution.groupBy({ by: ["organizationId"], where: { createdAt: { gte: d14 } } })]);
      const recent = new Set([...usage, ...deploys].map((r) => r.organizationId));
      return plans.filter((p) => p.status === "past_due" || p.cancelAtPeriodEnd || !recent.has(p.organizationId)).length;
    }),
  ]);
  return { feedback_30d: feedback, leads_30d: leads, deployments_7d: deploys7, deployments_failed_7d: failed7, incidents_open: incidents, freezes_active: freezes, ai_cost_30d_cents: aiCost, agent_requests_pending: agentPending, webhook_failures_7d: webhookFails, workspaces_total: workspaces, workspaces_new_30d: newWorkspaces, revenue_30d_cents: revenue, unanswered_questions_30d: unanswered, at_risk_workspaces: atRisk };
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
  revenue_30d_cents: { label: "Revenue collected in the last 30 days", format: "cents" },
  unanswered_questions_30d: { label: "Questions Ask V19 could not answer in 30 days", format: "count", attentionWhenAbove: 0 },
  at_risk_workspaces: { label: "Paying workspaces at risk", format: "count", attentionWhenAbove: 0 },
};
