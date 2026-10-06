"use client";

/**
 * /dashboard/tenant-insights — weekly narrative for this tenant.
 *
 * Aggregate-only input on the server side, so the prompt sent to the
 * model never includes raw tenant events. Falls back to a
 * deterministic template if AI is unavailable.
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowPathIcon, SparklesIcon } from "@heroicons/react/24/outline";

interface Seed {
  tenantId: string;
  windowDays: number;
  proposalsDecided: number;
  proposalsApproved: number;
  proposalsApplied: number;
  proposalsRejected: number;
  autonomyCycles: number;
  outboundSends: number;
  outboundFailures: number;
  dissentCount: number;
  topAuthorAgent: string | null;
}
interface Narrative {
  paragraph: string;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
}
interface InsightsResp { seed: Seed; narrative: Narrative }

const DAY_OPTS = [7, 14, 30];

export default function TenantInsightsPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<InsightsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((d: number) => {
    setLoading(true); setError(null);
    fetch(`/api/insights/tenant?days=${d}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: InsightsResp; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setData(j.data);
        else setError(j.error?.userMessage ?? "Insights unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <SparklesIcon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              Tenant insights · aggregate_input_only
            </span>
          </span>
          <button
            onClick={() => load(days)}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Your week, <span className="text-gradient">in one paragraph.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Aggregate counts only — no raw events, no prompts, no tenant content goes to the model. Falls back to
          a deterministic template if AI is unavailable.
        </p>

        <div className="mt-5 flex items-center gap-1.5">
          {DAY_OPTS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                days === d
                  ? "bg-indigo-500/15 text-indigo-200 border-indigo-500/30"
                  : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
              }`}
            >
              Last {d} days
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
          <div className="rounded-2xl border border-indigo-500/[0.18] bg-indigo-500/[0.04] p-5 mb-6 max-w-3xl">
            <p className="text-[10px] font-mono uppercase tracking-widest text-indigo-300 mb-2">Summary</p>
            <p className="text-[14px] text-zinc-100 leading-relaxed">{data.narrative.paragraph}</p>
            <p className="mt-3 text-[10px] font-mono text-zinc-500">
              provider: <span className="text-indigo-300">{data.narrative.provider ?? "(fallback)"}</span>
              {data.narrative.model && <>  ·  model: <span className="text-zinc-300">{data.narrative.model}</span></>}
              {" "}·{" "}
              aiUsed: <span className={data.narrative.aiUsed ? "text-emerald-300" : "text-amber-300"}>{String(data.narrative.aiUsed)}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl">
            <Card label="Proposals decided" value={data.seed.proposalsDecided} />
            <Card label="Approved" value={data.seed.proposalsApproved} tone="emerald" />
            <Card label="Applied" value={data.seed.proposalsApplied} tone="emerald" />
            <Card label="Rejected" value={data.seed.proposalsRejected} tone="rose" />
            <Card label="Autonomy cycles" value={data.seed.autonomyCycles} />
            <Card label="Outbound sends" value={data.seed.outboundSends} />
            <Card label="Outbound failures" value={data.seed.outboundFailures} tone="rose" />
            <Card label="Dissent count" value={data.seed.dissentCount} />
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "rose" }) {
  const tones: Record<"emerald" | "rose" | "default", string> = {
    emerald: "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.06]",
    rose:    "text-rose-300 border-rose-500/30 bg-rose-500/[0.06]",
    default: "text-zinc-200 border-white/[0.06] bg-white/[0.02]",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone ?? "default"]}`}>
      <p className="text-[10px] font-mono uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
