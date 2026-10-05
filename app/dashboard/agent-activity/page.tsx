"use client";

/**
 * /dashboard/agent-activity — bus throughput + per-role calibration.
 *
 * One page, two panels:
 *   1. Activity (last N hours, configurable) — per-role send counts +
 *      per-kind histogram
 *   2. Calibration — per-(author,target) approval rate vs. confidence,
 *      with verdict chip (calibrated / over / under)
 */

import { useCallback, useEffect, useState } from "react";
import {
  ChartBarIcon,
  ArrowPathIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface ActivityRow {
  agent: string;
  sent: number;
  lastActiveAt: string | null;
  kindBreakdown: Record<string, number>;
}
interface KindRow { kind: string; count: number }
interface ActivityReport {
  windowHours: number;
  totalMessages: number;
  windowStart: string | null;
  windowEnd: string | null;
  agents: ActivityRow[];
  kinds: KindRow[];
}

interface CalibrationBucket {
  authorAgent: string;
  target: string;
  decided: number;
  approvedOrApplied: number;
  approvalRate: number;
  avgConfidence: number;
  calibrationGap: number;
  verdict: "calibrated" | "over_confident" | "under_confident";
}
interface CalibrationReport { totalConsidered: number; buckets: CalibrationBucket[] }

const VERDICT_TONE: Record<CalibrationBucket["verdict"], string> = {
  calibrated:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  over_confident:  "bg-rose-500/15 text-rose-300 border-rose-500/30",
  under_confident: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

export default function AgentActivityPage() {
  const [activity, setActivity] = useState<ActivityReport | null>(null);
  const [calibration, setCalibration] = useState<CalibrationReport | null>(null);
  const [windowHours, setWindowHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((hours: number) => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/agents/activity?windowHours=${hours}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/agents/calibration`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([a, c]: [{ ok?: boolean; data?: ActivityReport; error?: { userMessage?: string } }, { ok?: boolean; data?: CalibrationReport }]) => {
        if (a.ok && a.data) setActivity(a.data);
        else setError(a.error?.userMessage ?? "Activity unavailable.");
        if (c.ok && c.data) setCalibration(c.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(windowHours); }, [windowHours, load]);

  return (
    <div className="relative">
      <PageIntro
        kicker="AI workforce · agent activity"
        title={<>How busy are <span className="text-zinc-500">your agents?</span></>}
        description="Per-role throughput on the message bus, plus a calibration scorecard that compares each agent's self-declared confidence against the operator-decided approval rate."
        helps="See which agents are doing the most work, which ones over-state confidence, and where calibration is drifting."
        connectFirst="No setup needed. Activity populates the moment your first connector triggers an agent run."
        engineers={["All agent roles"]}
        requiresApproval="Read-only. Calibration is observational, not actionable."
        actions={[
          { label: "View agent registry", href: "/dashboard/agents" },
          { label: "Live bus", href: "/dashboard/agent-bus" },
        ]}
        safetyNote="Read-only metrics · Calibration is observational · Source data: AgentBusMessage rows"
      />

      <div className="mb-6 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Window:</span>
        {[1, 6, 24, 168, 720].map((h) => (
          <button
            key={h}
            onClick={() => setWindowHours(h)}
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
              windowHours === h
                ? "text-white border-white/[0.18]"
                : "text-zinc-500 border-white/[0.06] hover:text-white hover:border-white/[0.12]"
            }`}
          >
            {h < 24 ? `${h}h` : h === 24 ? "24h" : h === 168 ? "7d" : "30d"}
          </button>
        ))}
        <button
          onClick={() => load(windowHours)}
          disabled={loading}
          className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">By role · sent in window</h2>
          {activity && activity.agents.length > 0 ? (
            <div className="space-y-1.5">
              {activity.agents.map((a) => (
                <div key={a.agent} className="flex items-center gap-2 text-[12px]">
                  <span className="font-mono text-zinc-200 w-28 truncate">{a.agent}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full bg-white/30"
                      style={{ width: `${Math.min(100, (a.sent / Math.max(1, activity.totalMessages || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-zinc-400 w-10 text-right tabular-nums">{a.sent}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-zinc-500">No activity in this window.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">By message kind</h2>
          {activity && activity.kinds.length > 0 ? (
            <div className="space-y-1.5">
              {activity.kinds.map((k) => (
                <div key={k.kind} className="flex items-center gap-2 text-[12px]">
                  <span className="font-mono text-zinc-300 w-36 truncate">{k.kind}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full bg-white/20"
                      style={{ width: `${Math.min(100, (k.count / Math.max(1, activity.totalMessages || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-zinc-400 w-10 text-right tabular-nums">{k.count}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <ScaleIcon className="h-3.5 w-3.5 text-zinc-500" />
          <h2 className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Calibration · {calibration?.totalConsidered ?? 0} decided proposals
          </h2>
        </div>
        {calibration && calibration.buckets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left font-mono uppercase tracking-wider text-[9px] text-zinc-500">
                  <th className="py-1.5">Agent</th>
                  <th className="py-1.5">Target</th>
                  <th className="py-1.5 text-right tabular-nums">Decided</th>
                  <th className="py-1.5 text-right tabular-nums">Approval</th>
                  <th className="py-1.5 text-right tabular-nums">Confidence</th>
                  <th className="py-1.5 text-right tabular-nums">Gap</th>
                  <th className="py-1.5">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {calibration.buckets.map((b) => (
                  <tr key={`${b.authorAgent}/${b.target}`} className="border-t border-white/[0.04]">
                    <td className="py-1.5 font-mono text-zinc-200">{b.authorAgent}</td>
                    <td className="py-1.5 font-mono text-zinc-400">{b.target}</td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-300">{b.decided}</td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-300">{(b.approvalRate * 100).toFixed(0)}%</td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-300">{(b.avgConfidence * 100).toFixed(0)}%</td>
                    <td className="py-1.5 text-right tabular-nums text-zinc-400">{b.calibrationGap > 0 ? "+" : ""}{(b.calibrationGap * 100).toFixed(0)}%</td>
                    <td className="py-1.5">
                      <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${VERDICT_TONE[b.verdict]}`}>
                        {b.verdict.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[12px] text-zinc-500">No decided proposals yet — calibration kicks in once operators approve / reject a few.</p>
        )}
      </div>
    </div>
  );
}
