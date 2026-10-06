"use client";

import { useState } from "react";
import {
  DocumentCheckIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";

export interface PlanPhase {
  id: string;
  number: number;
  title: string;
  description: string;
  resources: number;
  estimatedDuration: string;
  status: "pending" | "approved" | "executing" | "complete" | "failed";
  riskLevel: "low" | "medium" | "high";
}

export interface ExecutionPlanData {
  id: string;
  title: string;
  provider: "aws" | "azure" | "gcp";
  totalResources: number;
  estimatedSavings: number;
  totalDuration: string;
  rollbackRto: string;
  blastRadius: "contained" | "moderate" | "broad";
  phases: PlanPhase[];
  terraformPreview: string;
  affectedResources: { name: string; type: string; action: "create" | "modify" | "destroy" }[];
  safetyChecks: { label: string; passed: boolean }[];
}

const PHASE_STATUS_CONFIG: Record<
  PlanPhase["status"],
  { label: string; color: string; bg: string; dot: string }
> = {
  pending: { label: "Pending", color: "text-zinc-400", bg: "bg-white/[0.04] border-white/[0.08]", dot: "bg-zinc-500" },
  approved: { label: "Approved", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  executing: { label: "Executing", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", dot: "bg-blue-400 animate-pulse" },
  complete: { label: "Complete", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  failed: { label: "Failed", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", dot: "bg-red-400" },
};

const RISK_COLOR: Record<PlanPhase["riskLevel"], string> = {
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-zinc-400 bg-white/10 border-white/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

const ACTION_COLOR: Record<ExecutionPlanData["affectedResources"][number]["action"], string> = {
  create: "text-emerald-400",
  modify: "text-zinc-400",
  destroy: "text-red-400",
};

const ACTION_SYMBOL: Record<ExecutionPlanData["affectedResources"][number]["action"], string> = {
  create: "+",
  modify: "~",
  destroy: "-",
};

interface ExecutionPlanCardProps {
  plan?: ExecutionPlanData;
  className?: string;
  onApprove?: () => void;
}

export function ExecutionPlanCard({ plan, className = "", onApprove }: ExecutionPlanCardProps) {
  const data = plan ?? DEMO_PLAN;
  const [activeTab, setActiveTab] = useState<"phases" | "terraform" | "resources" | "safety">("phases");

  const counts = {
    create: data.affectedResources.filter((r) => r.action === "create").length,
    modify: data.affectedResources.filter((r) => r.action === "modify").length,
    destroy: data.affectedResources.filter((r) => r.action === "destroy").length,
  };

  const allSafetyPassed = data.safetyChecks.every((c) => c.passed);

  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <DocumentCheckIcon className="h-4 w-4 text-violet-400" />
              <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Execution Plan</span>
              <span className="text-[10px] text-zinc-600 font-mono">{data.id}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider border rounded-full px-2 py-0.5 text-zinc-400 bg-white/10 border-white/20">
                {data.provider}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-[-0.02em]">{data.title}</h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Estimated savings</p>
            <p className="text-2xl font-bold text-emerald-400">+${data.estimatedSavings.toLocaleString()}<span className="text-sm text-zinc-500 font-normal">/mo</span></p>
          </div>
        </div>

        {/* Top metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Resources", value: data.totalResources.toString(), Icon: CubeIcon },
            { label: "Duration", value: data.totalDuration, Icon: ClockIcon },
            { label: "Rollback RTO", value: data.rollbackRto, Icon: ArrowPathIcon },
            { label: "Blast radius", value: data.blastRadius, Icon: ShieldCheckIcon },
          ].map((m) => {
            const Icon = m.Icon;
            return (
              <div key={m.label} className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3 w-3 text-zinc-500" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">{m.label}</span>
                </div>
                <p className="text-sm font-semibold text-white capitalize">{m.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] bg-white/[0.01]">
        {([
          { id: "phases", label: "Phases", count: data.phases.length },
          { id: "terraform", label: "Terraform", count: undefined },
          { id: "resources", label: "Resources", count: data.affectedResources.length },
          { id: "safety", label: "Safety", count: undefined },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? "text-white border-violet-500"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className={`ml-1.5 ${activeTab === t.id ? "text-violet-400" : "text-zinc-600"}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === "phases" && (
          <ol className="relative space-y-3">
            {data.phases.map((phase, idx) => {
              const config = PHASE_STATUS_CONFIG[phase.status];
              const isLast = idx === data.phases.length - 1;
              return (
                <li key={phase.id} className="relative pl-12">
                  {!isLast && (
                    <span aria-hidden className="absolute left-[1.25rem] top-10 bottom-0 w-px bg-white/[0.06]" />
                  )}
                  <div className={`absolute left-0 top-0 w-10 h-10 rounded-xl ${config.bg} border flex items-center justify-center font-mono font-bold text-sm ${config.color}`}>
                    {phase.number}
                  </div>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold text-white">{phase.title}</p>
                        <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${RISK_COLOR[phase.riskLevel]}`}>
                          {phase.riskLevel}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed mb-2">{phase.description}</p>
                      <div className="flex items-center gap-x-3 text-[10px] text-zinc-600 font-mono">
                        <span>{phase.resources} resources</span>
                        <span>·</span>
                        <span>{phase.estimatedDuration}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>{config.label}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {activeTab === "terraform" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap text-[11px] font-mono">
              <span className="text-emerald-400">+ {counts.create} add</span>
              <span className="text-zinc-400">~ {counts.modify} change</span>
              <span className="text-red-400">- {counts.destroy} destroy</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400">{data.totalResources} total</span>
            </div>
            <pre className="rounded-lg bg-black/40 border border-white/[0.04] p-4 text-[11px] leading-relaxed text-zinc-300 font-mono overflow-x-auto">
              <code>{data.terraformPreview}</code>
            </pre>
          </div>
        )}

        {activeTab === "resources" && (
          <div className="space-y-1.5">
            {data.affectedResources.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`font-mono text-sm font-bold w-4 ${ACTION_COLOR[r.action]}`}>{ACTION_SYMBOL[r.action]}</span>
                  <span className="text-sm text-white font-mono truncate">{r.name}</span>
                </div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold shrink-0">{r.type}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "safety" && (
          <div className="space-y-2">
            {data.safetyChecks.map((check) => (
              <div key={check.label} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2.5">
                {check.passed ? (
                  <CheckCircleIcon className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <ExclamationTriangleIcon className="h-4 w-4 text-zinc-400 shrink-0" />
                )}
                <span className="text-sm text-zinc-300 flex-1">{check.label}</span>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${check.passed ? "text-emerald-400" : "text-zinc-400"}`}>
                  {check.passed ? "Passed" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Approval CTA */}
      <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs">
          <ShieldCheckIcon className={`h-4 w-4 ${allSafetyPassed ? "text-emerald-400" : "text-zinc-400"}`} />
          <span className={allSafetyPassed ? "text-emerald-400" : "text-zinc-400"}>
            {allSafetyPassed ? "All safety checks passed" : "Safety checks in progress"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-1.5 text-xs font-semibold rounded-full border border-white/[0.1] text-zinc-300 hover:bg-white/[0.04] hover:border-white/[0.2] transition-colors">
            View Terraform diff
          </button>
          <button
            onClick={onApprove}
            disabled={!allSafetyPassed}
            className={`btn-amber-shimmer inline-flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
              allSafetyPassed ? "" : "opacity-40 cursor-not-allowed"
            }`}
          >
            <CommandLineIcon className="h-3.5 w-3.5" />
            Approve & apply
          </button>
        </div>
      </div>
    </div>
  );
}

// Demo plan data
const DEMO_PLAN: ExecutionPlanData = {
  id: "plan_01HX9K42Q9",
  title: "Right-size 3 oversized EC2 instances · cut $2,400/mo",
  provider: "aws",
  totalResources: 6,
  estimatedSavings: 2400,
  totalDuration: "8 min",
  rollbackRto: "47s",
  blastRadius: "contained",
  phases: [
    {
      id: "p1",
      number: 1,
      title: "Snapshot + verify rollback path",
      description: "Capture pre-flight state snapshot · verify rollback strategy is ready · ALB drain configured.",
      resources: 1,
      estimatedDuration: "45s",
      status: "complete",
      riskLevel: "low",
    },
    {
      id: "p2",
      number: 2,
      title: "Right-size i-0a1b2c · m5.4xlarge → m5.xlarge",
      description: "Stop instance · modify instance type · start · wait for health check pass on ALB.",
      resources: 2,
      estimatedDuration: "2m 15s",
      status: "approved",
      riskLevel: "low",
    },
    {
      id: "p3",
      number: 3,
      title: "Right-size i-0e4f5g · m5.4xlarge → m5.xlarge",
      description: "Stop instance · modify instance type · start · wait for health check pass on ALB.",
      resources: 2,
      estimatedDuration: "2m 15s",
      status: "pending",
      riskLevel: "low",
    },
    {
      id: "p4",
      number: 4,
      title: "Right-size i-09h8i7 + lock savings",
      description: "Apply final right-size · verify cost impact in Cost Explorer · register savings event.",
      resources: 1,
      estimatedDuration: "2m 45s",
      status: "pending",
      riskLevel: "low",
    },
  ],
  terraformPreview: `# Phase 2 of 4 — generated by Axiom Agent

resource "aws_instance" "api_worker_01" {
  instance_type = "m5.xlarge"  # was: m5.4xlarge — rightsized
  ami           = data.aws_ami.app.id
  subnet_id     = aws_subnet.private_1a.id

  tags = {
    Name        = "api-worker-01"
    Managed_by  = "axiom-agent"
    Right_sized = "2026-05-13"
  }
}

# Pre-rollback snapshot captured at runtime — RTO 47s`,
  affectedResources: [
    { name: "aws_instance.api_worker_01", type: "EC2", action: "modify" },
    { name: "aws_instance.api_worker_02", type: "EC2", action: "modify" },
    { name: "aws_instance.api_worker_03", type: "EC2", action: "modify" },
    { name: "aws_lb_target_group_attachment.api_01", type: "ALB", action: "modify" },
    { name: "aws_lb_target_group_attachment.api_02", type: "ALB", action: "modify" },
    { name: "aws_cloudwatch_metric_alarm.savings_lock", type: "CloudWatch", action: "create" },
  ],
  safetyChecks: [
    { label: "Pre-flight snapshot captured", passed: true },
    { label: "Rollback path verified (47s RTO)", passed: true },
    { label: "ALB health drain configured", passed: true },
    { label: "No conflicting ASG policy", passed: true },
    { label: "Target instance class available in AZ", passed: true },
    { label: "Cost Explorer reachable", passed: true },
    { label: "Approval gate satisfied (production)", passed: false },
  ],
};
