"use client";

/**
 * /dashboard/self-diagnostic — AGI loop spine health check.
 *
 * Renders the pure-local diagnostic verdict per check + an overall
 * health score. No cloud calls, no DB writes. Useful on every deploy
 * + as a one-click smoke test.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheckIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

interface Check {
  id: string;
  label: string;
  verdict: "pass" | "fail";
  reason: string;
  durationMs: number;
}

interface Report {
  generatedAt: string;
  durationMs: number;
  totalChecks: number;
  passCount: number;
  failCount: number;
  healthScore: number;
  checks: Check[];
}

export default function SelfDiagnosticPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/autonomy/self-diagnostic", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Self-diagnostic unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const score = report ? Math.round(report.healthScore * 100) : 0;
  const scoreTone = score === 100 ? "emerald" : score >= 80 ? "amber" : "rose";

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(34,211,238,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(16,185,129,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ShieldCheckIcon className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
              AGI Self-Diagnostic
            </span>
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Re-run
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          AGI spine. <span className="text-gradient">Verified.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Pure local checks across charter, SCP simulator, help search, terraform drafter, validation matrix,
          and outbound env. No cloud calls — verifies the wiring, not the data.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Health" value={`${score}%`} tone={scoreTone} icon={ShieldCheckIcon} />
            <Stat label="Pass" value={String(report.passCount)} tone="emerald" icon={CheckCircleIcon} />
            <Stat label="Fail" value={String(report.failCount)} tone={report.failCount > 0 ? "rose" : "emerald"} icon={XCircleIcon} />
            <Stat label="Duration" value={`${report.durationMs}ms`} tone="zinc" icon={ClockIcon} />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <div className="divide-y divide-white/[0.04] border border-white/[0.06] rounded-2xl bg-white/[0.02] overflow-hidden mb-8">
          {report.checks.map((c) => (
            <div key={c.id} className="px-4 py-3 flex items-start gap-3">
              {c.verdict === "pass" ? (
                <CheckCircleIcon className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
              ) : (
                <XCircleIcon className="h-5 w-5 text-rose-300 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-white">{c.label}</p>
                  <code className="text-[10px] font-mono text-zinc-500">{c.id}</code>
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">{c.durationMs}ms</span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5">{c.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label, value, tone, icon: Icon,
}: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "zinc"; icon?: typeof ShieldCheckIcon }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
