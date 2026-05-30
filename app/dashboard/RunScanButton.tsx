"use client";

/**
 * RunScanButton — the dashboard's one-click 'Run scan now' control.
 *
 * Posts to /api/scan/trigger, shows a quiet inline spinner while the
 * broker AssumeRoles + reads, then a one-line result ('Found 14
 * findings · 23s'). On success it refreshes the page so the
 * Connected accounts + Findings counts reflect the new scan.
 *
 * Keeps the calm-rule: zinc by default, emerald on success, rose on
 * error. No celebratory gradient.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ScanTriggerResult {
  ok: boolean;
  findingCount?: number;
  resourceCount?: number;
  durationMs?: number;
  error?: string;
  hint?: string;
}

export function RunScanButton({
  label = "Run scan now",
  multiRegion = false,
  className,
  onComplete,
}: {
  label?: string;
  /** When true, sweeps multiple regions instead of just the connector's home region. */
  multiRegion?: boolean;
  className?: string;
  /** Called after a successful scan. Use for client-side data refetch
   *  on pages whose data lives in useEffect and won't pick up
   *  router.refresh() automatically. */
  onComplete?: (result: ScanTriggerResult) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<ScanTriggerResult | null>(null);

  async function run() {
    setPhase("running");
    setResult(null);
    try {
      const res = await fetch("/api/scan/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ multiRegion }),
      });
      const data: ScanTriggerResult = await res.json();
      setResult(data);
      setPhase(data.ok ? "done" : "error");
      if (data.ok) {
        // Refresh the parent server component so server-rendered
        // counts (e.g. /dashboard/findings, /dashboard/scans)
        // update on the next render.
        router.refresh();
        // Let client-side parents refetch their own state (e.g.
        // /dashboard's stats row, which fetches /api/dashboard/summary
        // in useEffect and won't re-fire on router.refresh).
        onComplete?.(data);
      }
    } catch (err) {
      setPhase("error");
      setResult({ ok: false, error: "network", hint: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
      <button
        type="button"
        onClick={run}
        disabled={phase === "running"}
        className="inline-flex items-center gap-2 rounded-full bg-white text-zinc-950 px-5 py-2.5 text-[13px] font-medium hover:bg-zinc-100 disabled:opacity-60 disabled:cursor-wait transition-colors"
      >
        {phase === "running" && (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-700 border-t-transparent animate-spin" />
        )}
        {phase === "running" ? "Scanning…" : label}
      </button>
      {phase === "done" && result?.ok && (
        <span className="text-[12px] text-emerald-300">
          {result.findingCount} finding{result.findingCount === 1 ? "" : "s"} · {result.resourceCount} resource{result.resourceCount === 1 ? "" : "s"}
          {typeof result.durationMs === "number" && ` · ${Math.round(result.durationMs / 100) / 10}s`}
        </span>
      )}
      {phase === "error" && result && (
        <span className="text-[12px] text-rose-300">
          {result.hint ?? result.error ?? "Scan failed."}
        </span>
      )}
    </div>
  );
}
