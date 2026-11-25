"use client";

/**
 * /dashboard/tenant-insights — weekly narrative for this tenant.
 *
 * Aggregate-only input on the server side, so the prompt sent to the
 * model never includes raw tenant events. Falls back to a
 * deterministic template if AI is unavailable.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
  status: "metrics" | "generated" | "budget_exceeded" | "credits_exhausted" | "already_requested" | "unavailable";
}
interface InsightsResp { seed: Seed; narrative: Narrative }

const DAY_OPTS = [7, 14, 30];
const summaryStatus: Record<Narrative["status"], string> = {
  metrics: "Summary from recorded counts",
  generated: "AI summary",
  budget_exceeded: "The workspace AI budget would be exceeded. Showing recorded counts.",
  credits_exhausted: "There are insufficient available AI credits. Showing recorded counts.",
  already_requested: "This AI summary request was already submitted. Showing recorded counts.",
  unavailable: "An AI summary could not be confirmed. Showing recorded counts.",
};

export default function TenantInsightsPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<InsightsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const pendingSummary = useRef<{ days: number; key: string } | null>(null);

  const load = useCallback((d: number, generate = false) => {
    if (generate && activeRequest.current) return;
    activeRequest.current?.abort();
    const request = new AbortController();
    activeRequest.current = request;
    if (generate && pendingSummary.current?.days !== d) pendingSummary.current = { days: d, key: crypto.randomUUID() };
    setLoading(!generate);
    setGenerating(generate);
    setError(null);
    fetch(`/api/insights/tenant?days=${d}`, {
      credentials: "include",
      signal: request.signal,
      ...(generate && pendingSummary.current ? { method: "POST", headers: { "Idempotency-Key": pendingSummary.current.key } } : {}),
    })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: InsightsResp; error?: { userMessage?: string } }) => {
        if (activeRequest.current !== request) return;
        if (j.ok && j.data) {
          if (generate) pendingSummary.current = null;
          setData(j.data);
        }
        else setError(j.error?.userMessage ?? "Insights unavailable.");
      })
      .catch(() => {
        if (activeRequest.current === request) setError(generate ? "The AI summary request could not be confirmed." : "Insights unavailable.");
      })
      .finally(() => {
        if (activeRequest.current !== request) return;
        activeRequest.current = null;
        setLoading(false);
        setGenerating(false);
      });
  }, []);

  useEffect(() => {
    load(days);
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [days, load]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/5 bg-linear-to-br from-white/2.5 via-white/1.5 to-transparent p-6 md:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/6 bg-white/2 px-2.5 py-1">
            <SparklesIcon className="h-3.5 w-3.5 text-zinc-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
              Tenant insights · aggregate_input_only
            </span>
          </span>
          <button
            onClick={() => load(days)}
            disabled={loading || generating}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/2 text-zinc-300 border-white/6 hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Your week, <span className="text-gradient">in one paragraph.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Review recorded activity or generate a summary using workspace AI credits. AI receives aggregate counts.
        </p>

        <div className="mt-5 flex items-center gap-1.5">
          {DAY_OPTS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              disabled={generating}
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                days === d
                  ? "bg-zinc-500/15 text-zinc-200 border-zinc-500/30"
                  : "bg-white/2 text-zinc-400 border-white/6 hover:text-white"
              }`}
            >
              Last {d} days
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/18 bg-white/4 p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {data?.seed.windowDays === days && (
        <>
          <div className="rounded-2xl border border-zinc-500/18 bg-zinc-500/4 p-5 mb-6 max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-300">Summary</p>
              <button type="button" onClick={() => load(days, true)} disabled={loading || generating}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-zinc-200 hover:text-white disabled:opacity-50">
                <SparklesIcon aria-hidden="true" className="h-3.5 w-3.5" />
                {generating ? "Generating…" : "Generate AI summary"}
              </button>
            </div>
            <p className="text-[14px] text-zinc-100 leading-relaxed">{data.narrative.paragraph}</p>
            <p role="status" className="mt-3 text-xs text-zinc-400">
              {summaryStatus[data.narrative.status]}
              {data.narrative.model && ` · ${data.narrative.model}`}
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
            <Card label="Council consensus records" value={data.seed.dissentCount} />
          </div>
        </>
      )}
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "rose" }) {
  const tones: Record<"emerald" | "rose" | "default", string> = {
    emerald: "text-emerald-300 border-emerald-500/30 bg-emerald-500/6",
    rose:    "text-rose-300 border-rose-500/30 bg-rose-500/6",
    default: "text-zinc-200 border-white/6 bg-white/2",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone ?? "default"]}`}>
      <p className="text-[10px] font-mono uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
