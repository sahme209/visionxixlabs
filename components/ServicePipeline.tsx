"use client";

import { useState } from "react";

const PHASES = [
  {
    phase: "Observe",
    steps: [
      { num: 1, name: "Connect", desc: "Assume-role into your cloud account" },
      { num: 2, name: "Snapshot", desc: "Full infrastructure state capture" },
      { num: 3, name: "Drift", desc: "Detect changes since last scan" },
    ],
    accent: "violet",
  },
  {
    phase: "Reason",
    steps: [
      { num: 4, name: "Analyze", desc: "Cost, security, and config findings" },
      { num: 5, name: "Prioritize", desc: "Risk-weighted severity scoring" },
      { num: 6, name: "Plan", desc: "Phased execution with dependencies" },
    ],
    accent: "fuchsia",
  },
  {
    phase: "Act",
    steps: [
      { num: 7, name: "Approve", desc: "Human gate for high-risk changes" },
      { num: 8, name: "Execute", desc: "Terraform apply with rollback ready" },
      { num: 9, name: "Verify", desc: "Post-apply validation checks" },
    ],
    accent: "emerald",
  },
  {
    phase: "Learn",
    steps: [
      { num: 10, name: "Audit", desc: "Immutable action trail" },
      { num: 11, name: "Outcome", desc: "Success/failure memory per resource" },
      { num: 12, name: "Schedule", desc: "Continuous autonomous loop" },
    ],
    accent: "amber",
  },
];

const ACCENT_COLORS: Record<string, { dot: string; border: string; bg: string; text: string; num: string }> = {
  violet: {
    dot: "bg-violet-500",
    border: "border-violet-500/20",
    bg: "bg-violet-500/[0.06]",
    text: "text-violet-400",
    num: "bg-violet-500/10 text-violet-400",
  },
  fuchsia: {
    dot: "bg-fuchsia-500",
    border: "border-fuchsia-500/20",
    bg: "bg-fuchsia-500/[0.06]",
    text: "text-fuchsia-400",
    num: "bg-fuchsia-500/10 text-fuchsia-400",
  },
  emerald: {
    dot: "bg-emerald-500",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/[0.06]",
    text: "text-emerald-400",
    num: "bg-emerald-500/10 text-emerald-400",
  },
  amber: {
    dot: "bg-amber-500",
    border: "border-amber-500/20",
    bg: "bg-amber-500/[0.06]",
    text: "text-amber-400",
    num: "bg-amber-500/10 text-amber-400",
  },
};

export function ServicePipeline() {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  return (
    <div className="relative">
      <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 z-0">
        <div className="pipeline-glow h-full rounded-full opacity-30" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        {PHASES.map((phase, pi) => {
          const colors = ACCENT_COLORS[phase.accent];
          const isExpanded = expandedPhase === pi;

          return (
            <button
              key={phase.phase}
              onClick={() => setExpandedPhase(isExpanded ? null : pi)}
              className={`card-hover text-left rounded-xl border p-5 transition-all duration-300 ${
                isExpanded
                  ? `${colors.border} ${colors.bg} shadow-lg shadow-black/20`
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                  {phase.phase}
                </span>
              </div>
              <div className="space-y-2.5">
                {phase.steps.map((step) => (
                  <div key={step.num} className="flex items-start gap-2.5">
                    <span className={`icon-bounce shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${colors.num}`}>
                      {step.num}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight">
                        {step.name}
                      </div>
                      {isExpanded && (
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {step.desc}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-3 mt-5">
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <span className="w-1 h-1 rounded-full bg-zinc-700" />
          Click a phase to expand
        </div>
        <div className="w-px h-3 bg-white/[0.06]" />
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          12-step autonomous loop
        </div>
      </div>
    </div>
  );
}
