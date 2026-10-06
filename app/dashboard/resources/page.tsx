/**
 * /dashboard/resources — what the platform discovered in your cloud.
 *
 * Parses snapshot.resources from the latest completed AxiomAgentRun
 * per connected CloudAccount and surfaces them grouped by kind
 * (ec2 / s3 / rds / vpc / etc.). Optional ?kind= filter narrows the
 * list to one kind. No mock data — if a tenant has run zero scans
 * the page is honest about that.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

interface Resource {
  id: string;
  kind: string;
  region: string;
  tag?: string;
  /** Which run + account did this come from? */
  accountId: string;
  runId: string;
}

interface ParsedSnapshot {
  resources?: Array<{ id?: unknown; kind?: unknown; region?: unknown; tag?: unknown }>;
}

function clampKind(input: string | undefined): string | null {
  if (!input) return null;
  const s = input.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (s.length === 0 || s.length > 32) return null;
  return s;
}

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/resources");
  }
  const params = await searchParams;
  const kindFilter = clampKind(params.kind);

  // Latest completed scan per CloudAccount for the org. We fetch up
  // to 5 accounts; a typical tenant has 1.
  let runs: Array<{
    id: string;
    snapshotData: unknown;
    completedAt: Date | null;
    cloudAccount: { id: string; externalAccountId: string; provider: string };
  }> = [];
  let migrationPending = false;
  try {
    const cloudAccounts = await prisma.cloudAccount.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, externalAccountId: true, provider: true },
      take: 5,
    });
    for (const acct of cloudAccounts) {
      const latest = await prisma.axiomAgentRun.findFirst({
        where: { cloudAccountId: acct.id, status: "completed" },
        orderBy: { completedAt: "desc" },
        select: { id: true, snapshotData: true, completedAt: true },
      });
      if (latest) {
        runs.push({
          id: latest.id,
          snapshotData: latest.snapshotData,
          completedAt: latest.completedAt,
          cloudAccount: acct,
        });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }

  // Flatten resources across runs.
  const resources: Resource[] = [];
  for (const run of runs) {
    const snap = (run.snapshotData as ParsedSnapshot | null) ?? {};
    const list = Array.isArray(snap.resources) ? snap.resources : [];
    for (const r of list) {
      const id = typeof r?.id === "string" ? r.id : null;
      const kind = typeof r?.kind === "string" ? r.kind.toLowerCase() : null;
      const region = typeof r?.region === "string" ? r.region : "";
      const tag = typeof r?.tag === "string" ? r.tag : undefined;
      if (!id || !kind) continue;
      if (kindFilter && kind !== kindFilter) continue;
      resources.push({
        id, kind, region, tag,
        accountId: run.cloudAccount.externalAccountId,
        runId: run.id,
      });
    }
  }

  // Counts by kind across the entire (unfiltered) inventory so the
  // filter strip stays honest.
  const totalsByKind: Record<string, number> = {};
  for (const run of runs) {
    const snap = (run.snapshotData as ParsedSnapshot | null) ?? {};
    const list = Array.isArray(snap.resources) ? snap.resources : [];
    for (const r of list) {
      const kind = typeof r?.kind === "string" ? r.kind.toLowerCase() : null;
      if (!kind) continue;
      totalsByKind[kind] = (totalsByKind[kind] ?? 0) + 1;
    }
  }
  const allKinds = Object.keys(totalsByKind).sort();
  const grandTotal = Object.values(totalsByKind).reduce((s, n) => s + n, 0);

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">resources</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          {grandTotal === 0
            ? "What the platform sees."
            : <>{grandTotal} resource{grandTotal === 1 ? "" : "s"}<span className="text-zinc-500"> across {runs.length} account{runs.length === 1 ? "" : "s"}.</span></>}
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Parsed from the latest completed scan&apos;s snapshot.resources for
          each connected cloud account. Click a kind to filter; click any
          resource to jump to the scan that found it.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-white/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            CloudAccount / AxiomAgentRun tables not migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code>.
          </p>
        </div>
      )}

      {!migrationPending && runs.length === 0 && (
        <Link
          href="/dashboard/connect-cloud"
          className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-12 text-center"
        >
          <p className="text-[15px] font-semibold text-white mb-1">No scans yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto mb-5">
            Connect a cloud and run a scan. The snapshot will populate this
            inventory from the broker&apos;s real reads against your account.
          </p>
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-200 group-hover:text-white">
            Connect a cloud
            <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      {runs.length > 0 && allKinds.length > 0 && (
        <>
          {/* Filter strip — pill per kind with count */}
          <section className="mb-6">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href="/dashboard/resources"
                className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors ${
                  kindFilter === null
                    ? "text-white border-white/[0.18]"
                    : "text-zinc-500 border-white/[0.06] hover:text-white hover:border-white/[0.12]"
                }`}
              >
                all <span className="text-zinc-600">· {grandTotal}</span>
              </Link>
              {allKinds.map((k) => (
                <Link
                  key={k}
                  href={`/dashboard/resources?kind=${encodeURIComponent(k)}`}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors ${
                    kindFilter === k
                      ? "text-white border-white/[0.18]"
                      : "text-zinc-500 border-white/[0.06] hover:text-white hover:border-white/[0.12]"
                  }`}
                >
                  {k} <span className="text-zinc-600">· {totalsByKind[k]}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Resource list */}
          <section>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">
              {kindFilter ? `${resources.length} ${kindFilter}` : "inventory"}
            </p>
            <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
              {resources.slice(0, 200).map((r) => (
                <li key={`${r.runId}_${r.id}`}>
                  <Link
                    href={`/dashboard/scans/${r.runId}`}
                    className="group flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.015] transition-colors"
                  >
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 w-12 shrink-0">
                      {r.kind}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-mono text-zinc-200 truncate">{r.id}</p>
                      {r.tag && (
                        <p className="text-[11px] text-zinc-500 truncate">{r.tag}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-600 shrink-0 text-right">
                      {r.region}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-600 shrink-0 w-32 text-right truncate">
                      {r.accountId}
                    </span>
                  </Link>
                </li>
              ))}
              {resources.length > 200 && (
                <li className="px-6 py-3 text-center text-[11px] text-zinc-500">
                  Showing first 200 of {resources.length}. Filter by kind to narrow.
                </li>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
