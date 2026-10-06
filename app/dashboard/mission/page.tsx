"use client";

/**
 * /dashboard/mission — single-screen Mission Control.
 *
 * Auto-refreshes every 8 seconds. Pulls the dashboard summary, the
 * recent activity feed, the broker health probe, and the last 8
 * scans into one always-fresh panel. No navigation, no scrolling
 * needed — designed for a wall display.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { Sparkline } from "../Sparkline";

interface Summary {
  findingCount: number;
  pendingApprovals: number;
  highRiskApprovals: number;
  monthlyHigh: number;
  lastScanIso: string | null;
  findingsTrend7d: number[];
  scansTrend7d: number[];
}

interface ActivityEntry {
  id: string;
  action: string;
  outcome: string;
  occurredAt: string;
  entityRef: string | null;
}

interface BrokerHealth {
  healthy: boolean;
  accountId?: string;
  latencyMs?: number;
  reason?: string;
}

function tsAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function MissionPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [broker, setBroker] = useState<BrokerHealth | null>(null);
  const [tick, setTick] = useState(0);

  async function refresh() {
    try {
      const [s, a, b] = await Promise.all([
        fetch("/api/dashboard/summary", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/dashboard/activity", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/connectors/aws/health", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (s?.ok) setSummary(s as Summary);
      if (a?.ok && Array.isArray(a.entries)) setActivity(a.entries as ActivityEntry[]);
      if (b?.ok) {
        setBroker({
          healthy: b.healthy,
          accountId: b.accountId,
          latencyMs: b.latencyMs,
          reason: b.reason,
        });
      }
    } catch {
      // Silent — keep last state.
    }
  }

  useEffect(() => {
    void refresh();
    const i = setInterval(() => { setTick((t) => t + 1); void refresh(); }, 8000);
    return () => clearInterval(i);
  }, []);

  const findings = summary?.findingCount ?? 0;
  const pending = summary?.pendingApprovals ?? 0;
  const highRisk = summary?.highRiskApprovals ?? 0;
  const savings = summary?.monthlyHigh ?? 0;
  const lastScan = summary?.lastScanIso ?? null;

  return (
    <div className="max-w-[1600px] mx-auto px-1 -mt-2">
      <header className="mb-8 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-2">mission control</p>
          <h1 className="text-[28px] sm:text-[36px] leading-[1.05] font-semibold text-white tracking-[-0.03em]">
            Everything, on one screen.
          </h1>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          live · ticks every 8s
          <button onClick={() => void refresh()} className="ml-2 inline-flex items-center gap-1 hover:text-white transition-colors">
            <ArrowPathIcon className="h-3 w-3" />
            refresh
          </button>
          <span className="text-zinc-700">· tick #{tick}</span>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Top-left: severity stats */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 lg:col-span-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-4">current state</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5">
            <MissionMetric label="findings" value={findings.toString()} spark={summary?.findingsTrend7d} sparkTone="text-zinc-400" />
            <MissionMetric label="pending"  value={pending.toString()} tone={highRisk > 0 ? "text-zinc-300" : "text-white"} />
            <MissionMetric label="$/mo"     value={savings > 0 ? `$${Math.round(savings).toLocaleString()}` : "—"} />
            <MissionMetric label="last scan" value={tsAgo(lastScan)} spark={summary?.scansTrend7d} sparkTone="text-emerald-400/70" />
          </div>
        </div>

        {/* Top-right: broker status */}
        <div className={`rounded-2xl border bg-white/[0.015] p-6 ${
          broker?.healthy ? "border-emerald-500/20" : broker == null ? "border-white/[0.06]" : "border-rose-500/20"
        }`}>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-4">aws broker</p>
          <div className="flex items-center gap-3 mb-3">
            <span className={`w-2.5 h-2.5 rounded-full ${
              broker?.healthy ? "bg-emerald-400 animate-pulse" : broker == null ? "bg-zinc-500" : "bg-rose-400"
            }`} />
            <span className={`text-[16px] font-semibold ${
              broker?.healthy ? "text-emerald-300" : broker == null ? "text-zinc-400" : "text-rose-300"
            }`}>
              {broker == null ? "probing…" : broker.healthy ? "healthy" : (broker.reason ?? "unhealthy").replace(/_/g, " ")}
            </span>
          </div>
          {broker?.accountId && (
            <p className="text-[11px] font-mono text-zinc-500">account {broker.accountId}</p>
          )}
          {typeof broker?.latencyMs === "number" && (
            <p className="text-[11px] font-mono text-zinc-500">{broker.latencyMs}ms round-trip</p>
          )}
        </div>
      </div>

      {/* Bottom: activity stream */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
        <div className="flex items-baseline justify-between mb-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">activity stream</p>
          <Link href="/dashboard/audit" className="text-[11px] text-zinc-500 hover:text-white transition-colors">
            Full audit →
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="text-[12px] text-zinc-500">No activity to display.</p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {activity.map((e) => {
              const tone = e.outcome === "success" ? "text-emerald-300"
                         : e.outcome === "failure" ? "text-rose-300"
                         : e.outcome === "blocked" ? "text-zinc-300"
                         : "text-zinc-400";
              return (
                <li key={e.id} className="py-2.5 flex items-center gap-3">
                  <span className={`text-[10px] font-mono uppercase tracking-wider ${tone} w-14 shrink-0`}>
                    {e.outcome}
                  </span>
                  <span className="text-[12px] font-mono text-zinc-300 truncate flex-1 min-w-0">
                    {e.action}
                    {e.entityRef && <span className="text-zinc-600"> · {e.entityRef}</span>}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-600 shrink-0">{tsAgo(e.occurredAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function MissionMetric({
  label,
  value,
  tone,
  spark,
  sparkTone,
}: {
  label: string;
  value: string;
  tone?: string;
  spark?: number[];
  sparkTone?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className={`text-[28px] font-semibold tabular-nums tracking-[-0.02em] ${tone ?? "text-white"}`}>{value}</p>
        {spark && spark.length > 0 && <Sparkline values={spark} tone={sparkTone ?? "text-zinc-500"} width={48} height={18} />}
      </div>
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">{label}</p>
    </div>
  );
}
