"use client";

/**
 * /dashboard/cron-health — per-cron health snapshot.
 *
 * Reads /api/cron-health and renders one card per registered cron
 * with total tick count, failure count, success rate, and the
 * consecutive-failure tally that drives the self-heal skip.
 */

import { useCallback, useEffect, useState } from "react";
import {
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface HealthSnapshot {
  cronName: string;
  total: number;
  failureCount: number;
  successRate: number;
  consecutiveFailures: number;
  lastAt?: string;
}

interface CronSpec {
  id: string;
  label: string;
  schedule: string;
  description: string;
  routePath: string;
  health: HealthSnapshot;
}

interface Report {
  generatedAt: string;
  total: number;
  snapshots: CronSpec[];
}

export default function CronHealthPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/cron-health", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Cron health unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(34,211,238,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(168,85,247,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ClockIcon className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
              Cron Health
            </span>
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Crons. <span className="text-gradient">Watching themselves.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Per-process snapshot — the same memory the self-heal tracker reads. After 3 consecutive errors a
          cron skips its next tick and surfaces here as red.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {report.snapshots.map((s) => {
            const sr = s.health.total > 0 ? Math.round(s.health.successRate * 100) : 100;
            const tone = s.health.consecutiveFailures >= 3
              ? "rose"
              : s.health.failureCount > 0
                ? "amber"
                : "emerald";
            return (
              <div key={s.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-white">{s.label}</p>
                    <p className="text-[10px] font-mono text-zinc-500">{s.schedule} · {s.routePath}</p>
                  </div>
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    tone === "emerald"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : tone === "amber"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  }`}>
                    {sr}% ok
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug mb-2">{s.description}</p>
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                  <div className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-1">
                    <p className="text-zinc-500 uppercase">ticks</p>
                    <p className="text-zinc-200 font-bold">{s.health.total}</p>
                  </div>
                  <div className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-1">
                    <p className="text-zinc-500 uppercase">errors</p>
                    <p className={s.health.failureCount > 0 ? "text-rose-300 font-bold" : "text-zinc-200 font-bold"}>
                      {s.health.failureCount}
                    </p>
                  </div>
                  <div className="rounded border border-white/[0.06] bg-black/20 px-1.5 py-1">
                    <p className="text-zinc-500 uppercase">streak</p>
                    <p className={s.health.consecutiveFailures >= 3 ? "text-rose-300 font-bold" : "text-zinc-200 font-bold"}>
                      {s.health.consecutiveFailures}
                    </p>
                  </div>
                </div>
                {s.health.lastAt && (
                  <p className="mt-2 text-[10px] font-mono text-zinc-500">last tick {new Date(s.health.lastAt).toLocaleString()}</p>
                )}
                {s.health.consecutiveFailures >= 3 ? (
                  <p className="mt-2 text-[10px] font-mono text-rose-300 inline-flex items-center gap-1">
                    <ExclamationTriangleIcon className="h-3 w-3" />
                    Self-heal is skipping next ticks
                  </p>
                ) : s.health.total > 0 && s.health.failureCount === 0 ? (
                  <p className="mt-2 text-[10px] font-mono text-emerald-300 inline-flex items-center gap-1">
                    <CheckCircleIcon className="h-3 w-3" />
                    All clear
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
