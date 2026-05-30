/**
 * Daily Briefing composer.
 *
 * Reads the tenant's last 24h of platform activity from the canonical
 * tables and composes a prose narrative summarizing what happened —
 * how many scans ran, what changed since the prior 24h, what's
 * urgent, what's available in dollars.
 *
 * No LLM, no templates per se. The composer walks the data and emits
 * structured paragraphs with embedded entity references (run ids,
 * approval ids, dollar amounts) the UI can deep-link.
 *
 * Pure async — server-only. Cached as 'force-dynamic' downstream.
 */

import "server-only";
import { prisma } from "@/lib/db";
import type { OrganizationId } from "@/lib/domain/ids";

export interface BriefingParagraph {
  id: string;
  /** Render the title at top of the paragraph in slightly heavier weight. */
  title: string;
  /** The narrative body — may include `**bold**` markers and `[label](href)` link markers. */
  body: string;
  /** Optional metric chip beside the title. */
  chip?: { label: string; tone: "emerald" | "amber" | "rose" | "neutral" };
}

export interface DailyBriefing {
  organizationId: OrganizationId;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  paragraphs: BriefingParagraph[];
  /** True iff at least one canonical table was empty or unmigrated. */
  partial: boolean;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function composeDailyBriefing(
  organizationId: OrganizationId,
): Promise<DailyBriefing> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - ONE_DAY_MS);
  const priorStart = new Date(now.getTime() - 2 * ONE_DAY_MS);
  const paragraphs: BriefingParagraph[] = [];
  let partial = false;

  // Scans in last 24h vs prior 24h. Let Prisma infer the row type
  // from the select — we map to plain strings below for the templates,
  // avoiding `as typeof` casts that can drift from the actual schema.
  type RecentRun = {
    id: string;
    trigger: string;
    completedAt: Date | null;
    cloudAccount: { provider: string; externalAccountId: string };
    _count: { findings: number };
  };
  let recentRuns: RecentRun[] = [];
  let priorRunCount = 0;
  try {
    const rows = await prisma.axiomAgentRun.findMany({
      where: {
        organizationId,
        status: "completed",
        completedAt: { gte: windowStart, lte: now },
      },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        trigger: true,
        completedAt: true,
        cloudAccount: { select: { provider: true, externalAccountId: true } },
        _count: { select: { findings: true } },
      },
    });
    recentRuns = rows.map((r) => ({
      id: r.id,
      trigger: String(r.trigger),
      completedAt: r.completedAt,
      cloudAccount: {
        provider: String(r.cloudAccount.provider),
        externalAccountId: r.cloudAccount.externalAccountId,
      },
      _count: r._count,
    }));
    priorRunCount = await prisma.axiomAgentRun.count({
      where: {
        organizationId,
        status: "completed",
        completedAt: { gte: priorStart, lt: windowStart },
      },
    });
  } catch {
    partial = true;
  }

  if (recentRuns.length === 0) {
    paragraphs.push({
      id: "scans",
      title: "No scans yesterday",
      body: "Nothing ran in the last 24 hours. Either your scheduled scan was disabled, the broker couldn't authenticate, or your account is fresh. Click Run scan now on the dashboard to kick off a fresh inventory pass.",
      chip: { label: "—", tone: "neutral" },
    });
  } else {
    const findingsTotal = recentRuns.reduce((s, r) => s + r._count.findings, 0);
    const newestRun = recentRuns[0];
    const trigger24h = countBy(recentRuns.map((r) => r.trigger));
    const triggerSummary = Object.entries(trigger24h)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${v} ${k}`)
      .join(" · ");
    const deltaCount = recentRuns.length - priorRunCount;
    const deltaLine = priorRunCount > 0
      ? ` ${deltaCount === 0 ? "Same volume as the prior 24h." : deltaCount > 0 ? `Up ${deltaCount} from the prior 24h.` : `Down ${Math.abs(deltaCount)} from the prior 24h.`}`
      : "";
    paragraphs.push({
      id: "scans",
      title: `${recentRuns.length} scan${recentRuns.length === 1 ? "" : "s"} completed`,
      body: `${triggerSummary} on ${pluralAccounts(recentRuns)} produced ${findingsTotal} finding${findingsTotal === 1 ? "" : "s"} total.${deltaLine} Most recent: [${newestRun.cloudAccount.provider}/${newestRun.cloudAccount.externalAccountId}](/dashboard/scans/${newestRun.id}).`,
      chip: {
        label: `${recentRuns.length} runs`,
        tone: recentRuns.length === 0 ? "rose" : "neutral",
      },
    });
  }

  // Findings by severity, last 24h vs prior 24h.
  try {
    const recent = await prisma.axiomFinding.groupBy({
      by: ["severity"],
      where: {
        run: { organizationId, status: "completed", completedAt: { gte: windowStart, lte: now } },
      },
      _count: { _all: true },
    });
    const prior = await prisma.axiomFinding.groupBy({
      by: ["severity"],
      where: {
        run: { organizationId, status: "completed", completedAt: { gte: priorStart, lt: windowStart } },
      },
      _count: { _all: true },
    });
    const recentBySev = Object.fromEntries(recent.map((r) => [r.severity, r._count._all]));
    const priorBySev = Object.fromEntries(prior.map((p) => [p.severity, p._count._all]));
    const critical = recentBySev["critical"] ?? 0;
    const high = recentBySev["high"] ?? 0;
    const medium = recentBySev["medium"] ?? 0;
    const priorHigh = (priorBySev["critical"] ?? 0) + (priorBySev["high"] ?? 0);
    const currentHigh = critical + high;
    const delta = currentHigh - priorHigh;
    if (currentHigh + medium > 0) {
      const parts: string[] = [];
      if (critical > 0) parts.push(`**${critical} critical**`);
      if (high > 0) parts.push(`${high} high`);
      if (medium > 0) parts.push(`${medium} medium`);
      paragraphs.push({
        id: "severity",
        title: "Severity breakdown",
        body: `${parts.join(" · ")} surfaced in the last 24h. ${
          priorHigh > 0
            ? delta === 0
              ? "Same volume of critical+high as yesterday."
              : delta > 0
                ? `Up ${delta} critical+high vs yesterday — investigate first.`
                : `Down ${Math.abs(delta)} critical+high vs yesterday — net improvement.`
            : "First measured window — no prior baseline yet."
        } [Open findings](/dashboard/findings?severity=high).`,
        chip: critical > 0
          ? { label: "needs review", tone: "rose" }
          : currentHigh > 0
            ? { label: "review", tone: "amber" }
            : { label: "ok", tone: "emerald" },
      });
    }
  } catch {
    partial = true;
  }

  // Approval queue activity.
  try {
    const pending = await prisma.axiomApprovalItem.count({
      where: { organizationId, status: { in: ["pending", "snoozed"] } },
    });
    const recentlyDecided = await prisma.axiomApprovalItem.count({
      where: {
        organizationId,
        status: { in: ["approved", "rejected", "applied"] },
        updatedAt: { gte: windowStart },
      },
    });
    const savingsAgg = await prisma.axiomApprovalItem.aggregate({
      where: { organizationId, status: { in: ["pending", "snoozed"] } },
      _sum: { monthlyHigh: true },
    });
    const totalSavings = savingsAgg._sum.monthlyHigh ?? 0;
    if (pending > 0 || recentlyDecided > 0) {
      const lines: string[] = [];
      if (pending > 0) {
        lines.push(`**${pending} pending recommendation${pending === 1 ? "" : "s"}** waiting on you`);
        if (totalSavings > 0) {
          lines.push(`worth ~$${Math.round(totalSavings).toLocaleString()}/mo if approved`);
        }
      }
      if (recentlyDecided > 0) {
        lines.push(`${recentlyDecided} decided in the last 24h`);
      }
      paragraphs.push({
        id: "approvals",
        title: pending > 0 ? "Approval queue" : "Approval activity",
        body: `${lines.join(" · ")}. [Open queue](/dashboard/approvals).`,
        chip: pending > 0
          ? { label: `${pending} pending`, tone: "amber" }
          : { label: "all clear", tone: "emerald" },
      });
    }
  } catch {
    partial = true;
  }

  // Recent failure signal — any scan.failure in last 24h.
  try {
    const failures = await (prisma as unknown as {
      secureAuditRecord: {
        count: (args: unknown) => Promise<number>;
      };
    }).secureAuditRecord.count({
      where: {
        organizationId,
        action: { startsWith: "scan." },
        outcome: "failure",
        occurredAt: { gte: windowStart },
      },
    });
    if (failures > 0) {
      paragraphs.push({
        id: "failures",
        title: "Scan failures",
        body: `${failures} scan attempt${failures === 1 ? "" : "s"} failed in the last 24h. Most likely cause: broker can't AssumeRole anymore (CFN stack rebuilt, trust policy drifted, or external id changed). [Probe broker health](/dashboard) on the dashboard's connected-accounts row.`,
        chip: { label: "investigate", tone: "rose" },
      });
    }
  } catch {
    partial = true;
  }

  if (paragraphs.length === 0) {
    paragraphs.push({
      id: "empty",
      title: "Nothing to report",
      body: "Either the workspace is brand new or the canonical tables haven't been populated yet. Run your first scan to start producing material for tomorrow's briefing.",
      chip: { label: "—", tone: "neutral" },
    });
  }

  return {
    organizationId,
    generatedAt: now.toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    paragraphs,
    partial,
  };
}

function countBy<T extends string>(xs: ReadonlyArray<T>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

function pluralAccounts(
  runs: ReadonlyArray<{ cloudAccount: { provider: string; externalAccountId: string } }>,
): string {
  const seen = new Set(runs.map((r) => `${r.cloudAccount.provider}/${r.cloudAccount.externalAccountId}`));
  if (seen.size === 1) return [...seen][0];
  return `${seen.size} accounts`;
}
