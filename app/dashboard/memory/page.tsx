"use client";

import { useState } from "react";
import {
  ClockIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  ArrowsRightLeftIcon,
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
            <ClockIcon className="h-4 w-4 text-violet-400" />
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest">
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

      {/* Memory health row */}
      <Stagger delay={0.05} interval={0.06} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Memory window",
            value: "90 days",
            sub: "Continuous since 2026-02-12",
            icon: ClockIcon,
            color: "text-violet-400",
            bg: "bg-violet-500/10 border-violet-500/20",
          },
          {
            label: "Events recorded",
            value: "1,847",
            sub: "+42 in last 24h",
            icon: CpuChipIcon,
            color: "text-violet-400",
            bg: "bg-violet-500/10 border-violet-500/20",
          },
          {
            label: "Lifetime savings",
            value: "$48,720",
            sub: "+$2,400 today",
            icon: CurrencyDollarIcon,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/20",
          },
          {
            label: "Outcome match rate",
            value: "94%",
            sub: "+2 pts this month",
            icon: ShieldCheckIcon,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/20",
          },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-8 h-8 rounded-lg ${m.bg} border flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${m.color}`} />
                </div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{m.label}</span>
              </div>
              <p className="text-2xl font-bold text-white tracking-tight mb-0.5">{m.value}</p>
              <p className="text-[10px] text-zinc-500">{m.sub}</p>
            </div>
          );
        })}
      </Stagger>

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
                    ? "bg-violet-500/15 border-violet-500/30 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
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
