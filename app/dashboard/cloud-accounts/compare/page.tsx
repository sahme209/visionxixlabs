/**
 * /dashboard/cloud-accounts/compare — Phase 543.
 *
 * Side-by-side cloud account comparison. Operator picks 2-4 accounts
 * via ?ids=a,b,c,d and gets a column per account with:
 *   · provider + alias header
 *   · severity-bucketed finding counts (critical → info)
 *   · recent-run summary (last 5 runs status mix)
 *   · pending approvals tied to runs on the account
 *   · last scan timestamp + autopilot mode
 *
 * Lets a cross-cloud operator answer "is my AWS prod hotter than my
 * GCP staging?" without pivoting through the multi-cloud projector
 * page. Empty / bad ?ids picks the first 3 connected accounts as a
 * default so the URL is bookmarkable bare.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Severity = "info" | "low" | "medium" | "high" | "critical";

const SEVERITY_TONE: Record<Severity, string> = {
  critical: "text-rose-400",
  high:     "text-rose-300",
  medium:   "text-amber-300",
  low:      "text-zinc-400",
  info:     "text-zinc-500",
};

interface ColumnData {
  id: string;
  provider: string;
  externalAccountId: string;
  alias: string | null;
  enabled: boolean;
  autopilotMode: string;
  lastScannedAt: Date | null;
  severityCounts: Record<Severity, number>;
  totalFindings: number;
  recentRuns: { ok: number; failed: number; pending: number; total: number };
  pendingApprovals: number;
}

function parseIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
}

export default async function CloudAccountCompare({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/cloud-accounts/compare");
  }
  const params = await searchParams;
  const requested = parseIds(params.ids);

  // All connected accounts for the picker, ordered enabled-first.
  const allAccounts = await prisma.cloudAccount.findMany({
    where: { organizationId: String(ctx.organizationId) },
    orderBy: [{ enabled: "desc" }, { connectedAt: "desc" }],
    select: {
      id: true,
      provider: true,
      externalAccountId: true,
      alias: true,
      enabled: true,
      autopilotMode: true,
      lastScannedAt: true,
    },
  }).catch(() => []);

  const lookup = new Map(allAccounts.map((a) => [a.id, a] as const));
  let selected = requested
    .map((id) => lookup.get(id))
    .filter((a): a is typeof allAccounts[number] => a != null);
  if (selected.length === 0) {
    selected = allAccounts.slice(0, 3);
  }

  // Per-column metrics in parallel — one severity groupBy + one runs
  // query + one approvals count per account is acceptable for ≤4
  // columns. Avoids a separate per-metric IN query that complicates
  // the response shape.
  const columns: ColumnData[] = await Promise.all(
    selected.map(async (a): Promise<ColumnData> => {
      const [findingGroups, recentRuns, pendingApprovals] = await Promise.all([
        prisma.axiomFinding.groupBy({
          by: ["severity"],
          where: { run: { cloudAccountId: a.id } },
          _count: { _all: true },
        }).catch(() => [] as Array<{ severity: string; _count: { _all: number } }>),
        prisma.axiomAgentRun.findMany({
          where: { cloudAccountId: a.id },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, status: true },
        }).catch(() => [] as Array<{ id: string; status: string }>),
        // pending approvals via runIds — AxiomApprovalItem has no run
        // relation; cap at the most recent 25 run ids.
        prisma.axiomAgentRun.findMany({
          where: { cloudAccountId: a.id },
          orderBy: { createdAt: "desc" },
          take: 25,
          select: { id: true },
        }).then((rows) =>
          rows.length === 0
            ? 0
            : prisma.axiomApprovalItem.count({
                where: {
                  organizationId: String(ctx.organizationId),
                  status: "pending",
                  runId: { in: rows.map((r) => r.id) },
                },
              }).catch(() => 0),
        ).catch(() => 0),
      ]);

      const severityCounts: Record<Severity, number> = {
        critical: 0, high: 0, medium: 0, low: 0, info: 0,
      };
      for (const g of findingGroups) {
        const s = g.severity as Severity;
        if (s in severityCounts) severityCounts[s] = g._count._all;
      }
      const totalFindings = Object.values(severityCounts).reduce((acc, n) => acc + n, 0);

      const runs = { ok: 0, failed: 0, pending: 0, total: recentRuns.length };
      for (const r of recentRuns) {
        if (r.status === "completed") runs.ok++;
        else if (r.status === "failed") runs.failed++;
        else runs.pending++;
      }

      return {
        id: a.id,
        provider: a.provider,
        externalAccountId: a.externalAccountId,
        alias: a.alias,
        enabled: a.enabled,
        autopilotMode: a.autopilotMode,
        lastScannedAt: a.lastScannedAt,
        severityCounts,
        totalFindings,
        recentRuns: runs,
        pendingApprovals,
      };
    }),
  );

  return (
    <div className="max-w-6xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/cloud-accounts" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Cloud accounts
      </Link>

      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">compare</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Cloud accounts side-by-side.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Up to four accounts compared on the same row of metrics. Add
          or swap with the chip picker below — works cross-provider, so
          an AWS prod and a GCP staging can sit in the same view.
        </p>
      </header>

      {/* Picker */}
      {allAccounts.length > 0 && (
        <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">add / swap</p>
          <div className="flex flex-wrap gap-1.5">
            {allAccounts.map((a) => {
              const isSelected = columns.some((c) => c.id === a.id);
              const nextIds = isSelected
                ? columns.filter((c) => c.id !== a.id).map((c) => c.id)
                : [...columns.map((c) => c.id), a.id].slice(0, 4);
              return (
                <Link
                  key={a.id}
                  href={`/dashboard/cloud-accounts/compare?ids=${nextIds.join(",")}`}
                  className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full border transition-colors ${
                    isSelected
                      ? "text-white border-white/[0.18] bg-white/[0.04]"
                      : "text-zinc-500 border-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12]"
                  }`}
                  title={a.externalAccountId}
                >
                  {a.provider} · {a.alias ?? a.externalAccountId.slice(-8)}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Comparison grid */}
      {columns.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-7 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No cloud accounts connected yet.</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Connect at least one via <Link href="/dashboard/connect-cloud" className="underline hover:text-white">/dashboard/connect-cloud</Link> and refresh.
          </p>
        </div>
      ) : (
        <section className={`grid gap-3 ${columns.length === 1 ? "grid-cols-1" : columns.length === 2 ? "grid-cols-2" : columns.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
          {columns.map((c) => (
            <article key={c.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 flex flex-col">
              <header className="mb-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-[0.18em]">
                  <span className={c.enabled ? "text-emerald-300" : "text-zinc-500"}>{c.enabled ? "enabled" : "disabled"}</span>
                  <span className="text-zinc-500">·</span>
                  <span className="text-zinc-300">{c.provider}</span>
                </div>
                <Link href={`/dashboard/cloud-accounts/${c.id}`} className="text-[14px] font-semibold text-white hover:text-zinc-300 transition-colors">
                  {c.alias ?? c.externalAccountId}
                </Link>
                <p className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate">{c.externalAccountId}</p>
              </header>

              <MetricRow label="findings · total" value={String(c.totalFindings)} tone={c.totalFindings > 0 ? "text-white" : "text-zinc-600"} />
              <MetricRow label="· critical" value={String(c.severityCounts.critical)} tone={c.severityCounts.critical > 0 ? SEVERITY_TONE.critical : "text-zinc-600"} />
              <MetricRow label="· high"     value={String(c.severityCounts.high)}     tone={c.severityCounts.high > 0     ? SEVERITY_TONE.high     : "text-zinc-600"} />
              <MetricRow label="· medium"   value={String(c.severityCounts.medium)}   tone={c.severityCounts.medium > 0   ? SEVERITY_TONE.medium   : "text-zinc-600"} />
              <MetricRow label="· low"      value={String(c.severityCounts.low)}      tone={c.severityCounts.low > 0      ? SEVERITY_TONE.low      : "text-zinc-600"} />
              <MetricRow label="· info"     value={String(c.severityCounts.info)}     tone={c.severityCounts.info > 0     ? SEVERITY_TONE.info     : "text-zinc-600"} />

              <Divider />

              <MetricRow label="recent runs · 5"   value={String(c.recentRuns.total)} />
              <MetricRow label="· ok"               value={String(c.recentRuns.ok)}     tone={c.recentRuns.ok > 0     ? "text-emerald-300" : "text-zinc-600"} />
              <MetricRow label="· failed"           value={String(c.recentRuns.failed)} tone={c.recentRuns.failed > 0 ? "text-rose-300"    : "text-zinc-600"} />
              <MetricRow label="· in flight"        value={String(c.recentRuns.pending)} tone={c.recentRuns.pending > 0 ? "text-amber-300"  : "text-zinc-600"} />

              <Divider />

              <MetricRow label="pending approvals" value={String(c.pendingApprovals)} tone={c.pendingApprovals > 0 ? "text-amber-300" : "text-zinc-600"} />
              <MetricRow label="autopilot"         value={c.autopilotMode.replace(/_/g, " ")} mono />
              <MetricRow label="last scan"         value={c.lastScannedAt ? c.lastScannedAt.toISOString().slice(0, 10) : "—"} mono tone={c.lastScannedAt ? "text-zinc-200" : "text-zinc-600"} />

              <div className="mt-4 flex gap-2">
                <Link
                  href={`/dashboard/findings?accountId=${encodeURIComponent(c.id)}`}
                  className="flex-1 text-center text-[11px] font-mono uppercase tracking-wider px-2 py-1.5 rounded-full border border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.18] transition-colors"
                >
                  findings →
                </Link>
                <Link
                  href={`/dashboard/cloud-accounts/${c.id}`}
                  className="flex-1 text-center text-[11px] font-mono uppercase tracking-wider px-2 py-1.5 rounded-full border border-white/[0.08] text-zinc-300 hover:text-white hover:border-white/[0.18] transition-colors"
                >
                  detail →
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function MetricRow({ label, value, tone, mono }: { label: string; value: string; tone?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className={`text-[12px] tabular-nums shrink-0 text-right ${tone ?? "text-zinc-200"} ${mono ? "font-mono" : "font-semibold"}`}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-white/[0.04]" />;
}
