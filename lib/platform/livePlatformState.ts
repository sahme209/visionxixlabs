/**
 * Live platform-state readers.
 *
 * Each function pulls the slice of real tenant state a dashboard
 * surface needs: connector accounts, recent agent activity, recent
 * automation runs. Every reader catches its own errors so a single
 * failure (unauthenticated user, DB unreachable, schema mismatch)
 * never blocks the page — it just hides the live segment and lets
 * the seed-demo fallback render.
 *
 * Filter rule: every query takes the org id and includes it in the
 * `where` clause. This codebase has no row-level security, so
 * forgetting to filter is a cross-tenant leak.
 */

import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------
// CONNECTOR LIVENESS — used by /dashboard/connectors and the platform
// health strip.
// ---------------------------------------------------------------------

export interface LiveConnectorAccount {
  provider: string;         // "aws" | "azure" | "gcp"
  alias: string | null;
  regions: number;
  autopilotMode: string;
  lastScannedAt: Date | null;
}

export interface LiveConnectorState {
  ok: boolean;
  organizationId: string | null;
  accounts: readonly LiveConnectorAccount[];
  byProvider: Readonly<Record<string, LiveConnectorAccount>>;
}

export async function getLiveConnectorState(): Promise<LiveConnectorState> {
  const empty: LiveConnectorState = { ok: false, organizationId: null, accounts: [], byProvider: {} };
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) return empty;
    const orgId = String(ctx.organizationId);

    const rows = await prisma.cloudAccount.findMany({
      where: { organizationId: orgId, enabled: true },
      select: {
        provider: true,
        alias: true,
        regions: true,
        autopilotMode: true,
        lastScannedAt: true,
      },
    });

    const accounts: LiveConnectorAccount[] = rows.map((r) => ({
      provider: String(r.provider).toLowerCase(),
      alias: r.alias ?? null,
      regions: r.regions.length,
      autopilotMode: String(r.autopilotMode),
      lastScannedAt: r.lastScannedAt ?? null,
    }));

    const byProvider: Record<string, LiveConnectorAccount> = {};
    for (const a of accounts) {
      // First wins — if the operator has multiple AWS accounts, we surface
      // the first encountered; the rest are visible in the count below.
      if (!byProvider[a.provider]) byProvider[a.provider] = a;
    }

    return { ok: true, organizationId: orgId, accounts, byProvider };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------
// AGENT LIVENESS — used by /dashboard/agents.
// ---------------------------------------------------------------------

export interface LiveAgentActivity {
  ok: boolean;
  organizationId: string | null;
  /** Messages per agent kernel id (from AgentBusMessage.sender) over the last 24h. */
  messagesBySender: Readonly<Record<string, number>>;
  /** Total bus messages in the window. */
  totalMessages: number;
  /** Total AxiomAgentRun rows in the window. */
  totalRuns: number;
  /** Last 5 agent runs (most recent first) — id + trigger + status + createdAt. */
  recentRuns: readonly {
    id: string;
    trigger: string;
    status: string;
    createdAt: Date;
  }[];
}

export async function getLiveAgentActivity(): Promise<LiveAgentActivity> {
  const empty: LiveAgentActivity = {
    ok: false,
    organizationId: null,
    messagesBySender: {},
    totalMessages: 0,
    totalRuns: 0,
    recentRuns: [],
  };
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) return empty;
    const orgId = String(ctx.organizationId);
    const since = new Date(Date.now() - ONE_DAY_MS);

    const [grouped, runCount, recent] = await Promise.all([
      prisma.agentBusMessage.groupBy({
        by: ["sender"],
        where: { organizationId: orgId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.axiomAgentRun.count({
        where: { organizationId: orgId, createdAt: { gte: since } },
      }),
      prisma.axiomAgentRun.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, trigger: true, status: true, createdAt: true },
      }),
    ]);

    const messagesBySender: Record<string, number> = {};
    let totalMessages = 0;
    for (const g of grouped) {
      const count = g._count._all;
      messagesBySender[String(g.sender)] = count;
      totalMessages += count;
    }

    return {
      ok: true,
      organizationId: orgId,
      messagesBySender,
      totalMessages,
      totalRuns: runCount,
      recentRuns: recent.map((r) => ({
        id: r.id,
        trigger: String(r.trigger),
        status: String(r.status),
        createdAt: r.createdAt,
      })),
    };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------
// AUTOMATION LIVENESS — used by /dashboard/automation.
// ---------------------------------------------------------------------

export interface LiveAutomationRun {
  id: string;
  trigger: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  summary: string | null;
}

export interface LiveAutomationState {
  ok: boolean;
  organizationId: string | null;
  /** Total AxiomAgentRun rows in 24h. */
  totalRuns24h: number;
  /** Breakdown by trigger over 24h. */
  byTrigger: Readonly<Record<string, number>>;
  /** Last 8 runs, most recent first. */
  recent: readonly LiveAutomationRun[];
  /** Approval-gated proposals currently pending. */
  pendingApprovals: number;
}

export async function getLiveAutomationState(): Promise<LiveAutomationState> {
  const empty: LiveAutomationState = {
    ok: false,
    organizationId: null,
    totalRuns24h: 0,
    byTrigger: {},
    recent: [],
    pendingApprovals: 0,
  };
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) return empty;
    const orgId = String(ctx.organizationId);
    const since = new Date(Date.now() - ONE_DAY_MS);

    const [grouped, recent, pendingCount] = await Promise.all([
      prisma.axiomAgentRun.groupBy({
        by: ["trigger"],
        where: { organizationId: orgId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.axiomAgentRun.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          trigger: true,
          status: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          summary: true,
        },
      }),
      prisma.axiomApprovalItem.count({
        where: { organizationId: orgId, status: "pending" },
      }),
    ]);

    const byTrigger: Record<string, number> = {};
    let totalRuns24h = 0;
    for (const g of grouped) {
      const count = g._count._all;
      byTrigger[String(g.trigger)] = count;
      totalRuns24h += count;
    }

    return {
      ok: true,
      organizationId: orgId,
      totalRuns24h,
      byTrigger,
      recent: recent.map((r) => ({
        id: r.id,
        trigger: String(r.trigger),
        status: String(r.status),
        startedAt: r.startedAt ?? null,
        completedAt: r.completedAt ?? null,
        createdAt: r.createdAt,
        summary: r.summary ?? null,
      })),
      pendingApprovals: pendingCount,
    };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------
// PLATFORM SUMMARY — used by /dashboard/modules and /dashboard/sub-tools
// for the cross-page health strip.
// ---------------------------------------------------------------------

export interface LivePlatformSummary {
  ok: boolean;
  cloudAccounts: number;
  agentRuns24h: number;
  busMessages24h: number;
  pendingApprovals: number;
}

export async function getLivePlatformSummary(): Promise<LivePlatformSummary> {
  const empty: LivePlatformSummary = {
    ok: false,
    cloudAccounts: 0,
    agentRuns24h: 0,
    busMessages24h: 0,
    pendingApprovals: 0,
  };
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) return empty;
    const orgId = String(ctx.organizationId);
    const since = new Date(Date.now() - ONE_DAY_MS);

    const [accounts, runs, msgs, approvals] = await Promise.all([
      prisma.cloudAccount.count({ where: { organizationId: orgId, enabled: true } }),
      prisma.axiomAgentRun.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
      prisma.agentBusMessage.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
      prisma.axiomApprovalItem.count({ where: { organizationId: orgId, status: "pending" } }),
    ]);

    return {
      ok: true,
      cloudAccounts: accounts,
      agentRuns24h: runs,
      busMessages24h: msgs,
      pendingApprovals: approvals,
    };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

export function relativeTime(d: Date | null): string {
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "in the future";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
