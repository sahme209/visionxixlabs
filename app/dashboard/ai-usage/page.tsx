"use client";

/**
 * /dashboard/ai-usage — per-provider + per-task usage analytics.
 *
 * Reads from /api/ai/usage. The underlying logger NEVER stores prompts
 * or secrets, so everything shown here is safe.
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowPathIcon, ChartBarIcon } from "@heroicons/react/24/outline";

type ProviderName =
  | "github_models" | "ollama" | "lm_studio" | "groq" | "hugging_face"
  | "openrouter" | "gemini" | "cloudflare" | "mock";
type TaskKind =
  | "generate_text" | "stream_text" | "summarize" | "classify"
  | "extract_structured_data" | "health_check";

interface ProviderRow { provider: ProviderName; count: number; errors: number; avgLatencyMs: number }
interface TaskRow { task: TaskKind; count: number; errors: number }
interface UsageEvent {
  ts: string; provider: ProviderName; model: string; task: TaskKind;
  latencyMs: number; status: "ok" | "error"; errorKind?: string; correlationId?: string;
}
interface UsageResp {
  summary: { totalEvents: number; byProvider: ProviderRow[]; byTask: TaskRow[] };
  tail: UsageEvent[];
}

export default function AIUsagePage() {
  const [data, setData] = useState<UsageResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    fetch("/api/ai/usage?tail=100", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: UsageResp; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setData(j.data);
        else setError(j.error?.userMessage ?? "Usage unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ChartBarIcon className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              AI Usage · no_prompts_no_keys_logged
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
          AI usage. <span className="text-gradient">Safe to share.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Per-provider + per-task counts, error rates, and latency. The logger never stores prompts, API keys,
          or response bodies — so this dashboard is safe to send to anyone in the org.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">
                By provider · {data.summary.totalEvents} events
              </h2>
              {data.summary.byProvider.length > 0 ? (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left font-mono uppercase tracking-wider text-[9px] text-zinc-500">
                      <th className="py-1.5">Provider</th>
                      <th className="py-1.5 text-right tabular-nums">Calls</th>
                      <th className="py-1.5 text-right tabular-nums">Errors</th>
                      <th className="py-1.5 text-right tabular-nums">Avg latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.byProvider.map((p) => (
                      <tr key={p.provider} className="border-t border-white/[0.04]">
                        <td className="py-1.5 font-mono text-indigo-300">{p.provider}</td>
                        <td className="py-1.5 text-right tabular-nums text-zinc-300">{p.count}</td>
                        <td className="py-1.5 text-right tabular-nums text-zinc-300">{p.errors}</td>
                        <td className="py-1.5 text-right tabular-nums text-zinc-300">{p.avgLatencyMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-[12px] text-zinc-500">No usage recorded yet.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">By task kind</h2>
              {data.summary.byTask.length > 0 ? (
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left font-mono uppercase tracking-wider text-[9px] text-zinc-500">
                      <th className="py-1.5">Task</th>
                      <th className="py-1.5 text-right tabular-nums">Calls</th>
                      <th className="py-1.5 text-right tabular-nums">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.byTask.map((t) => (
                      <tr key={t.task} className="border-t border-white/[0.04]">
                        <td className="py-1.5 font-mono text-zinc-300">{t.task}</td>
                        <td className="py-1.5 text-right tabular-nums text-zinc-300">{t.count}</td>
                        <td className="py-1.5 text-right tabular-nums text-zinc-300">{t.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
            <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">
              Recent events · last {data.tail.length}
            </h2>
            {data.tail.length === 0 ? (
              <p className="text-[12px] text-zinc-500">No recorded events. Trigger a call from /dashboard/ai-settings to see one here.</p>
            ) : (
              <div className="space-y-1.5 text-[11px] font-mono">
                {data.tail.map((e, i) => (
                  <div key={`${e.ts}-${i}`} className="flex items-center gap-2">
                    <span className="text-zinc-500 w-40 truncate">{new Date(e.ts).toLocaleTimeString()}</span>
                    <span className="text-indigo-300 w-28 truncate">{e.provider}</span>
                    <span className="text-zinc-400 w-40 truncate">{e.model}</span>
                    <span className="text-zinc-400 w-32 truncate">{e.task}</span>
                    <span className="text-zinc-500 w-16 tabular-nums">{e.latencyMs}ms</span>
                    <span className={e.status === "ok" ? "text-emerald-300" : "text-rose-300"}>{e.status}</span>
                    {e.errorKind && <span className="text-rose-300">{e.errorKind}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
