/**
 * Founder business overview: revenue, customers, agents and AI, product feedback and support
 * questions across all workspaces. Founder-only: callers must have passed the founder gate.
 * Each section is read on its own; a section that cannot be read is null, never an estimate.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { PUBLIC_PLAN_CATALOG } from "@/lib/billing/publicPlanCatalog";
import { changePct, cohortRetention, dailySeries, funnel, marginPct, rankTopics, weeklyCounts, workspaceLabel, type CohortRow, type Funnel } from "./business";

const DAY = 86_400_000;
const safe = async <T>(read: () => Promise<T>): Promise<T | null> => { try { return await read(); } catch { return null; } };

export interface BusinessOverview {
  generatedAt: string;
  revenue: null | {
    last30Cents: number; previous30Cents: number; changePct: number | null; monthToDateCents: number;
    mrrListCents: number; paidWorkspaces: number; bySource: Array<{ source: string; cents: number }>;
    daily: Array<{ day: string; value: number }>; topWorkspaces: Array<{ label: string; cents: number }>;
  };
  customers: null | {
    workspaces: number; new30: number; signupsWeekly: Array<{ week: string; count: number }>; funnel: Funnel;
    atRisk: Array<{ label: string; reason: string }>;
    /** Weekly signup cohorts over the last 8 weeks; null when activity could not be read. */
    retention: CohortRow[] | null;
  };
  ai: null | {
    calls30: number; costCents: number; billedCents: number; marginPct: number | null;
    byModel: Array<{ model: string; calls: number; costCents: number; billedCents: number; marginPct: number | null }>;
    byKind: Array<{ kind: string; calls: number }>; topWorkspaces: Array<{ label: string; calls: number; billedCents: number }>;
    pendingAgentRequests: number;
  };
  product: null | {
    feedback30: number; negativeByPage: Array<{ page: string; count: number }>; bySentiment: Array<{ sentiment: string; count: number }>; topPages: Array<{ page: string; count: number }>;
    latest: Array<{ at: string; sentiment: string; page: string | null; excerpt: string }>;
  };
  support: null | {
    unanswered30: number; unansweredDaily: Array<{ day: string; value: number }>; topUnanswered: Array<{ topic: string; example: string; count: number }>;
    leads30: number; leadsBySource: Array<{ source: string; count: number }>;
  };
}

function listPriceCents(tier: string): number {
  return PUBLIC_PLAN_CATALOG.find((p) => p.id === tier)?.monthlyPricePerUserCents ?? 0;
}

export async function readBusinessOverview(now = new Date()): Promise<BusinessOverview> {
  const d30 = new Date(now.getTime() - 30 * DAY), d60 = new Date(now.getTime() - 60 * DAY), d7 = new Date(now.getTime() - 7 * DAY), d14 = new Date(now.getTime() - 14 * DAY), d84 = new Date(now.getTime() - 84 * DAY);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [revenue, customers, ai, product, support] = await Promise.all([
    safe(async () => {
      const [addOns, settlements, supporters, plans] = await Promise.all([
        prisma.addOnPurchase.findMany({ where: { status: { in: ["paid", "partially_refunded"] }, createdAt: { gte: d60 } }, select: { organizationId: true, pricePaidCents: true, refundedAmountCents: true, createdAt: true }, take: 10_000 }),
        prisma.aIUsageBillingSettlement.findMany({ where: { status: "submitted", createdAt: { gte: d60 } }, select: { organizationId: true, amountCents: true, submittedAt: true, createdAt: true }, take: 50_000 }),
        prisma.foundingSupporterPurchase.findMany({ where: { status: "paid", createdAt: { gte: d60 } }, select: { amountCents: true, refundedAmountCents: true, paidAt: true, createdAt: true }, take: 10_000 }),
        prisma.tenantBillingPlan.findMany({ where: { status: { in: ["active", "trialing", "past_due"] } }, select: { organizationId: true, tier: true, status: true, seatQuantity: true }, take: 10_000 }),
      ]);
      type Row = { at: Date; value: number; source: string; org: string | null };
      const rows: Row[] = [
        ...addOns.map((a) => ({ at: a.createdAt, value: a.pricePaidCents - a.refundedAmountCents, source: "AI credits and add-ons", org: a.organizationId })),
        ...settlements.map((s) => ({ at: s.submittedAt ?? s.createdAt, value: s.amountCents, source: "Usage billing", org: s.organizationId })),
        ...supporters.map((s) => ({ at: s.paidAt ?? s.createdAt, value: s.amountCents - s.refundedAmountCents, source: "Founding supporters", org: null })),
      ];
      const last = rows.filter((r) => r.at >= d30), prev = rows.filter((r) => r.at < d30);
      const sum = (rs: Row[]) => rs.reduce((t, r) => t + r.value, 0);
      const bySource = new Map<string, number>(); for (const r of last) bySource.set(r.source, (bySource.get(r.source) ?? 0) + r.value);
      const byOrg = new Map<string, number>(); for (const r of last) if (r.org) byOrg.set(r.org, (byOrg.get(r.org) ?? 0) + r.value);
      const paid = plans.filter((p) => p.status === "active" && listPriceCents(p.tier) > 0);
      return {
        last30Cents: sum(last), previous30Cents: sum(prev), changePct: changePct(sum(last), sum(prev)), monthToDateCents: sum(rows.filter((r) => r.at >= monthStart)),
        mrrListCents: paid.reduce((t, p) => t + listPriceCents(p.tier) * Math.max(1, p.seatQuantity ?? 1), 0), paidWorkspaces: paid.length,
        bySource: [...bySource.entries()].map(([source, cents]) => ({ source, cents })).sort((a, b) => b.cents - a.cents),
        daily: dailySeries(last.map((r) => ({ at: r.at, value: r.value })), 30, now),
        topWorkspaces: [...byOrg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([org, cents]) => ({ label: workspaceLabel(org), cents })),
      };
    }),
    safe(async () => {
      const [owners, repoOrgs, deployOrgs, active7Deploy, active7Usage, plans, recentUsageOrgs, recentDeployOrgs] = await Promise.all([
        prisma.orgMembership.findMany({ where: { role: "owner" }, select: { organizationId: true, createdAt: true }, take: 50_000 }),
        prisma.repository.groupBy({ by: ["organizationId"] }),
        prisma.deploymentExecution.groupBy({ by: ["organizationId"] }),
        prisma.deploymentExecution.groupBy({ by: ["organizationId"], where: { createdAt: { gte: d7 } } }),
        prisma.usageEvent.groupBy({ by: ["organizationId"], where: { createdAt: { gte: d7 } } }),
        prisma.tenantBillingPlan.findMany({ where: { OR: [{ status: { in: ["active", "past_due"] } }, { cancelAtPeriodEnd: true }] }, select: { organizationId: true, tier: true, status: true, cancelAtPeriodEnd: true }, take: 10_000 }),
        prisma.usageEvent.groupBy({ by: ["organizationId"], where: { createdAt: { gte: d14 } } }),
        prisma.deploymentExecution.groupBy({ by: ["organizationId"], where: { createdAt: { gte: d14 } } }),
      ]);
      const firstOwner = new Map<string, Date>(); for (const o of owners) { const c = firstOwner.get(o.organizationId); if (!c || o.createdAt < c) firstOwner.set(o.organizationId, o.createdAt); }
      const orgs = new Set(firstOwner.keys());
      const inOrgs = (rows: Array<{ organizationId: string }>) => new Set(rows.map((r) => r.organizationId).filter((id) => orgs.has(id)));
      const repo = inOrgs(repoOrgs), deployed = inOrgs(deployOrgs), active = new Set([...inOrgs(active7Deploy), ...inOrgs(active7Usage)]);
      const recent = new Set([...recentUsageOrgs, ...recentDeployOrgs].map((r) => r.organizationId));
      const atRisk: Array<{ label: string; reason: string }> = [];
      for (const p of plans) {
        if (p.status === "past_due") atRisk.push({ label: workspaceLabel(p.organizationId), reason: "Payment past due" });
        else if (p.cancelAtPeriodEnd) atRisk.push({ label: workspaceLabel(p.organizationId), reason: "Cancels at the end of the period" });
        else if (listPriceCents(p.tier) > 0 && !recent.has(p.organizationId)) atRisk.push({ label: workspaceLabel(p.organizationId), reason: "Paid plan, no activity in 14 days" });
      }
      const d56 = new Date(now.getTime() - 56 * DAY);
      const retention = await safe(async () => {
        const rows = await prisma.$queryRaw<Array<{ org: string; at: Date }>>`SELECT DISTINCT "organizationId" AS org, date_trunc('day', "createdAt") AS at FROM "UsageEvent" WHERE "createdAt" >= ${d56} UNION SELECT DISTINCT "organizationId" AS org, date_trunc('day', "createdAt") AS at FROM "DeploymentExecution" WHERE "createdAt" >= ${d56}`;
        return cohortRetention([...firstOwner.entries()].filter(([, d]) => d >= d56).map(([org, at]) => ({ org, at })), rows.map((r) => ({ org: r.org, at: new Date(r.at) })), 8, now);
      });
      return {
        retention,
        workspaces: orgs.size, new30: [...firstOwner.values()].filter((d) => d >= d30).length,
        signupsWeekly: weeklyCounts([...firstOwner.values()].filter((d) => d >= d84), 12, now),
        funnel: funnel([{ label: "Workspaces", count: orgs.size }, { label: "Connected a repository", count: repo.size }, { label: "Ran a deployment", count: deployed.size }, { label: "Active in the last 7 days", count: active.size }]),
        atRisk: atRisk.slice(0, 20),
      };
    }),
    safe(async () => {
      const [byModel, byKind, byOrg, pending] = await Promise.all([
        prisma.usageEvent.groupBy({ by: ["model"], where: { createdAt: { gte: d30 } }, _count: { _all: true }, _sum: { costCents: true, billedCents: true } }),
        prisma.usageEvent.groupBy({ by: ["eventKind"], where: { createdAt: { gte: d30 } }, _count: { _all: true } }),
        prisma.usageEvent.groupBy({ by: ["organizationId"], where: { createdAt: { gte: d30 } }, _count: { _all: true }, _sum: { billedCents: true } }),
        prisma.agentGatewayRequest.count({ where: { status: "pending" } }),
      ]);
      const models = byModel.map((m) => ({ model: m.model ?? "unrecorded", calls: m._count._all, costCents: m._sum.costCents ?? 0, billedCents: m._sum.billedCents ?? 0 })).map((m) => ({ ...m, marginPct: marginPct(m.billedCents, m.costCents) })).sort((a, b) => b.calls - a.calls).slice(0, 10);
      const cost = models.reduce((t, m) => t + m.costCents, 0), billed = models.reduce((t, m) => t + m.billedCents, 0);
      return {
        calls30: byModel.reduce((t, m) => t + m._count._all, 0), costCents: cost, billedCents: billed, marginPct: marginPct(billed, cost), byModel: models,
        byKind: byKind.map((k) => ({ kind: k.eventKind, calls: k._count._all })).sort((a, b) => b.calls - a.calls).slice(0, 8),
        topWorkspaces: byOrg.map((o) => ({ label: workspaceLabel(o.organizationId), calls: o._count._all, billedCents: o._sum.billedCents ?? 0 })).sort((a, b) => b.calls - a.calls).slice(0, 5),
        pendingAgentRequests: pending,
      };
    }),
    safe(async () => {
      const rows = await prisma.feedbackRecord.findMany({ where: { createdAt: { gte: d30 } }, orderBy: { createdAt: "desc" }, take: 2_000, select: { createdAt: true, sentiment: true, pagePath: true, message: true } });
      const count = <K extends string>(vals: K[]) => { const m = new Map<K, number>(); for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
      return {
        feedback30: rows.length,
        negativeByPage: count(rows.filter((r) => r.sentiment === "negative").map((r) => r.pagePath ?? "(no page)")).slice(0, 6).map(([page, n]) => ({ page, count: n })),
        bySentiment: count(rows.map((r) => r.sentiment)).map(([sentiment, n]) => ({ sentiment, count: n })),
        topPages: count(rows.map((r) => r.pagePath ?? "(no page)")).slice(0, 6).map(([page, n]) => ({ page, count: n })),
        latest: rows.slice(0, 8).map((r) => ({ at: r.createdAt.toISOString(), sentiment: r.sentiment, page: r.pagePath, excerpt: r.message.replace(/\s+/g, " ").slice(0, 200) })),
      };
    }),
    safe(async () => {
      const [questions, leads] = await Promise.all([
        prisma.helpQueryRecord.findMany({ where: { createdAt: { gte: d30 }, verdict: "ask_axiom_unanswered" }, orderBy: { createdAt: "desc" }, take: 5_000, select: { createdAt: true, query: true } }),
        prisma.lead.groupBy({ by: ["source"], where: { createdAt: { gte: d30 } }, _count: { _all: true } }),
      ]);
      return {
        unanswered30: questions.length,
        unansweredDaily: dailySeries(questions.map((q) => ({ at: q.createdAt, value: 1 })), 30, now),
        topUnanswered: rankTopics(questions.map((q) => q.query)),
        leads30: leads.reduce((t, l) => t + l._count._all, 0),
        leadsBySource: leads.map((l) => ({ source: l.source, count: l._count._all })).sort((a, b) => b.count - a.count),
      };
    }),
  ]);
  return { generatedAt: now.toISOString(), revenue, customers, ai, product, support };
}
