/**
 * /dashboard/self-diagnostic — Phase 671.
 *
 * Live view of the AGI spine self-check: charter, SCP simulator, help
 * search, terraform drafter, validation matrix, env consistency. Pure
 * projection from lib/autonomy/agiSelfDiagnostic — no cloud calls.
 *
 * Reason for existing: validation matrix row ui.self_diagnostic_page
 * was marked blocked in Phase 670 because this page had never been
 * built. Phase 671 ships it so the row can go back to passing.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircleIcon, XCircleIcon, BeakerIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { runAgiSelfDiagnostic } from "@/lib/autonomy/agiSelfDiagnostic";

export const dynamic = "force-dynamic";

export default async function SelfDiagnosticPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    redirect("/auth/signin?callbackUrl=/dashboard/self-diagnostic");
  }
  const report = runAgiSelfDiagnostic();
  const scorePct = Math.round(report.healthScore * 100);
  const scoreTone = report.healthScore >= 0.9 ? "text-emerald-300" : report.healthScore >= 0.7 ? "text-amber-300" : "text-rose-300";

  return (
    <div className="max-w-4xl mx-auto px-1 -mt-2">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Dashboard
      </Link>
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">self-diagnostic</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">agi spine health</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <BeakerIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          AGI self-diagnostic
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-2xl">
          Pure local checks — charter, SCP simulator, help search, terraform drafter, validation matrix,
          environment consistency. No cloud calls, no Prisma queries. Fails at CI if the spine drifts.
        </p>
      </header>

      {/* Ribbon */}
      <section className="mb-8 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Health score</p>
            <p className={`text-[38px] font-semibold tabular-nums leading-none ${scoreTone}`}>{scorePct}<span className="text-[16px] text-zinc-500">%</span></p>
          </div>
          <div className="flex gap-4 text-[12px] font-mono">
            <div><span className="text-emerald-300 font-semibold tabular-nums">{report.passCount}</span> <span className="text-zinc-500">pass</span></div>
            <div><span className="text-rose-300 font-semibold tabular-nums">{report.failCount}</span> <span className="text-zinc-500">fail</span></div>
            <div><span className="text-zinc-300 font-semibold tabular-nums">{report.totalChecks}</span> <span className="text-zinc-500">total</span></div>
            <div><span className="text-zinc-300 font-semibold tabular-nums">{report.durationMs}</span> <span className="text-zinc-500">ms</span></div>
          </div>
          <form action="/dashboard/self-diagnostic" method="GET" className="ml-auto">
            <button
              type="submit"
              className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors"
            >
              re-run →
            </button>
          </form>
        </div>
        <p className="text-[11px] text-zinc-500 mt-3 font-mono">generated {report.generatedAt}</p>
      </section>

      {/* Per-check rows */}
      <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
        {report.checks.map((c) => {
          const Icon = c.verdict === "pass" ? CheckCircleIcon : XCircleIcon;
          const tone = c.verdict === "pass" ? "text-emerald-300" : "text-rose-300";
          return (
            <li key={c.id} className="px-5 py-3.5">
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 ${tone} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-0.5">
                    <p className="text-[13.5px] text-white">{c.label}</p>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                      <span>{c.id}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="tabular-nums">{c.durationMs}ms</span>
                    </div>
                  </div>
                  <p className={`text-[12px] leading-relaxed ${c.verdict === "pass" ? "text-zinc-400" : "text-rose-200/80"}`}>{c.reason}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
