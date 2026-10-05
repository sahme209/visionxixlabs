"use client";

/**
 * /dashboard/outbound-digest — operator-facing digest of the tenant's
 * outbound notifications. Reads from /api/notifications/digest.
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowPathIcon, BellAlertIcon } from "@heroicons/react/24/outline";

interface KindRow { kind: string; count: number; failed: number }
interface SeverityRow { severity: string; count: number }
interface DigestResp {
  windowHours: number;
  totalEvents: number;
  windowStart: string | null;
  windowEnd: string | null;
  outcomes: { ok: number; failed: number; skipped: number };
  byKind: KindRow[];
  bySeverity: SeverityRow[];
  topDedupeGroups: Array<{ dedupeKey: string; count: number }>;
  topCorrelationIds: Array<{ correlationId: string; count: number }>;
}

const WINDOW_OPTS = [
  { hours: 24,  label: "24h" },
  { hours: 168, label: "7d" },
  { hours: 720, label: "30d" },
];

export default function OutboundDigestPage() {
  const [windowHours, setWindowHours] = useState(168);
  const [data, setData] = useState<DigestResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((hours: number) => {
    setLoading(true); setError(null);
    fetch(`/api/notifications/digest?windowHours=${hours}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: DigestResp; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setData(j.data);
        else setError(j.error?.userMessage ?? "Digest unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(windowHours); }, [windowHours, load]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <BellAlertIcon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              Outbound digest
            </span>
          </span>
          <button
            onClick={() => load(windowHours)}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          What your channels <span className="text-gradient">actually sent.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Outcome split, per-kind health, severity histogram, and top dedupe groups. Use this to spot a noisy
          channel before operators tune out.
        </p>

        <div className="mt-5 flex items-center gap-1.5">
          {WINDOW_OPTS.map((o) => (
            <button
              key={o.hours}
              onClick={() => setWindowHours(o.hours)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                windowHours === o.hours
                  ? "bg-indigo-500/15 text-indigo-200 border-indigo-500/30"
                  : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Stat title="ok" value={data.outcomes.ok} tone="emerald" />
            <Stat title="failed" value={data.outcomes.failed} tone="rose" />
            <Stat title="skipped" value={data.outcomes.skipped} tone="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Panel title={`By kind · ${data.byKind.length}`}>
              {data.byKind.length === 0 ? <Empty /> : (
                <ul className="space-y-1 text-[12px]">
                  {data.byKind.map((k) => (
                    <li key={k.kind} className="flex items-center gap-2">
                      <span className="font-mono text-zinc-300 truncate flex-1">{k.kind}</span>
                      <span className="font-mono text-zinc-400 tabular-nums">{k.count}</span>
                      {k.failed > 0 && <span className="font-mono text-rose-300 tabular-nums">{k.failed} failed</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="By severity">
              {data.bySeverity.length === 0 ? <Empty /> : (
                <ul className="space-y-1 text-[12px]">
                  {data.bySeverity.map((s) => (
                    <li key={s.severity} className="flex items-center gap-2">
                      <span className="font-mono text-zinc-300 truncate flex-1">{s.severity}</span>
                      <span className="font-mono text-zinc-400 tabular-nums">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-12">
            <Panel title="Top dedupe groups">
              {data.topDedupeGroups.length === 0 ? <Empty /> : (
                <ul className="space-y-1 text-[12px]">
                  {data.topDedupeGroups.map((g) => (
                    <li key={g.dedupeKey} className="flex items-center gap-2">
                      <span className="font-mono text-zinc-400 truncate flex-1">{g.dedupeKey}</span>
                      <span className="font-mono text-zinc-300 tabular-nums">{g.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Top correlation ids">
              {data.topCorrelationIds.length === 0 ? <Empty /> : (
                <ul className="space-y-1 text-[12px]">
                  {data.topCorrelationIds.map((c) => (
                    <li key={c.correlationId} className="flex items-center gap-2">
                      <span className="font-mono text-indigo-300 truncate flex-1">{c.correlationId}</span>
                      <span className="font-mono text-zinc-300 tabular-nums">{c.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ title, value, tone }: { title: string; value: number; tone: "emerald" | "rose" | "amber" }) {
  const tones: Record<typeof tone, string> = {
    emerald: "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.06]",
    rose:    "text-rose-300 border-rose-500/30 bg-rose-500/[0.06]",
    amber:   "text-amber-300 border-amber-500/30 bg-amber-500/[0.06]",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[10px] font-mono uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">{title}</h2>
      {children}
    </div>
  );
}
function Empty() { return <p className="text-[12px] text-zinc-500">No data in this window.</p>; }
