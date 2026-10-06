"use client";

/**
 * /dashboard/help-analytics — help query analytics.
 *
 * Surfaces the per-verdict counts, top queries, and (most useful)
 * top no_match queries. The no_match list is where the docs are
 * silently failing — those queries should drive new HelpEntry
 * additions.
 */

import { useEffect, useState } from "react";
import {
  MagnifyingGlassIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface Row {
  id: string;
  query: string;
  totalTokens: number;
  verdict: string;
  primaryEntryId?: string | null;
  topHitScore?: number | null;
  createdAt: string;
}

interface Analytics {
  total: number;
  perVerdict: Record<string, number>;
  topQueries: { query: string; count: number }[];
  topNoMatchQueries: { query: string; count: number }[];
  recent: Row[];
}

const VERDICT_TONE: Record<string, string> = {
  found_primary: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  ambiguous:     "bg-white/15 text-zinc-300 border-white/30",
  no_match:      "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export default function HelpAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/help/analytics?limit=200", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Analytics; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setData(j.data);
        else setError(j.error?.userMessage ?? "Analytics unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."));
  }, []);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(34,211,238,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(244,114,182,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <MagnifyingGlassIcon className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
              Help Analytics
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          What can't <span className="text-gradient">we answer?</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every help search lands here. The 'no_match' column is where the docs are silently failing — those
          are the queries that should drive new HelpEntry additions.
        </p>

        {data && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total queries" value={String(data.total)} tone="cyan" icon={ChartBarIcon} />
            <Stat label="Primary hits" value={String(data.perVerdict.found_primary ?? 0)} tone="emerald" />
            <Stat label="Ambiguous" value={String(data.perVerdict.ambiguous ?? 0)} tone="amber" />
            <Stat
              label="No match"
              value={String(data.perVerdict.no_match ?? 0)}
              tone={(data.perVerdict.no_match ?? 0) > 0 ? "rose" : "emerald"}
              icon={ExclamationTriangleIcon}
            />
          </div>
        )}
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Panel
              title="Top queries"
              subtitle="Most asked overall"
              rows={data.topQueries}
              tone="cyan"
            />
            <Panel
              title="Top no_match queries"
              subtitle="Real signal — the docs need these"
              rows={data.topNoMatchQueries}
              tone="rose"
            />
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 mb-8">
            <p className="text-[11px] font-mono text-cyan-300/80 uppercase tracking-wider mb-2">
              // recent queries
            </p>
            <div className="divide-y divide-white/[0.04] border border-white/[0.06] rounded-lg overflow-hidden">
              {data.recent.length === 0 ? (
                <p className="p-4 text-[12px] text-zinc-400 italic">No queries logged yet.</p>
              ) : (
                data.recent.map((r) => (
                  <div key={r.id} className="px-3 py-2 hover:bg-white/[0.02]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${VERDICT_TONE[r.verdict] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                        {r.verdict}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{r.totalTokens} token{r.totalTokens === 1 ? "" : "s"}</span>
                      {r.primaryEntryId && (
                        <span className="text-[10px] font-mono text-zinc-400">→ {r.primaryEntryId}</span>
                      )}
                      {r.topHitScore !== null && r.topHitScore !== undefined && (
                        <span className="text-[10px] font-mono text-zinc-500">score {r.topHitScore.toFixed(2)}</span>
                      )}
                      <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-[12px] text-white mt-0.5 truncate">{r.query}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Panel({
  title, subtitle, rows, tone,
}: { title: string; subtitle: string; rows: { query: string; count: number }[]; tone: "cyan" | "rose" }) {
  const cls = tone === "rose"
    ? "border-rose-500/15 bg-rose-500/[0.03]"
    : "border-cyan-500/15 bg-cyan-500/[0.03]";
  return (
    <div className={`rounded-2xl border ${cls} p-4`}>
      <p className={`text-[10px] font-mono uppercase tracking-wider mb-0.5 ${tone === "rose" ? "text-rose-300/80" : "text-cyan-300/80"}`}>
        {subtitle}
      </p>
      <p className="text-[14px] font-semibold text-white mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[11px] text-zinc-400 italic">No queries yet.</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((r, i) => (
            <li key={r.query + i} className="flex items-center gap-2 text-[12px]">
              <span className="text-[10px] font-mono text-zinc-500 w-5">{i + 1}.</span>
              <span className="flex-1 truncate text-zinc-200">{r.query}</span>
              <span className="text-[10px] font-mono text-zinc-400">×{r.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({
  label, value, tone, icon: Icon,
}: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "cyan"; icon?: typeof ChartBarIcon }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    cyan:    "border-cyan-500/[0.18] bg-cyan-500/[0.03] text-cyan-200",
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
