"use client";

/**
 * /dashboard/readiness
 *
 * Operator-facing readiness rollup. Fetches /api/readiness/launch
 * (LaunchReadinessReport — 17 categories, 0..100 score, 5-band status)
 * and /api/readiness (ProductionReadinessReport — 0..1 score, category
 * breakdown, critical failures, top fixes).
 *
 * Replaces a previously missing /dashboard/readiness route that doc CTAs
 * had been linking to. Every value canonical; no fabricated metrics.
 */

import { useEffect, useState } from "react";
import { ShieldCheckIcon, BoltIcon } from "@heroicons/react/24/outline";

interface LaunchRow {
  category: string;
  label: string;
  score: number;
  status: string;
  evidence?: string;
  sourceMode?: string;
  blockers?: string[];
  topFix?: string;
}

interface LaunchFix {
  category: string;
  reason: string;
}

interface LaunchReportLite {
  generatedAt: string;
  overallLaunchScore: number;
  overallStatus: string;
  rows: LaunchRow[];
  mustFixBeforeDemo: LaunchFix[];
  mustFixBeforePaidCustomer: LaunchFix[];
  acceptablePreviewAreas: LaunchFix[];
  blockedByExternalConfig: LaunchFix[];
  nextBestLaunchFixes: { id: string; title: string; category: string }[];
}

interface CategoryScore {
  category: string;
  score: number;
  total: number;
  passing: number;
  partial: number;
  preview: number;
  failing: number;
  blocked: number;
}

interface ReadinessReportLite {
  overallScore: number;
  generatedAt: string;
  categoryScores: CategoryScore[];
  criticalFailures: { id: string; title: string; nextFix?: string }[];
  recommendedNextFixes: { id: string; title: string; reason: string; href?: string }[];
}

const STATUS_TONE: Record<string, { pill: string; border: string; bg: string; text: string }> = {
  launch_ready:   { pill: "bg-emerald-500/15 text-emerald-300", border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.05]", text: "text-emerald-300" },
  acceptable:     { pill: "bg-cyan-500/15 text-cyan-300",       border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.05]",    text: "text-cyan-300"    },
  partial:        { pill: "bg-amber-500/15 text-amber-300",     border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.05]",   text: "text-amber-300"   },
  blocked:        { pill: "bg-rose-500/15 text-rose-300",       border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.05]",    text: "text-rose-300"    },
  failing:        { pill: "bg-rose-500/20 text-rose-200",       border: "border-rose-500/[0.30]",    bg: "bg-rose-500/[0.07]",    text: "text-rose-200"    },
};

export default function ReadinessPage() {
  const [launch, setLaunch] = useState<LaunchReportLite | null>(null);
  const [prod, setProd] = useState<ReadinessReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/readiness/launch", { credentials: "include" })
        .then((r) => r.json())
        .then((json: { ok?: boolean; data?: LaunchReportLite; error?: { userMessage?: string } }) => {
          if (cancelled) return;
          if (json.ok && json.data) setLaunch(json.data);
          else setError(json.error?.userMessage ?? "Launch readiness unavailable.");
        }),
      fetch("/api/readiness", { credentials: "include" })
        .then((r) => r.json())
        .then((json: { ok?: boolean; data?: ReadinessReportLite }) => {
          if (cancelled) return;
          if (json.ok && json.data) setProd(json.data);
        })
        .catch(() => {}),
    ])
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const launchScore = launch?.overallLaunchScore ?? 0;
  const prodScore = prod ? Math.round(prod.overallScore * 100) : 0;
  const overallTone = STATUS_TONE[launch?.overallStatus ?? "partial"] ?? STATUS_TONE.partial;

  const totalsRollup = prod?.categoryScores.reduce(
    (acc, c) => ({
      passing: acc.passing + c.passing,
      partial: acc.partial + c.partial,
      preview: acc.preview + c.preview,
      blocked: acc.blocked + c.blocked,
      failing: acc.failing + c.failing,
    }),
    { passing: 0, partial: 0, preview: 0, blocked: 0, failing: 0 },
  ) ?? { passing: 0, partial: 0, preview: 0, blocked: 0, failing: 0 };

  return (
    <div className="relative">
      {/* Hero */}
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="grid md:grid-cols-[1fr_auto] items-end gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1`}>
                <ShieldCheckIcon className="h-3.5 w-3.5 text-cyan-300" />
                <span className={`text-[10px] font-semibold uppercase tracking-widest ${overallTone.text}`}>
                  {launch?.overallStatus?.replace(/_/g, " ") ?? (loading ? "composing…" : "preview")}
                </span>
              </span>
              {launch?.generatedAt && (
                <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(launch.generatedAt).toLocaleTimeString()}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              Production <span className="text-gradient">readiness.</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              Launch + production readiness rollup. Every category score is derived from canonical builders — validation matrix rows, operating loops, evidence coverage, product honesty scans. <span className="text-zinc-500">No fabricated scores.</span>
            </p>
          </div>

          <div className="hidden md:flex items-end gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
            <Stat label="Launch" value={`${launchScore}%`} tone={overallTone.text} />
            <div className="w-px h-9 bg-white/[0.08]" />
            <Stat label="Production" value={`${prodScore}%`} tone="text-white" />
            <div className="w-px h-9 bg-white/[0.08]" />
            <Stat label="Pass / Fail" value={`${totalsRollup.passing}/${totalsRollup.failing}`} tone={totalsRollup.failing > 0 ? "text-rose-300" : "text-emerald-300"} />
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing readiness…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// readiness unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {/* Launch category rows */}
      {launch && launch.rows.length > 0 && (
        <section className="mb-10">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// launch readiness</p>
              <h2 className="text-lg font-semibold text-white mt-1 tracking-tight">17 launch categories</h2>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">{launch.rows.length} categories</span>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {launch.rows.map((r) => {
              const tone = STATUS_TONE[r.status] ?? STATUS_TONE.partial;
              return (
                <div key={r.category} className={`rounded-2xl border ${tone.border} ${tone.bg} p-4`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-[14px] font-semibold text-white tracking-tight truncate">{r.label}</h3>
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${tone.pill} shrink-0`}>
                      {r.status?.replace(/_/g, " ") ?? "unknown"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mb-2 text-[12px]">
                    <span className={`font-bold ${tone.text}`}>{r.score}%</span>
                    {r.sourceMode && <span className="text-zinc-500 font-mono">{r.sourceMode.replace(/_/g, " ")}</span>}
                  </div>
                  {r.blockers && r.blockers.length > 0 && (
                    <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
                      <span className="text-rose-300/80 font-mono uppercase tracking-wider text-[10px]">blocker:</span>{" "}
                      {r.blockers[0]}
                    </p>
                  )}
                  {r.topFix && (
                    <p className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300">
                      <span className="text-emerald-300/80 font-mono uppercase tracking-wider text-[10px]">top fix:</span> {r.topFix}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Top fixes */}
      {launch && launch.nextBestLaunchFixes.length > 0 && (
        <section className="mb-10">
          <div className="flex items-end mb-3">
            <div>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// next-best launch fixes</p>
              <h2 className="text-lg font-semibold text-white mt-1 tracking-tight">Top 5</h2>
            </div>
          </div>
          <div className="space-y-2">
            {launch.nextBestLaunchFixes.map((fix, i) => (
              <div
                key={fix.id}
                className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-[10px] font-mono text-zinc-500 mt-0.5">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white tracking-tight leading-snug">{fix.title}</p>
                    <p className="text-[11px] text-zinc-500 font-mono leading-relaxed mt-0.5">{fix.category}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Production readiness summary */}
      {prod && (
        <section className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// production readiness</p>
              <h2 className="text-lg font-semibold text-white mt-1 tracking-tight">{prodScore}% · {prod.categoryScores.length} categories</h2>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider">
              <span className="text-emerald-400">{totalsRollup.passing} pass</span>
              <span className="text-cyan-400">{totalsRollup.partial} partial</span>
              <span className="text-zinc-400">{totalsRollup.preview} preview</span>
              <span className="text-amber-400">{totalsRollup.blocked} blocked</span>
              <span className="text-rose-400">{totalsRollup.failing} failing</span>
            </div>
          </div>
          {prod.criticalFailures.length > 0 && (
            <div className="rounded-lg border border-rose-500/[0.22] bg-rose-500/[0.04] px-3 py-2 mt-2">
              <p className="text-[10px] font-mono text-rose-300/80 uppercase tracking-[0.18em] mb-1">
                // {prod.criticalFailures.length} critical failure{prod.criticalFailures.length === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-rose-200/90 truncate">{prod.criticalFailures[0].title}</p>
            </div>
          )}
        </section>
      )}

      {/* Demo / paid critical fix lists */}
      {launch && (launch.mustFixBeforeDemo.length > 0 || launch.mustFixBeforePaidCustomer.length > 0) && (
        <section className="mb-10 grid md:grid-cols-2 gap-3">
          {launch.mustFixBeforeDemo.length > 0 && (
            <div className="rounded-2xl border border-rose-500/[0.22] bg-rose-500/[0.04] p-5">
              <p className="text-[10px] font-mono text-rose-300/80 uppercase tracking-[0.18em] mb-2">// must fix before demo</p>
              <ul className="space-y-1">
                {launch.mustFixBeforeDemo.map((fix, i) => (
                  <li key={i} className="text-[12px] text-rose-200/90 font-mono leading-snug">
                    <span className="text-rose-300/70">{fix.category}:</span> {fix.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {launch.mustFixBeforePaidCustomer.length > 0 && (
            <div className="rounded-2xl border border-amber-500/[0.22] bg-amber-500/[0.04] p-5">
              <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-2">// must fix before paid pilot</p>
              <ul className="space-y-1">
                {launch.mustFixBeforePaidCustomer.map((fix, i) => (
                  <li key={i} className="text-[12px] text-amber-200/90 font-mono leading-snug">
                    <span className="text-amber-300/70">{fix.category}:</span> {fix.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Safety footer */}
      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8">
        <div className="flex items-start gap-3">
          <BoltIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// readiness contract</p>
            <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
              Readiness is a function of canonical state — validation matrix, operating loops, evidence coverage, product honesty scans. Scores never improve without a real wiring change.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="text-right min-w-[5rem]">
      <p className={`text-2xl font-bold tracking-tight leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}
