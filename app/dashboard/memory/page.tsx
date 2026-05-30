"use client";

import { useEffect, useState } from "react";
import {
  ClockIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  ArrowsRightLeftIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { MemoryTimeline } from "@/components/operations/MemoryTimeline";

type Filter = "all" | "scans" | "plans" | "drift" | "approvals";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "scans", label: "Scans" },
  { id: "plans", label: "Execution plans" },
  { id: "drift", label: "Drift" },
  { id: "approvals", label: "Approvals" },
];

export default function MemoryPage() {
  const [filter, setFilter] = useState<Filter>("all");

  return (
    <div className="relative">
      {/* Hero */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <ClockIcon className="h-4 w-4 text-zinc-500" />
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
              Continuous operational memory
            </p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Memory <span className="text-gradient">Timeline.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-2xl leading-relaxed">
            Every scan, recommendation, approval, and execution Axiom has performed. <span className="dim-1">The agent remembers outcomes and uses them to recalibrate confidence over time.</span>
          </p>
        </div>
      </Reveal>

      {/* Memory health row — honest canonical values from /api/axiom-os/state */}
      <MemoryHealthRow />

      {/* Filter row */}
      <Reveal direction="up" delay={0.1}>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-2">Filter:</span>
          {FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isActive
                    ? "bg-violet-500/15 border-white/[0.12] text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
          <span className="ml-auto text-[10px] text-zinc-600 font-mono uppercase tracking-wider inline-flex items-center gap-1.5">
            <ArrowsRightLeftIcon className="h-3 w-3" />
            Auditable · immutable
          </span>
        </div>
      </Reveal>

      {/* Timeline */}
      <Reveal direction="up" delay={0.14}>
        <MemoryTimeline />
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemoryHealthRow — honest canonical memory/audit/evidence rollup from
// /api/axiom-os/state. Replaces a static row that fabricated "1,847 events
// / +42 in last 24h", "$48,720 lifetime savings / +$2,400 today", and
// "94% outcome match rate / +2 pts this month" — none of which the
// platform can compute today.
// ---------------------------------------------------------------------------

interface AxiomOSStateLite {
  sourceMode: string;
  auditPosture: { sourceMode: string; data: { recentEventCount: number; persistent: boolean }; limitations: string[] };
  memoryPosture: { sourceMode: string; data: { recordCount: number; persistent: boolean }; limitations: string[] };
  evidencePosture: { sourceMode: string; data: { totalRecords: number; verifiedRecords: number; coverageScore: number }; limitations: string[] };
}

function MemoryHealthRow() {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const audit = state?.auditPosture;
  const memory = state?.memoryPosture;
  const evidence = state?.evidencePosture;

  const tiles = [
    {
      label: "Audit events",
      value: state ? String(audit?.data.recentEventCount ?? 0) : (loading ? "…" : "—"),
      sub: state ? (audit?.data.persistent ? "Persistent · DATABASE_URL set" : "In-memory · enable persistence") : undefined,
      icon: ClockIcon,
      color: "text-violet-300",
      bg: "bg-violet-500/10 border-white/[0.08]",
    },
    {
      label: "Memory records",
      value: state ? String(memory?.data.recordCount ?? 0) : (loading ? "…" : "—"),
      sub: state ? (memory?.data.persistent ? "Persistent" : "In-memory") : undefined,
      icon: CpuChipIcon,
      color: "text-violet-300",
      bg: "bg-violet-500/10 border-white/[0.08]",
    },
    {
      label: "Evidence records",
      value: state ? String(evidence?.data.totalRecords ?? 0) : (loading ? "…" : "—"),
      sub: state && evidence ? `${evidence.data.verifiedRecords} verified · coverage ${Math.round(evidence.data.coverageScore * 100)}%` : undefined,
      icon: ShieldCheckIcon,
      color: "text-emerald-300",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Source mode",
      value: state?.sourceMode?.replace(/_/g, " ") ?? (loading ? "…" : "—"),
      sub: "From /api/axiom-os/state",
      icon: ServerStackIcon,
      color: "text-cyan-300",
      bg: "bg-cyan-500/10 border-cyan-500/20",
    },
  ];

  return (
    <Stagger delay={0.05} interval={0.06} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {tiles.map((m) => {
        const Icon = m.icon;
        return (
          <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-colors">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-8 h-8 rounded-lg ${m.bg} border flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{m.label}</span>
            </div>
            <p className="text-2xl font-bold text-white tracking-tight mb-0.5 capitalize">{m.value}</p>
            {m.sub && <p className="text-[10px] text-zinc-500">{m.sub}</p>}
          </div>
        );
      })}
    </Stagger>
  );
}

