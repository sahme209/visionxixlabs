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
    border: "border-violet-200 dark:border-violet-800",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    text: "text-violet-600 dark:text-violet-400",
    num: "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300",
  },
  fuchsia: {
    dot: "bg-fuchsia-500",
    border: "border-fuchsia-200 dark:border-fuchsia-800",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    num: "bg-fuchsia-100 dark:bg-fuchsia-900/50 text-fuchsia-700 dark:text-fuchsia-300",
  },
  emerald: {
    dot: "bg-emerald-500",
    border: "border-emerald-200 dark:border-emerald-800",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-600 dark:text-emerald-400",
    num: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
  },
  amber: {
    dot: "bg-amber-500",
    border: "border-amber-200 dark:border-amber-800",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-600 dark:text-amber-400",
    num: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
  },
};

export function ServicePipeline() {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  return (
    <div className="relative">
      <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 z-0">
        <div className="pipeline-glow h-full rounded-full opacity-40" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        {PHASES.map((phase, pi) => {
          const colors = ACCENT_COLORS[phase.accent];
          const isExpanded = expandedPhase === pi;

          return (
            <button
              key={phase.phase}
              onClick={() => setExpandedPhase(isExpanded ? null : pi)}
              className={`card-hover text-left rounded-xl border p-4 transition-all duration-200 ${
                isExpanded
                  ? `${colors.border} ${colors.bg} shadow-sm`
                  : "border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                  {phase.phase}
                </span>
              </div>
              <div className="space-y-2">
                {phase.steps.map((step) => (
                  <div key={step.num} className="flex items-start gap-2.5">
                    <span className={`icon-bounce shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${colors.num}`}>
                      {step.num}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-tight">
                        {step.name}
                      </div>
                      {isExpanded && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
      <div className="flex items-center justify-center gap-3 mt-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          Click a phase to expand
        </div>
        <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          12-step autonomous loop
        </div>
      </div>
    </div>
  );
}
