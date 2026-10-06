"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowPathIcon,
  CpuChipIcon,
  BoltIcon,
  ShieldExclamationIcon,
  CommandLineIcon,
  CurrencyDollarIcon,
  DocumentCheckIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { PageIntro } from "@/components/dashboard/PageIntro";
import { Stagger } from "@/components/motion/Stagger";
import { WorkflowOrchestrator } from "@/components/operations/WorkflowOrchestrator";

type Filter = "all" | "running" | "scheduled" | "paused";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All workflows" },
  { id: "running", label: "Running now" },
  { id: "scheduled", label: "Scheduled" },
  { id: "paused", label: "Paused" },
];

const WORKFLOW_TYPES = [
  {
    icon: ArrowPathIcon,
    title: "Recurring scans",
    desc: "Daily, hourly, or custom infrastructure snapshots. Each scan feeds the reasoning loop and operational memory.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: ShieldExclamationIcon,
    title: "Drift monitoring",
    desc: "Continuous comparison of baseline vs. live state. Auto-triages out-of-band changes with severity scoring.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: CommandLineIcon,
    title: "Execution queues",
    desc: "Phased execution of approved plans with health verification between each step.",
    color: "text-zinc-500",
    bg: "bg-violet-500/10 border-white/[0.08]",
  },
  {
    icon: CheckCircleIcon,
    title: "Post-execution verification",
    desc: "Confirms intended behavior, cost shift, and zero-drift after every change. Locks savings.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: CurrencyDollarIcon,
    title: "Cost anomaly watch",
    desc: "Hourly cost analysis flagging deviations from rolling baseline. Auto-opens reasoning trace.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: DocumentCheckIcon,
    title: "Compliance sweeps",
    desc: "Weekly configuration checks against SOC 2, ISO 27001, and HIPAA-aligned controls across connected providers — not a certification or compliance audit.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
];

export default function WorkflowsPage() {
  const [filter, setFilter] = useState<Filter>("all");

  return (
    <div className="relative">
      <PageIntro
        kicker="Automation · continuous workflows"
        title={<>Continuous <span className="text-zinc-500">workflows.</span></>}
        description="What Axiom is doing right now and what it will do next. Recurring scans, drift detection, execution queues, and post-execution verification run continuously — without you watching."
        helps="See active scans, drift alarms, queued executions, and verified rollback paths in one continuous stream."
        connectFirst="A cloud connector so there's something to watch. Then add monitoring + IaC sources for richer triggers."
        engineers={["DevOps Engineer", "SRE / On-call", "Cloud Engineer"]}
        requiresApproval="Workflow definitions, trigger schedules, post-execution remediation actions."
        actions={[
          { label: "View approvals", href: "/dashboard/approvals" },
          { label: "Configure scans", href: "/dashboard/scheduled-scans" },
        ]}
        safetyNote="Background runs are read-only · Any write requires explicit approval"
      />

      {/* Past / Present / Future triad */}
      <Reveal direction="up" delay={0.06}>
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          {[
            {
              label: "Past",
              title: "Operational memory",
              detail: "90-day audit · 1,847 events",
              href: "/dashboard/memory",
              icon: ClockIcon,
              accent: "violet",
            },
            {
              label: "Present",
              title: "Live topology",
              detail: "264 resources across 3 clouds",
              href: "/dashboard/topology",
              icon: CpuChipIcon,
              accent: "blue",
            },
            {
              label: "Future",
              title: "Continuous workflows",
              detail: "9 workflows · 996 runs/month",
              href: "/dashboard/workflows",
              icon: BoltIcon,
              accent: "emerald",
            },
          ].map((tile, i) => {
            const Icon = tile.icon;
            const isCurrent = i === 2;
            return (
              <Link
                key={tile.label}
                href={tile.href}
                className={`relative rounded-xl border p-4 transition-all overflow-hidden ${
                  isCurrent
                    ? "border-emerald-500/25 bg-emerald-500/[0.04] hover:border-emerald-500/40"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                {isCurrent && (
                  <span aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-emerald-500/[0.08] blur-[40px] pointer-events-none" />
                )}
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${
                      isCurrent ? "text-emerald-400" : "text-zinc-500"
                    }`}>{tile.label}</span>
                    {isCurrent && (
                      <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-1.5 py-px uppercase tracking-wider">You are here</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                      tile.accent === "violet" ? "bg-violet-500/10 border-white/[0.08]" :
                      tile.accent === "blue" ? "bg-blue-500/10 border-blue-500/20" :
                      "bg-emerald-500/10 border-emerald-500/20"
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        tile.accent === "violet" ? "text-zinc-500" :
                        tile.accent === "blue" ? "text-blue-400" :
                        "text-emerald-400"
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{tile.title}</p>
                      <p className="text-[10px] text-zinc-500">{tile.detail}</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Reveal>

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
          <button className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-dashed border-white/[0.1] hover:border-white/[0.2] rounded-full px-3.5 py-1.5 transition-colors">
            + New workflow
          </button>
        </div>
      </Reveal>

      {/* Orchestrator */}
      <Reveal direction="up" delay={0.14}>
        <div className="mb-8">
          <WorkflowOrchestrator />
        </div>
      </Reveal>

      {/* Workflow types library */}
      <Reveal direction="up" delay={0.18}>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white tracking-[-0.03em] mb-2">
            Workflow library.{" "}
            <span className="text-zinc-500">Every category Axiom supports.</span>
          </h2>
          <p className="text-dim-paragraph text-sm max-w-2xl leading-relaxed">
            Pick a category to schedule a new workflow. <span className="dim-1">Each one is opinionated · safety-checked · auditable end-to-end.</span>
          </p>
        </div>
      </Reveal>

      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {WORKFLOW_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.title}
              className="text-left rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all group"
            >
              <div className="flex items-start gap-3 mb-2">
                <div className={`w-10 h-10 rounded-lg border ${t.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${t.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{t.title}</p>
                </div>
                <ArrowRightIcon className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all mt-1.5" />
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{t.desc}</p>
            </button>
          );
        })}
      </Stagger>
    </div>
  );
}
