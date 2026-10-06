/**
 * /dashboard/cost-analysis — savings + risk breakdown by category.
 *
 * Aggregates findings count and approval-item dollar potential per
 * category (cost / resilience / security / performance / compliance)
 * so executives can answer 'where is Axiom finding money?' in one
 * glance. Recommendations aren't grouped here — recommendations live
 * on /dashboard/recommendations. This page is just the totals + a
 * tone bar per category.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export const dynamic = "force-dynamic";

type Category = "cost" | "resilience" | "security" | "performance" | "compliance";

const CATEGORY_LABEL: Record<Category, string> = {
  cost:        "Cost",
  resilience:  "Resilience",
  security:    "Security",
  performance: "Performance",
  compliance:  "Compliance",
};

const CATEGORY_HINT: Record<Category, string> = {
  cost:        "Rightsizing, idle resources, commitment opportunities.",
  resilience:  "Backup gaps, replica missing, AZ-redundancy.",
  security:    "IAM exposure, public-access risks, SG drift.",
  performance: "Latency hotspots, query plans, throughput.",
  compliance:  "CIS / NIST / PCI / HIPAA evidence gaps.",
};

const ORDER: Category[] = ["cost", "security", "resilience", "performance", "compliance"];

export default async function CostAnalysisPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/cost-analysis");
  }

  let findingGroups: Array<{ category: Category; count: number }> = [];
  let savingsByCategory: Record<Category, number> = { cost: 0, resilience: 0, security: 0, performance: 0, compliance: 0 };
  let migrationPending = false;

  try {
    const groups = await prisma.axiomFinding.groupBy({
      by: ["category"],
      where: { run: { organizationId: ctx.organizationId } },
      _count: { _all: true },
    });
    findingGroups = groups.map((g) => ({
      category: g.category as Category,
      count: g._count._all,
    }));

    // Savings: AxiomApprovalItem links back to AxiomRecommendation via
    // planItemId, which links to AxiomFinding via findingId. We sum
    // monthlyHigh per finding category for pending+snoozed items.
    const items = await prisma.axiomApprovalItem.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["pending", "snoozed"] },
      },
      select: { planItemId: true, monthlyHigh: true },
    });
    if (items.length > 0) {
      const recIds = items.map((i) => i.planItemId);
      const recs = await prisma.axiomRecommendation.findMany({
        where: { id: { in: recIds } },
        select: { id: true, finding: { select: { category: true } } },
      });
      const recCatById = new Map<string, Category>();
      for (const r of recs) recCatById.set(r.id, r.finding.category as Category);
      for (const item of items) {
        const cat = recCatById.get(item.planItemId);
        if (cat) savingsByCategory[cat] += item.monthlyHigh;
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

  const totalFindings = findingGroups.reduce((s, g) => s + g.count, 0);
  const totalSavings = Object.values(savingsByCategory).reduce((s, v) => s + v, 0);
  const maxCount = Math.max(1, ...findingGroups.map((g) => g.count));

  const countFor = (c: Category) => findingGroups.find((g) => g.category === c)?.count ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">cost analysis</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          {totalSavings > 0 ? (
            <>~${Math.round(totalSavings).toLocaleString()}<span className="text-zinc-500"> per month if approved.</span></>
          ) : totalFindings > 0 ? (
            <>{totalFindings} finding{totalFindings === 1 ? "" : "s"}<span className="text-zinc-500"> across the platform.</span></>
          ) : (
            "Connect a cloud to start measuring."
          )}
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Findings + pending savings by category. Numbers reflect what&apos;s
          actually persisted in the platform&apos;s tables — recommendations
          live at <Link href="/dashboard/recommendations" className="text-zinc-300 hover:text-white underline">/dashboard/recommendations</Link>.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-white/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            Findings / approval-items tables aren&apos;t migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code>.
          </p>
        </div>
      )}

      {!migrationPending && totalFindings === 0 && (
        <Link
          href="/dashboard/connect-cloud"
          className="group block rounded-2xl border border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] transition-colors px-7 py-12 text-center"
        >
          <p className="text-[15px] font-semibold text-white mb-1">No data yet</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed max-w-md mx-auto mb-5">
            Connect a cloud and run a scan. Findings and savings totals appear
            here per category as soon as the first scan completes.
          </p>
          <span className="inline-flex items-center gap-2 text-[13px] font-medium text-zinc-200 group-hover:text-white">
            Connect a cloud
            <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      {totalFindings > 0 && (
        <section>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">by category</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {ORDER.map((cat) => {
              const count = countFor(cat);
              const savings = savingsByCategory[cat];
              const widthPct = (count / maxCount) * 100;
              return (
                <li key={cat}>
                  <Link
                    href={`/dashboard/findings?q=${encodeURIComponent(CATEGORY_LABEL[cat].toLowerCase())}`}
                    className="group block px-6 py-5 hover:bg-white/[0.015] transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-4 mb-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-white">{CATEGORY_LABEL[cat]}</p>
                        <p className="text-[11px] text-zinc-500 leading-relaxed">{CATEGORY_HINT[cat]}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[16px] font-semibold tabular-nums text-white">
                          {savings > 0 ? `$${Math.round(savings).toLocaleString()}/mo` : "—"}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-500">{count} finding{count === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full bg-white/40 group-hover:bg-white/60 transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
