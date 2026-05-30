"use client";

/**
 * Inline AWS connection health pill for the dashboard's connected
 * accounts list. Polls /api/connectors/aws/health on mount and shows
 * a quiet verdict:
 *   healthy   → emerald dot + 'healthy · 312ms'
 *   degraded  → rose dot + reason
 *   checking  → spinner + 'checking…'
 *
 * Refresh button re-probes. No auto-polling — the broker call is
 * non-trivial (full STS AssumeRole + GetCallerIdentity round-trip)
 * so we let the operator drive it explicitly.
 */

import { useEffect, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

interface Healthy { ok: true; healthy: true; accountId: string; arn: string | null; latencyMs: number; }
interface Unhealthy { ok: true; healthy: false; reason: string; hint?: string; }
type Result = Healthy | Unhealthy;

export function ConnectionHealth() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  async function probe() {
    setLoading(true);
    try {
      const res = await fetch("/api/connectors/aws/health", { cache: "no-store" });
      const data: Result = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        ok: true,
        healthy: false,
        reason: "network",
        hint: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void probe();
  }, []);

  return (
    <div className="flex items-center gap-2 px-6 py-3 border-t border-white/[0.04] bg-white/[0.005]">
      {loading && (
        <>
          <span className="w-3 h-3 rounded-full border-2 border-zinc-500 border-t-transparent animate-spin" />
          <span className="text-[11px] font-mono text-zinc-500">checking broker…</span>
        </>
      )}
      {!loading && result?.healthy && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-mono text-emerald-300">broker · healthy</span>
          <span className="text-[10px] font-mono text-zinc-600">{result.latencyMs}ms</span>
        </>
      )}
      {!loading && result && !result.healthy && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span className="text-[11px] font-mono text-rose-300">broker · {result.reason.replace(/_/g, " ")}</span>
        </>
      )}
      <button
        type="button"
        onClick={() => void probe()}
        disabled={loading}
        className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-200 disabled:opacity-50 transition-colors"
        aria-label="Re-probe"
      >
        <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        re-probe
      </button>
    </div>
  );
}
