/**
 * /dashboard/compliance — compliance scorecard from real findings.
 *
 * Walks COMPLIANCE_CONTROLS, scores each against the tenant's
 * findings' ruleCodes, and renders the results grouped by framework.
 * Each control surfaces 'failing' (real matching finding), 'untested'
 * (no matching finding, no positive evidence yet), or 'passing'
 * (reserved for future positive-evidence wiring).
 *
 * No mock data: an empty tenant sees every control as 'untested'
 * with an honest explanation. No fake green checkmarks.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { COMPLIANCE_CONTROLS, scoreControl, type ControlStatus } from "@/lib/compliance/controls";
import { ArrowRightIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { COMPLIANCE_ENGINEER_TARGET_KIND } from "@/lib/workforce/domains/complianceEngineer";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<ControlStatus, string> = {
  passing:  "text-emerald-300",
  failing:  "text-rose-300",
  untested: "text-zinc-500",
};

const STATUS_LABEL: Record<ControlStatus, string> = {
  passing:  "passing",
  failing:  "failing",
  untested: "untested",
};

export default async function CompliancePage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/compliance");
  }

  let ruleCodes: string[] = [];
  let migrationPending = false;
  try {
    const findings = await prisma.axiomFinding.findMany({
      where: { run: { organizationId: ctx.organizationId } },
      select: { data: true },
      take: 5000,
    });
    for (const f of findings) {
      const data = f.data as Record<string, unknown> | null;
      const code = data && typeof data.ruleCode === "string" ? data.ruleCode : null;
      if (code) ruleCodes.push(code);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      migrationPending = true;
    } else {
      throw err;
    }
  }

  const scored = COMPLIANCE_CONTROLS.map((c) => ({
    control: c,
    ...scoreControl(c, ruleCodes),
  }));

  const counts: Record<ControlStatus, number> = {
    passing:  scored.filter((s) => s.status === "passing").length,
    failing:  scored.filter((s) => s.status === "failing").length,
    untested: scored.filter((s) => s.status === "untested").length,
  };

  const byFramework = scored.reduce<Record<string, typeof scored>>((acc, s) => {
    const fw = s.control.framework;
    if (!acc[fw]) acc[fw] = [];
    acc[fw].push(s);
    return acc;
  }, {});

  // Phase 582 — compliance engineer's domain report, when one's been
  // generated. Headline panel shows the AI-enriched executive
  // summary + per-control evidence summaries. Operators see the
  // gap-summary at the top instead of building it mentally from the
  // failing-count tile.
  const complianceReportRow = await prisma.aiRationaleEnrichment.findUnique({
    where: {
      organizationId_targetKind_targetId: {
        organizationId: ctx.organizationId,
        targetKind: COMPLIANCE_ENGINEER_TARGET_KIND,
        targetId: "compliance_engineer",
      },
    },
    select: {
      narrative: true,
      nextActionsJson: true,
      outcome: true,
      modelHint: true,
      generatedAt: true,
      updatedAt: true,
    },
  }).catch(() => null);

  // Per-control evidence summaries — decoded from the pipe-delimited
  // payload the engineer persists. Falls back to the rules-based
  // summary if the row's missing (which the engineer also writes,
  // so this only happens when no report has been generated yet).
  const evidenceByControlId = new Map<string, string>();
  if (complianceReportRow && Array.isArray(complianceReportRow.nextActionsJson)) {
    for (const entry of complianceReportRow.nextActionsJson as unknown[]) {
      if (typeof entry !== "string") continue;
      const [controlId, , , ...summaryParts] = entry.split("|");
      if (controlId && summaryParts.length > 0) {
        evidenceByControlId.set(controlId, summaryParts.join("|"));
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-1 -mt-2">
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">compliance</p>
        <h1 className="text-[34px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-[-0.03em] mb-3">
          Controls, scored from your findings.
        </h1>
        <p className="text-[15px] text-zinc-400 leading-relaxed max-w-xl">
          Each control declares which rule codes count against it; matching
          findings flip it to failing. &apos;Untested&apos; is honest — we don&apos;t mark
          green just because nothing failed yet.
        </p>
      </header>

      {migrationPending && (
        <div className="mb-8 rounded-2xl border border-amber-500/15 bg-white/[0.015] px-6 py-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300 mb-1">migration pending</p>
          <p className="text-[13px] text-zinc-300">
            AxiomFinding table not migrated yet. Run <code className="font-mono text-white">prisma migrate deploy</code>.
          </p>
        </div>
      )}

      {/* Compliance engineer report — Phase 582. The AI-enriched
          executive summary appears above the counts; per-control
          evidence summaries appear inside each row in the framework
          lists below. */}
      <section className="mb-8 rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-violet-300 inline-flex items-center gap-2">
            <SparklesIcon className="h-3.5 w-3.5" /> compliance engineer · executive summary
          </p>
          <form action="/api/workforce/compliance_engineer/run-domain" method="POST">
            <button
              type="submit"
              className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-violet-500/30 text-violet-100 hover:text-white hover:border-violet-500/60 hover:bg-violet-500/15 transition-colors"
              title="Run the Compliance Engineer over your current findings"
            >
              {complianceReportRow ? "re-run report" : "generate report"}
            </button>
          </form>
        </div>
        {complianceReportRow ? (
          <>
            <p className="text-[13.5px] text-zinc-100 leading-relaxed whitespace-pre-line">{complianceReportRow.narrative}</p>
            <p className="text-[10px] font-mono text-zinc-500 mt-3">
              {complianceReportRow.outcome.replace(/_/g, " ")}
              {complianceReportRow.modelHint && <> · {complianceReportRow.modelHint}</>}
              {" · "}{complianceReportRow.updatedAt.toISOString().slice(0, 19).replace("T", " ")}
              {" · "}
              <Link href={`/dashboard/agi-memory/${encodeURIComponent(`${COMPLIANCE_ENGINEER_TARGET_KIND}:compliance_engineer`)}`} className="hover:text-white">
                permalink →
              </Link>
            </p>
          </>
        ) : (
          <p className="text-[13px] text-zinc-300 leading-relaxed">
            The Compliance Engineer hasn&apos;t produced a report for this workspace yet.
            Hit <strong>generate report</strong> — it walks every control, scores it against your findings,
            and writes the evidence summary in auditor language.
          </p>
        )}
      </section>

      {/* Counts strip */}
      <section className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-x divide-white/[0.04] grid grid-cols-3 overflow-hidden">
        <CountTile label="failing"  count={counts.failing}  tone={counts.failing > 0 ? "text-rose-300" : "text-zinc-600"} />
        <CountTile label="untested" count={counts.untested} tone="text-zinc-400" />
        <CountTile label="passing"  count={counts.passing}  tone={counts.passing > 0 ? "text-emerald-300" : "text-zinc-600"} />
      </section>

      {/* CSV export — audit-handoff artifact. Lives here, not behind a
          menu, because auditors want the .csv on the first click. */}
      <div className="mb-10 flex justify-end">
        <a
          href="/api/compliance/export.csv"
          download
          className="text-[11px] font-mono text-zinc-500 hover:text-white transition-colors"
          title="Download the full compliance scorecard as CSV"
        >
          download .csv
        </a>
      </div>

      {/* Per-framework grouped list */}
      <div className="space-y-10">
        {Object.entries(byFramework).map(([fw, rows]) => (
          <section key={fw}>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">{fw}</p>
            <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
              {rows.map(({ control, status, matchedCount }) => (
                <li key={control.id}>
                  <Link
                    href={`/dashboard/findings?q=${encodeURIComponent(control.ruleCodeMatchers[0] ?? "")}`}
                    className="group block px-6 py-4 hover:bg-white/[0.015] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                          <span className={STATUS_TONE[status]}>{STATUS_LABEL[status]}</span>
                          <span className="text-zinc-500">·</span>
                          <span className="text-zinc-600">{control.id}</span>
                        </div>
                        <p className="text-[14px] font-medium text-white">{control.title}</p>
                        <p className="text-[12px] text-zinc-500 leading-relaxed mt-1">{control.description}</p>
                        {evidenceByControlId.has(control.id) && (
                          <p className="text-[11.5px] text-violet-200/90 leading-relaxed mt-1.5 italic">
                            ↳ {evidenceByControlId.get(control.id)}
                          </p>
                        )}
                        {matchedCount > 0 && (
                          <p className="text-[11px] text-rose-300/80 mt-1">
                            {matchedCount} finding{matchedCount === 1 ? "" : "s"} match this control
                          </p>
                        )}
                      </div>
                      <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-12 text-[11px] text-zinc-600 leading-relaxed">
        Controls + matchers live in <code className="font-mono text-zinc-400">lib/compliance/controls.ts</code> —
        expand the catalog as scanner rule codes evolve.
      </p>
    </div>
  );
}

function CountTile({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className={`text-[22px] font-semibold tabular-nums ${tone}`}>{count}</p>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mt-1">{label}</p>
    </div>
  );
}
