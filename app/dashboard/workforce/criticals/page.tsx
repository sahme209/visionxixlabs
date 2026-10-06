/**
 * /dashboard/workforce/criticals — Phase 619.
 *
 * Single page surfacing every critical safety verdict from the last
 * 14 days. Pulls from the rows the safety triad engineers persist:
 *  · engineer_approval_packet     where decision = reject | escalate
 *  · engineer_boundary_classification where tier ∈ {platform, catastrophic}
 *  · engineer_policy_decision     where decision = refuse
 *  · engineer_council_verdicts    where any verdict = request_more_data
 *
 * Pure projection — no new persistence, just reads what the
 * engineers already produced and ranks by severity then time.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Severity = "block" | "high" | "escalate";

interface CriticalRow {
  sourceKind: string;
  sourceLabel: string;
  targetId: string;
  title: string;
  severity: Severity;
  tag: string;
  narrative: string;
  updatedAt: Date;
  href: string;
}

const SEVERITY_RANK: Record<Severity, number> = { block: 0, high: 1, escalate: 2 };

const SEVERITY_TONE: Record<Severity, string> = {
  block: "text-rose-300 border-rose-500/30 bg-rose-500/[0.06]",
  high: "text-zinc-300 border-white/30 bg-white/[0.06]",
  escalate: "text-sky-300 border-sky-500/30 bg-sky-500/[0.06]",
};

function extractTitle(payload: unknown, fallback: string): string {
  if (!Array.isArray(payload)) return fallback;
  for (const e of payload as unknown[]) {
    if (typeof e === "string" && e.startsWith("title|")) return e.slice("title|".length);
  }
  return fallback;
}

function extractTag(payload: unknown, prefix: string): string | null {
  if (!Array.isArray(payload)) return null;
  for (const e of payload as unknown[]) {
    if (typeof e === "string" && e.startsWith(`${prefix}|`)) return e.slice(prefix.length + 1);
  }
  return null;
}

export default async function CriticalsPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/criticals");
  }
  const orgId = String(ctx.organizationId);

  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Fetch all four critical sources in parallel.
  const [approver, boundary, policy, council] = await Promise.all([
    prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId: orgId,
        targetKind: "engineer_approval_packet",
        updatedAt: { gte: since14d },
      },
      select: { targetId: true, narrative: true, updatedAt: true, nextActionsJson: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }).catch(() => []),
    prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId: orgId,
        targetKind: "engineer_boundary_classification",
        updatedAt: { gte: since14d },
      },
      select: { targetId: true, narrative: true, updatedAt: true, nextActionsJson: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }).catch(() => []),
    prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId: orgId,
        targetKind: "engineer_policy_decision",
        updatedAt: { gte: since14d },
      },
      select: { targetId: true, narrative: true, updatedAt: true, nextActionsJson: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }).catch(() => []),
    prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId: orgId,
        targetKind: "engineer_council_verdicts",
        updatedAt: { gte: since14d },
      },
      select: { targetId: true, narrative: true, updatedAt: true, nextActionsJson: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }).catch(() => []),
  ]);

  const rows: CriticalRow[] = [];

  for (const r of approver) {
    const decision = extractTag(r.nextActionsJson, "decision");
    if (decision !== "reject" && decision !== "escalate") continue;
    rows.push({
      sourceKind: "engineer_approval_packet",
      sourceLabel: "Approver",
      targetId: r.targetId,
      title: extractTitle(r.nextActionsJson, r.targetId),
      severity: decision === "reject" ? "block" : "escalate",
      tag: decision,
      narrative: r.narrative,
      updatedAt: r.updatedAt,
      href: `/dashboard/agi-memory/${encodeURIComponent(`engineer_approval_packet:${r.targetId}`)}`,
    });
  }
  for (const r of boundary) {
    const tier = extractTag(r.nextActionsJson, "tier");
    if (tier !== "platform" && tier !== "catastrophic") continue;
    rows.push({
      sourceKind: "engineer_boundary_classification",
      sourceLabel: "Boundary Gate",
      targetId: r.targetId,
      title: extractTitle(r.nextActionsJson, r.targetId),
      severity: tier === "catastrophic" ? "block" : "high",
      tag: tier,
      narrative: r.narrative,
      updatedAt: r.updatedAt,
      href: `/dashboard/agi-memory/${encodeURIComponent(`engineer_boundary_classification:${r.targetId}`)}`,
    });
  }
  for (const r of policy) {
    const decision = extractTag(r.nextActionsJson, "decision");
    if (decision !== "refuse") continue;
    rows.push({
      sourceKind: "engineer_policy_decision",
      sourceLabel: "Policy Gate",
      targetId: r.targetId,
      title: extractTitle(r.nextActionsJson, r.targetId),
      severity: "block",
      tag: "refuse",
      narrative: r.narrative,
      updatedAt: r.updatedAt,
      href: `/dashboard/agi-memory/${encodeURIComponent(`engineer_policy_decision:${r.targetId}`)}`,
    });
  }
  for (const r of council) {
    // Council verdicts payload contains per-observation verdict|... entries.
    // Surface when ANY observation got "request_more_data" — council was
    // honest that it couldn't rule, which is itself worth operator review.
    let hasUnresolved = false;
    if (Array.isArray(r.nextActionsJson)) {
      for (const e of r.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        if (e.startsWith("verdict|") && e.includes("|request_more_data|")) {
          hasUnresolved = true;
          break;
        }
      }
    }
    if (!hasUnresolved) continue;
    rows.push({
      sourceKind: "engineer_council_verdicts",
      sourceLabel: "Council",
      targetId: r.targetId,
      title: extractTitle(r.nextActionsJson, "Cross-engineer disagreement"),
      severity: "escalate",
      tag: "request_more_data",
      narrative: r.narrative,
      updatedAt: r.updatedAt,
      href: `/dashboard/agi-memory/${encodeURIComponent(`engineer_council_verdicts:${r.targetId}`)}`,
    });
  }

  // Sort: severity rank, then most recent first.
  rows.sort((a, b) => {
    const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (r !== 0) return r;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const blockCount = rows.filter((r) => r.severity === "block").length;
  const highCount = rows.filter((r) => r.severity === "high").length;
  const escalateCount = rows.filter((r) => r.severity === "escalate").length;

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">criticals · safety verdicts</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-rose-300 shrink-0 self-center" />
          What needs operator attention
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Every critical safety verdict from the last 14 days, ranked. Approver rejects, policy
          refusals, catastrophic / platform-tier blast radii, council "request_more_data" verdicts.
          One page so you don't have to walk every engineer.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="Block" value={blockCount} tone="text-rose-300" />
        <Stat label="High" value={highCount} tone="text-zinc-300" />
        <Stat label="Escalate" value={escalateCount} tone="text-sky-300" />
      </section>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] px-6 py-12 text-center">
          <p className="text-[13px] text-emerald-200">No critical safety verdicts in the last 14 days.</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Either nothing has triggered the safety triad, or every triage cleared. Calm state — keep watching the timeline.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={`${r.sourceKind}:${r.targetId}:${r.updatedAt.getTime()}`}>
              <Link href={r.href} className={`block rounded-2xl border p-5 hover:brightness-110 transition-all ${SEVERITY_TONE[r.severity]}`}>
                <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                  <span className="text-white">{r.sourceLabel}</span>
                  <span className="opacity-60">·</span>
                  <span className="opacity-80">{r.tag.replace(/_/g, " ")}</span>
                  <span className="ml-auto opacity-50">{r.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                </div>
                <p className="text-[14px] font-medium text-white">{r.title}</p>
                <p className="text-[12.5px] text-zinc-100/90 leading-relaxed mt-1 line-clamp-3">{r.narrative}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">{label}</p>
      <p className={`text-[22px] font-semibold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}
