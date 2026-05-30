/**
 * /dashboard/findings — what your latest scan actually found.
 *
 * Reads directly from AxiomFinding (populated by persistScanRun in
 * commit d5539ac). This is the page that proves the platform stopped
 * being a polished mock after AWS connect — the numbers here are
 * exactly what came back from STS AssumeRole + EC2/S3/RDS reads.
 *
 * Empty state invites the operator to run their first scan; the
 * populated state lists findings by severity with deep links to the
 * run that produced them.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { CloudIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { RunScanButton } from "../RunScanButton";

export const dynamic = "force-dynamic";

type Severity = "info" | "low" | "medium" | "high" | "critical";

const SEVERITY_TONE: Record<Severity, string> = {
  critical: "text-rose-400",
  high:     "text-rose-300",
  medium:   "text-amber-300",
  low:      "text-zinc-400",
  info:     "text-zinc-500",
};

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high:     1,
  medium:   2,
  low:      3,
  info:     4,
};

function clampSev(input: string | undefined): Severity | "all" {
  if (input === "critical" || input === "high" || input === "medium" || input === "low" || input === "info") return input;
  return "all";
}

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; q?: string; accountId?: string }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/findings");
  }
  const params = await searchParams;
  const severityFilter = clampSev(params.severity);
  const search = (params.q ?? "").trim();
  const accountId = (params.accountId ?? "").trim();

  // Latest 100 findings for the org, joined through AxiomAgentRun so
  // we can also surface which scan produced each one.
  let findings: Array<{
    id: string;
    severity: Severity;
    category: string;
    title: string;
    description: string;
    provider: string;
    region: string;
    affectedResources: unknown;
    createdAt: Date;
    run: { id: string; completedAt: Date | null };
  }> = [];
  let migrationPending = false;
  try {
    findings = await prisma.axiomFinding.findMany({
      where: {
        run: {
          organizationId: ctx.organizationId,
          ...(accountId.length > 0 ? { cloudAccountId: accountId } : {}),
        },
        ...(severityFilter !== "all" ? { severity: severityFilter } : {}),
        ...(search.length > 0
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { description: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        severity: true,
        category: true,
        title: true,
        description: true,
        provider: true,
        region: true,
        affectedResources: true,
        createdAt: true,
        run: { select: { id: true, completedAt: true } },
      },
    }) as typeof findings;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }
  // Pre-compute the unfiltered counts strip so the user always sees
  // the per-severity totals even when a filter is on.
  let totalsBySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  if (!migrationPending) {
    try {
      const groups = await prisma.axiomFinding.groupBy({
        by: ["severity"],
        where: {
          run: {
            organizationId: ctx.organizationId,
            ...(accountId.length > 0 ? { cloudAccountId: accountId } : {}),
          },
        },
        _count: { _all: true },
      });
      for (const g of groups) {
        const s = g.severity as Severity;
        if (s in totalsBySeverity) totalsBySeverity[s] = g._count._all;
      }
    } catch { /* same migration-pending guard above already handled */ }
  }

  findings.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const counts = totalsBySeverity;

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">findings</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          What your scan found.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl mb-6">
          Every row here came from a real read against your connected cloud — STS AssumeRole, EC2 / S3 / RDS / VPC reads. No seeded data.
        </p>
        {!migrationPending && (
          <RunScanButton label={findings.length === 0 ? "Run your first scan" : "Run scan again"} />
        )}
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-amber-500/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            The findings table hasn&apos;t been migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code> against your database to surface scan results here.
          </p>
        </div>
      )}

      {!migrationPending && findings.length === 0 && (
        <EmptyState />
      )}

      {findings.length > 0 && (
        <>
          {/* Severity counts strip */}
          <section className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] grid grid-cols-5 overflow-hidden">
            {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => (
              <div key={s} className="px-4 py-4 text-center">
                <p className={`text-[22px] font-semibold tabular-nums ${counts[s] > 0 ? SEVERITY_TONE[s] : "text-zinc-600"}`}>
                  {counts[s]}
                </p>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mt-1">{s}</p>
              </div>
            ))}
          </section>

          {/* Filter row */}
          <section className="mb-4">
            <form method="GET" className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                {(["all", "critical", "high", "medium", "low", "info"] as Array<Severity | "all">).map((s) => {
                  const isActive = severityFilter === s;
                  return (
                    <a
                      key={s}
                      href={`/dashboard/findings?${new URLSearchParams({
                        ...(s !== "all" ? { severity: s } : {}),
                        ...(search ? { q: search } : {}),
                        ...(accountId ? { accountId } : {}),
                      }).toString()}`}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors ${
                        isActive
                          ? "text-white border-white/[0.18]"
                          : "text-zinc-500 border-white/[0.06] hover:text-white hover:border-white/[0.12]"
                      }`}
                    >
                      {s}
                    </a>
                  );
                })}
              </div>
              <input
                type="text"
                name="q"
                defaultValue={search}
                placeholder="Search title or description…"
                className="flex-1 min-w-[180px] rounded-full border border-white/[0.06] bg-white/[0.015] px-4 py-1.5 text-[12px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.18] transition-colors"
              />
              {severityFilter !== "all" && (
                <input type="hidden" name="severity" value={severityFilter} />
              )}
              {accountId && (
                <input type="hidden" name="accountId" value={accountId} />
              )}
              <button
                type="submit"
                className="rounded-full border border-white/[0.06] hover:border-white/[0.18] px-3 py-1.5 text-[11px] font-mono text-zinc-300 hover:text-white transition-colors"
              >
                search
              </button>
              {(search || severityFilter !== "all") && (
                <a
                  href="/dashboard/findings"
                  className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors"
                >
                  clear
                </a>
              )}
              <a
                href={`/api/findings/export.csv?${new URLSearchParams({
                  ...(severityFilter !== "all" ? { severity: severityFilter } : {}),
                  ...(search ? { q: search } : {}),
                  ...(accountId ? { accountId } : {}),
                }).toString()}`}
                download
                className="ml-auto text-[11px] font-mono text-zinc-500 hover:text-white transition-colors"
                title="Download up to 5000 matching findings as CSV"
              >
                download .csv
              </a>
            </form>
          </section>

          {/* Findings list */}
          <section>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">
              {findings.length === 0
                ? "no matches"
                : findings.length < 100
                  ? `${findings.length} match${findings.length === 1 ? "" : "es"}`
                  : "latest 100"}
            </p>
            <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
              {findings.map((f) => {
                const resources = Array.isArray(f.affectedResources) ? f.affectedResources : [];
                const firstRef = resources[0] != null ? String(resources[0]) : null;
                return (
                  <li key={f.id}>
                    <Link
                      href={`/dashboard/findings/${f.id}`}
                      className="group block px-6 py-4 hover:bg-white/[0.015] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] font-mono uppercase tracking-wider ${SEVERITY_TONE[f.severity]}`}>{f.severity}</span>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">· {f.category}</span>
                            <span className="text-[10px] font-mono text-zinc-600">· {f.provider} / {f.region}</span>
                          </div>
                          <p className="text-[14px] font-medium text-white">{f.title}</p>
                          <p className="text-[12px] text-zinc-500 leading-relaxed mt-1 line-clamp-2">{f.description}</p>
                          {firstRef && (
                            <p className="text-[11px] font-mono text-zinc-600 mt-1.5 truncate">{firstRef}{resources.length > 1 ? ` · +${resources.length - 1}` : ""}</p>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-600 shrink-0 text-right">
                          {f.createdAt.toLocaleDateString()}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Link
      href="/dashboard/connect-cloud"
      className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-12 text-center"
    >
      <CloudIcon className="h-8 w-8 text-zinc-600 mx-auto mb-4" />
      <p className="text-[15px] font-semibold text-white mb-1">No findings yet</p>
      <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto mb-5">
        Connect a cloud and run your first scan. Findings appear here within seconds of the broker finishing its AssumeRole.
      </p>
      <span className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-200 group-hover:text-white">
        Connect a cloud
        <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </Link>
  );
}
