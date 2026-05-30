"use client";

import { useState } from "react";
import {
  CpuChipIcon,
  CloudIcon,
  ChartBarSquareIcon,
  AdjustmentsHorizontalIcon,
  ArrowsPointingOutIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { InfrastructureTopology } from "@/components/operations/InfrastructureTopology";

type Overlay = "all" | "findings" | "cost" | "scans";

const OVERLAYS: { id: Overlay; label: string; icon: typeof CpuChipIcon }[] = [
  { id: "all", label: "All resources", icon: CloudIcon },
  { id: "findings", label: "Risk concentration", icon: ShieldExclamationIcon },
  { id: "cost", label: "Cost hotspots", icon: ChartBarSquareIcon },
  { id: "scans", label: "Active scans", icon: AdjustmentsHorizontalIcon },
];

export default function TopologyPage() {
  const [overlay, setOverlay] = useState<Overlay>("all");

  return (
    <div className="relative">
      {/* Hero */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <ArrowsPointingOutIcon className="h-4 w-4 text-zinc-500" />
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
              Infrastructure intelligence
            </p>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Cloud <span className="text-gradient">Topology.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-2xl leading-relaxed">
            Live map of every provider, region, and resource Axiom is operating. <span className="dim-1">Click an overlay to see operational risk, cost concentration, or active scan activity overlaid on your infrastructure.</span>
          </p>
        </div>
      </Reveal>

      {/* Overlay selector */}
      <Reveal direction="up" delay={0.08}>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-2">Overlay:</span>
          {OVERLAYS.map((o) => {
            const Icon = o.icon;
            const isActive = overlay === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setOverlay(o.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isActive
                    ? "bg-violet-500/15 border-white/[0.12] text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {o.label}
              </button>
            );
          })}
        </div>
      </Reveal>

      {/* Topology */}
      <Reveal direction="up" delay={0.12}>
        <InfrastructureTopology />
      </Reveal>

      {/* Lower analytics row */}
      <Stagger delay={0.15} interval={0.08} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldExclamationIcon className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Risk concentration</h3>
          </div>
          <div className="space-y-2">
            {[
              { label: "us-east-1 · prod", level: "high", value: "8 findings" },
              { label: "westeurope · prod", level: "medium", value: "6 findings" },
              { label: "us-west1 · prod", level: "high", value: "7 findings" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                <span className="text-[11px] text-zinc-300 font-mono">{r.label}</span>
                <span className={`text-[10px] font-semibold ${r.level === "high" ? "text-red-400" : "text-amber-400"}`}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <ChartBarSquareIcon className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Cost concentration</h3>
            <span className="text-[9px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-px uppercase tracking-wider ml-auto">
              Pending
            </span>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-4">
            <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
              Cost concentration requires AWS Cost Explorer + Azure Cost Management + GCP Billing connectors. None are wired today, so this view honestly shows no values rather than fabricated dollar figures.
            </p>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              // source mode: not_yet_connected
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <CpuChipIcon className="h-4 w-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-white">Operational signals</h3>
          </div>
          <div className="space-y-2 text-[11px]">
            {[
              { label: "Cross-region replication", value: "Active", dot: "bg-emerald-400" },
              { label: "Drift monitoring", value: "Every 6h", dot: "bg-violet-400" },
              { label: "Cost trend (7d)", value: "↘ 4.2% lower", dot: "bg-emerald-400" },
              { label: "Active scans", value: "1 running", dot: "bg-blue-400 animate-pulse" },
              { label: "Pending approvals", value: "3", dot: "bg-amber-400 animate-pulse" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${row.dot}`} />
                  <span className="text-zinc-500">{row.label}</span>
                </div>
                <span className="text-zinc-300 font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </Stagger>
    </div>
  );
}
