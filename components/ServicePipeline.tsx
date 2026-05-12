"use client";

import { useState } from "react";

const PHASES = [
  {
    phase: "Observe",
    steps: [
      { num: 1, name: "Connect", desc: "Role-based access, zero stored credentials — revoke anytime" },
      { num: 2, name: "Snapshot", desc: "Full state capture — resources, cost tags, IAM policies, security groups" },
      { num: 3, name: "Drift", desc: "Flag untracked changes — manual edits, out-of-band deployments" },
    ],
    accent: "violet",
  },
  {
    phase: "Reason",
    steps: [
      { num: 4, name: "Analyze", desc: "Quantify findings — $X waste here, compliance gap there" },
      { num: 5, name: "Prioritize", desc: "Rank by blast radius, cost impact, and compliance urgency" },
      { num: 6, name: "Plan", desc: "Auto-detect resource dependencies, stage rollout with approval gates" },
    ],
    accent: "fuchsia",
  },
  {
    phase: "Act",
    steps: [
      { num: 7, name: "Approve", desc: "Human gate for cost, network, IAM, and past-failure changes" },
      { num: 8, name: "Execute", desc: "Terraform apply with pre-verified rollback — validated before execution" },
      { num: 9, name: "Verify", desc: "State matches expected, costs match budget, no drift introduced" },
    ],
    accent: "emerald",
  },
  {
    phase: "Learn",
    steps: [
      { num: 10, name: "Audit", desc: "What changed, who approved, cost impact, rollback status — immutable" },
      { num: 11, name: "Outcome", desc: "Prior failures flag resources for manual approval on retry" },
      { num: 12, name: "Schedule", desc: "Run the loop hourly or daily — cost optimization and compliance 24/7" },
    ],
    accent: "amber",
  },
];

const ACCENT_COLORS: Record<string, { dot: string; border: string; bg: string; text: string; num: string; dotColor: string }> = {
  violet: {
    dot: "bg-violet-500",
    border: "border-violet-500/20",
    bg: "bg-violet-500/[0.06]",
    text: "text-violet-400",
    num: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    dotColor: "text-violet-500",
  },
  fuchsia: {
    dot: "bg-fuchsia-500",
    border: "border-fuchsia-500/20",
    bg: "bg-fuchsia-500/[0.06]",
    text: "text-fuchsia-400",
    num: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
    dotColor: "text-fuchsia-500",
  },
  emerald: {
    dot: "bg-emerald-500",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/[0.06]",
    text: "text-emerald-400",
    num: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dotColor: "text-emerald-500",
  },
  amber: {
    dot: "bg-amber-500",
    border: "border-amber-500/20",
    bg: "bg-amber-500/[0.06]",
    text: "text-amber-400",
    num: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dotColor: "text-amber-500",
  },
};

export function ServicePipeline() {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  return (
    <div className="relative">
      {/* Animated gradient connecting line */}
      <div className="hidden lg:block absolute top-1/2 left-0 right-0 -translate-y-1/2 z-0">
        <div className="h-[2px] rounded-full pipeline-animated-line" />
        {/* Pulsing dots at each phase node */}
        {PHASES.map((phase, pi) => {
          const colors = ACCENT_COLORS[phase.accent];
          const isExpanded = expandedPhase === pi;
          return (
            <div
              key={phase.phase}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${(pi * 100) / PHASES.length + 100 / PHASES.length / 2}%` }}
            >
              <span
                className={`block w-3 h-3 rounded-full ${colors.dot} ${colors.dotColor} pipeline-dot-pulse ${
                  isExpanded ? "scale-150" : ""
                } transition-transform duration-300`}
                style={{ animationDelay: `${pi * 0.5}s` }}
              />
            </div>
          );
        })}
        {/* Progress flow indicator — animated arrow */}
        <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1">
          <span className="block w-8 h-[2px] bg-gradient-to-r from-violet-500/40 to-transparent rounded-full" />
          <span className="block w-0 h-0 border-l-[6px] border-l-violet-500/40 border-y-[4px] border-y-transparent" />
        </div>
      </div>

      {/* Phase segment glow lines */}
      {expandedPhase !== null && (
        <div className="hidden lg:block absolute top-1/2 left-0 right-0 -translate-y-1/2 z-0">
          <div
            className="h-[2px] rounded-full pipeline-animated-line-glow transition-all duration-500"
            style={{
              marginLeft: `${(expandedPhase * 100) / PHASES.length}%`,
              width: `${100 / PHASES.length}%`,
            }}
          />
        </div>
      )}

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
                <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} ${isExpanded ? "pipeline-dot-pulse" : ""}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                  {phase.phase}
                </span>
              </div>
              <div className="space-y-2.5">
                {phase.steps.map((step) => (
                  <div key={step.num} className="flex items-start gap-2.5">
                    <span
                      className={`huly-badge shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold border ${colors.num} shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`}
                    >
                      {step.num}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight">
                        {step.name}
                      </div>
                      {isExpanded && (
                        <div className="text-xs text-zinc-500 mt-0.5 animate-fade-in-up">
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
          <span className="block w-4 h-[1.5px] pipeline-animated-line rounded-full" />
          12-step autonomous loop
        </div>
      </div>
    </div>
  );
}
