"use client";

import {
  EyeIcon,
  CpuChipIcon,
  ChartBarIcon,
  DocumentMagnifyingGlassIcon,
  ScaleIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

export interface ReasoningStep {
  id: string;
  phase: "observe" | "interpret" | "reason" | "plan" | "verify" | "execute";
  label: string;
  detail: string;
  status: "complete" | "active" | "pending";
  evidence?: { label: string; value: string }[];
  confidence?: number;
  durationMs?: number;
}

export interface ReasoningTraceData {
  runId: string;
  title: string;
  summary: string;
  confidence: number; // 0..1
  whyItMatters: string;
  steps: ReasoningStep[];
  recommendation?: {
    action: string;
    impact: string;
    risk: "low" | "medium" | "high";
    monthlySavings?: number;
  };
}

const PHASE_CONFIG: Record<
  ReasoningStep["phase"],
  { icon: typeof EyeIcon; iconClass: string; bgClass: string; label: string }
> = {
  observe: { icon: EyeIcon, iconClass: "text-blue-400", bgClass: "bg-blue-500/10 border-blue-500/20", label: "Observe" },
  interpret: { icon: DocumentMagnifyingGlassIcon, iconClass: "text-cyan-400", bgClass: "bg-cyan-500/10 border-cyan-500/20", label: "Interpret" },
  reason: { icon: CpuChipIcon, iconClass: "text-violet-400", bgClass: "bg-violet-500/10 border-violet-500/20", label: "Reason" },
  plan: { icon: ChartBarIcon, iconClass: "text-fuchsia-400", bgClass: "bg-fuchsia-500/10 border-fuchsia-500/20", label: "Plan" },
  verify: { icon: ShieldCheckIcon, iconClass: "text-zinc-400", bgClass: "bg-white/10 border-white/20", label: "Verify" },
  execute: { icon: CommandLineIcon, iconClass: "text-emerald-400", bgClass: "bg-emerald-500/10 border-emerald-500/20", label: "Execute" },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "from-emerald-500 to-emerald-400" :
    pct >= 60 ? "from-zinc-500 to-zinc-400" :
    "from-red-500 to-red-400";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-400 w-10 text-right">{pct}%</span>
    </div>
  );
}

interface ReasoningTraceProps {
  data?: ReasoningTraceData;
  className?: string;
}

export function ReasoningTrace({ data, className = "" }: ReasoningTraceProps) {
  const trace = data ?? DEMO_TRACE;
  const riskColor =
    trace.recommendation?.risk === "low" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    trace.recommendation?.risk === "medium" ? "text-zinc-400 bg-white/10 border-white/20" :
    "text-red-400 bg-red-500/10 border-red-500/20";

  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <CpuChipIcon className="h-4 w-4 text-violet-400" />
            <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Agent Reasoning Trace</span>
            <span className="text-[10px] text-zinc-600 font-mono">{trace.runId}</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono uppercase">Confidence verified</span>
        </div>
        <h3 className="text-lg font-bold text-white tracking-[-0.02em] mb-2">{trace.title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">{trace.summary}</p>
        <ConfidenceBar value={trace.confidence} />
      </div>

      {/* Why it matters */}
      <div className="px-6 py-4 border-b border-white/[0.06] bg-violet-500/[0.03]">
        <div className="flex items-start gap-3">
          <ScaleIcon className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-1">Why this matters</p>
            <p className="text-sm text-zinc-300 leading-relaxed">{trace.whyItMatters}</p>
          </div>
        </div>
      </div>

      {/* Reasoning steps */}
      <ol className="relative px-6 py-5">
        {trace.steps.map((step, idx) => {
          const phase = PHASE_CONFIG[step.phase];
          const Icon = phase.icon;
          const isLast = idx === trace.steps.length - 1;
          const isComplete = step.status === "complete";
          const isActive = step.status === "active";
          return (
            <li key={step.id} className="relative pl-10 pb-5">
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute left-[1.05rem] top-9 bottom-0 w-px ${isComplete ? "bg-emerald-500/30" : "bg-white/[0.08]"}`}
                />
              )}
              <div className={`absolute left-0 top-0 w-9 h-9 rounded-xl ${phase.bgClass} border flex items-center justify-center ${isActive ? "ring-2 ring-violet-500/50 animate-pulse" : ""}`}>
                {isComplete ? (
                  <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Icon className={`h-4 w-4 ${phase.iconClass}`} />
                )}
              </div>
              <div className="pt-0.5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">{phase.label}</span>
                  <p className="text-sm font-semibold text-white">{step.label}</p>
                  {step.durationMs && (
                    <span className="text-[10px] text-zinc-600 font-mono">{step.durationMs}ms</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed mb-2">{step.detail}</p>
                {step.evidence && step.evidence.length > 0 && (
                  <div className="rounded-lg bg-black/30 border border-white/[0.04] p-2.5">
                    <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Evidence</p>
                    <div className="space-y-1">
                      {step.evidence.map((e) => (
                        <div key={e.label} className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-zinc-600">{e.label}</span>
                          <span className="text-zinc-300">{e.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {step.confidence != null && (
                  <div className="mt-2 max-w-[200px]">
                    <ConfidenceBar value={step.confidence} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Recommendation */}
      {trace.recommendation && (
        <div className="px-6 py-5 border-t border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Recommended action</p>
              <p className="text-base font-bold text-white mb-1">{trace.recommendation.action}</p>
              <p className="text-sm text-zinc-400 leading-relaxed">{trace.recommendation.impact}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-wider border rounded-full px-2.5 py-1 ${riskColor}`}>
                {trace.recommendation.risk} risk
              </span>
              {trace.recommendation.monthlySavings && (
                <span className="text-sm font-semibold text-emerald-400">
                  +${trace.recommendation.monthlySavings.toLocaleString()}/mo
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Demo trace used when no data is provided
const DEMO_TRACE: ReasoningTraceData = {
  runId: "run_01HX9K42Q7",
  title: "Right-size 3 oversized EC2 instances",
  summary:
    "Detected sustained low CPU and memory utilization across 3 production EC2 instances. Workload patterns indicate m5.xlarge is the optimal class — current m5.4xlarge is over-provisioned by 4x.",
  confidence: 0.92,
  whyItMatters:
    "These instances waste $2,400/mo with zero performance benefit. Right-sizing recovers margin and reduces blast radius for future incidents — without changing application behavior.",
  steps: [
    {
      id: "s1",
      phase: "observe",
      label: "Captured 14-day metric snapshot",
      detail: "Pulled CloudWatch CPU, memory, network, and disk metrics for 14 days across all EC2 in us-east-1.",
      status: "complete",
      durationMs: 312,
      evidence: [
        { label: "Instances scanned", value: "47" },
        { label: "Metric points", value: "118,440" },
        { label: "Period", value: "14d · 5m granularity" },
      ],
    },
    {
      id: "s2",
      phase: "interpret",
      label: "Identified utilization outliers",
      detail: "3 instances showed sustained CPU < 12% (p95) and memory < 30% over the full window — well below right-sizing threshold.",
      status: "complete",
      durationMs: 187,
      evidence: [
        { label: "CPU p95", value: "11.2% · 9.4% · 10.8%" },
        { label: "Memory p95", value: "28% · 26% · 31%" },
        { label: "Instance class", value: "m5.4xlarge × 3" },
      ],
    },
    {
      id: "s3",
      phase: "reason",
      label: "Mapped workload pattern to instance class",
      detail: "Workload signature matches general-purpose CPU-bound. Optimal class is m5.xlarge based on AWS pricing model and AWS Compute Optimizer recommendation.",
      status: "complete",
      confidence: 0.94,
      durationMs: 423,
      evidence: [
        { label: "Match score", value: "0.94 · m5.xlarge" },
        { label: "Compute Optimizer", value: "agrees" },
        { label: "Savings model", value: "$800/mo per instance" },
      ],
    },
    {
      id: "s4",
      phase: "plan",
      label: "Generated phased execution plan",
      detail: "Plan: stop instance → modify type → start instance, sequenced one-at-a-time with health verification between each step.",
      status: "complete",
      durationMs: 156,
      evidence: [
        { label: "Phases", value: "3 (one per instance)" },
        { label: "Expected duration", value: "8 minutes total" },
        { label: "Rollback ready", value: "Yes · 47s RTO" },
      ],
    },
    {
      id: "s5",
      phase: "verify",
      label: "Safety checks complete",
      detail: "Verified target instance type is available in AZ, ALB health checks present, and instance is not in an Auto Scaling Group that would conflict.",
      status: "active",
      evidence: [
        { label: "ALB health", value: "✓ Verified" },
        { label: "ASG conflict", value: "None" },
        { label: "AZ capacity", value: "Available" },
      ],
    },
    {
      id: "s6",
      phase: "execute",
      label: "Awaiting approval",
      detail: "Plan ready to apply. Blast-radius classification: low. Approval gate enforced for production changes.",
      status: "pending",
    },
  ],
  recommendation: {
    action: "Right-size m5.4xlarge → m5.xlarge for 3 instances",
    impact: "Sequenced 8-minute change · zero downtime via ALB drain · pre-verified rollback in 47s",
    risk: "low",
    monthlySavings: 2400,
  },
};
