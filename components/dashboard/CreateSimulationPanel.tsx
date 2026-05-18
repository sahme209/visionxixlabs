"use client";

/**
 * CreateSimulationPanel — clickable Simulation Engine trigger.
 *
 * POSTs /api/simulations/create (zero-body). Returns the canonical
 * simulation outcome:
 *   - generatedAt + twinId
 *   - summary (total / simulated / preview_only / blocked / unsafe /
 *     incomplete)
 *   - results[]
 *
 * Read-only. The simulator mutates an in-memory digital twin, never
 * the real cloud — by design.
 */

import { useState } from "react";
import Link from "next/link";
import {
  PlayCircleIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

interface SimulationResultLite {
  id?: string;
  candidateId?: string;
  status?: string;
  ruleCode?: string;
  beforeRiskScore?: number;
  afterRiskScore?: number;
}

interface SimulationOutcomeLite {
  generatedAt?: string;
  twinId?: string;
  results?: SimulationResultLite[];
  summary?: {
    total?: number;
    simulated?: number;
    preview_only?: number;
    blocked?: number;
    unsafe?: number;
    incomplete?: number;
  };
}

type Phase = "idle" | "running" | "done" | "error";

export function CreateSimulationPanel() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<SimulationOutcomeLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const runSim = async () => {
    setPhase("running");
    setError(null);
    setStartedAt(Date.now());
    try {
      const res = await fetch("/api/simulations/create", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { ok?: boolean; data?: SimulationOutcomeLite; error?: { userMessage?: string } };
      if (json.ok && json.data) {
        setResult(json.data);
        setPhase("done");
      } else {
        setError(json.error?.userMessage ?? `Simulation failed (HTTP ${res.status}).`);
        setPhase("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      setPhase("error");
    }
  };

  const summary = result?.summary;
  const results = result?.results ?? [];

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">// run the in-memory digital-twin simulator</p>
          <h3 className="text-base font-semibold text-white tracking-tight">Simulate remediation candidates</h3>
          <p className="text-[12px] text-zinc-400 leading-relaxed mt-0.5">
            Builds a digital twin, applies each candidate to the twin only, and reports before/after risk deltas. <span className="text-zinc-500">No real cloud touched.</span>
          </p>
        </div>
        <button
          type="button"
          onClick={runSim}
          disabled={phase === "running"}
          className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-all ${
            phase === "running"
              ? "border-white/[0.08] bg-white/[0.02] text-zinc-400 cursor-wait"
              : "border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200 hover:border-emerald-500/50 hover:bg-emerald-500/[0.15]"
          }`}
        >
          {phase === "running" ? (
            <>
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Simulating…
            </>
          ) : phase === "done" || phase === "error" ? (
            <>
              <ArrowPathIcon className="h-4 w-4" />
              Run again
            </>
          ) : (
            <>
              <PlayCircleIcon className="h-4 w-4" />
              Create simulation
            </>
          )}
        </button>
      </div>

      {phase === "idle" && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[11px] text-zinc-500 leading-relaxed font-mono">
            POST /api/simulations/create · runs remediation pipeline + builds digital twin + applies each candidate
          </p>
        </div>
      )}

      {phase === "running" && (
        <div className="rounded-lg border border-cyan-500/[0.22] bg-cyan-500/[0.04] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <p className="text-[12px] text-cyan-200 font-mono">
              Building digital twin · applying candidates in-memory · scoring before/after deltas
            </p>
          </div>
          {startedAt && (
            <p className="text-[10px] text-zinc-500 font-mono mt-1.5">
              elapsed {((Date.now() - startedAt) / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="rounded-lg border border-rose-500/[0.22] bg-rose-500/[0.04] px-3 py-3">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-rose-300 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-mono text-rose-300/80 uppercase tracking-wider mb-1">// simulation failed</p>
              <p className="text-[12px] text-zinc-300 leading-relaxed">{error}</p>
            </div>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div className="rounded-lg border border-emerald-500/[0.18] bg-emerald-500/[0.04] p-4">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <BeakerIcon className="h-4 w-4 text-emerald-300" />
            <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-widest">
              {summary?.total ?? 0} candidate{(summary?.total ?? 0) === 1 ? "" : "s"} processed
            </span>
            {result.twinId && (
              <span className="text-[10px] font-mono text-zinc-500">twin {result.twinId.slice(0, 12)}{result.twinId.length > 12 ? "…" : ""}</span>
            )}
            {result.generatedAt && (
              <span className="text-[10px] font-mono text-zinc-500 ml-auto">generated {new Date(result.generatedAt).toLocaleTimeString()}</span>
            )}
          </div>

          {(summary?.total ?? 0) === 0 ? (
            <div className="rounded-md border border-amber-500/[0.18] bg-amber-500/[0.04] p-3">
              <p className="text-[12px] text-amber-200 leading-relaxed">
                No remediation candidates to simulate. Run the Remediation Pipeline first to produce candidates.
              </p>
            </div>
          ) : (
            <>
              {/* Status breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                <ResultStat label="Simulated" value={String(summary?.simulated ?? 0)} tone="text-emerald-300" />
                <ResultStat label="Preview" value={String(summary?.preview_only ?? 0)} tone="text-cyan-300" />
                <ResultStat label="Blocked" value={String(summary?.blocked ?? 0)} tone={(summary?.blocked ?? 0) > 0 ? "text-amber-300" : "text-zinc-400"} />
                <ResultStat label="Unsafe" value={String(summary?.unsafe ?? 0)} tone={(summary?.unsafe ?? 0) > 0 ? "text-rose-300" : "text-zinc-400"} />
                <ResultStat label="Incomplete" value={String(summary?.incomplete ?? 0)} tone="text-zinc-300" />
              </div>

              {/* Top results */}
              {results.length > 0 && (
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">// top simulations</p>
                  <ul className="space-y-1.5">
                    {results.slice(0, 3).map((r, i) => {
                      const delta = (r.afterRiskScore !== undefined && r.beforeRiskScore !== undefined)
                        ? r.beforeRiskScore - r.afterRiskScore
                        : null;
                      return (
                        <li key={r.id ?? i} className="flex items-start gap-2 text-[11.5px]">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                            r.status === "simulated"    ? "bg-emerald-400" :
                            r.status === "preview_only" ? "bg-cyan-400"    :
                            r.status === "blocked"      ? "bg-amber-400"   :
                            r.status === "unsafe"       ? "bg-rose-400"    :
                                                          "bg-zinc-500"
                          }`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-zinc-200 font-mono truncate">{r.ruleCode ?? r.candidateId ?? "candidate"}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">status: {r.status?.replace(/_/g, " ") ?? "—"}</p>
                          </div>
                          {delta !== null && (
                            <span className={`text-[10px] font-mono shrink-0 ${delta > 0 ? "text-emerald-300" : delta < 0 ? "text-rose-300" : "text-zinc-400"}`}>
                              Δ {delta > 0 ? "−" : delta < 0 ? "+" : "±"}{Math.abs(delta).toFixed(1)}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {(summary?.simulated ?? 0) > 0 && (
                <div className="rounded-md border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-3 mt-3 flex items-center gap-2">
                  <CheckCircleIcon className="h-4 w-4 text-emerald-300 shrink-0" />
                  <p className="text-[12px] text-emerald-100">
                    {summary?.simulated} candidate{(summary?.simulated ?? 0) === 1 ? " was" : "s were"} successfully simulated against the twin.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Next step */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">Next safe step</p>
            <Link
              href="/dashboard/approvals"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors"
            >
              Request approval
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-lg font-bold tracking-tight leading-none ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}
