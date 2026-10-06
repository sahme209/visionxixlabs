"use client";

import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CheckCircleIcon,
  XCircleIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  CloudArrowDownIcon,
  CommandLineIcon,
  ArrowPathIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

type MemoryEventKind =
  | "scan"
  | "recommendation.accepted"
  | "recommendation.ignored"
  | "execution.applied"
  | "execution.failed"
  | "drift.detected"
  | "rollback.executed"
  | "approval.granted"
  | "approval.denied"
  | "cost.shift"
  | "confidence.increase"
  | "confidence.decrease"
  | "baseline.snapshot";

interface MemoryEvent {
  id: string;
  kind: MemoryEventKind;
  title: string;
  detail: string;
  timestamp: string;
  provider?: "aws" | "azure" | "gcp";
  outcome?: "positive" | "negative" | "neutral";
  delta?: { label: string; value: string; direction?: "up" | "down" };
}

interface DayGroup {
  date: string; // ISO date YYYY-MM-DD
  label: string; // "Today", "Yesterday", "May 11", etc.
  events: MemoryEvent[];
  summary: {
    scans: number;
    plans: number;
    savings: number;
    findings: number;
  };
}

const KIND_CONFIG: Record<
  MemoryEventKind,
  { icon: typeof CheckCircleIcon; iconClass: string; bgClass: string; borderClass: string }
> = {
  scan: { icon: CloudArrowDownIcon, iconClass: "text-blue-400", bgClass: "bg-blue-500/10", borderClass: "border-blue-500/20" },
  "recommendation.accepted": { icon: CheckCircleIcon, iconClass: "text-emerald-400", bgClass: "bg-emerald-500/10", borderClass: "border-emerald-500/20" },
  "recommendation.ignored": { icon: XCircleIcon, iconClass: "text-zinc-500", bgClass: "bg-white/[0.04]", borderClass: "border-white/[0.08]" },
  "execution.applied": { icon: CommandLineIcon, iconClass: "text-emerald-400", bgClass: "bg-emerald-500/10", borderClass: "border-emerald-500/20" },
  "execution.failed": { icon: XCircleIcon, iconClass: "text-red-400", bgClass: "bg-red-500/10", borderClass: "border-red-500/20" },
  "drift.detected": { icon: ArrowTrendingUpIcon, iconClass: "text-zinc-400", bgClass: "bg-white/10", borderClass: "border-white/20" },
  "rollback.executed": { icon: ArrowPathIcon, iconClass: "text-cyan-400", bgClass: "bg-cyan-500/10", borderClass: "border-cyan-500/20" },
  "approval.granted": { icon: ShieldCheckIcon, iconClass: "text-emerald-400", bgClass: "bg-emerald-500/10", borderClass: "border-emerald-500/20" },
  "approval.denied": { icon: ShieldCheckIcon, iconClass: "text-zinc-400", bgClass: "bg-white/10", borderClass: "border-white/20" },
  "cost.shift": { icon: CurrencyDollarIcon, iconClass: "text-emerald-400", bgClass: "bg-emerald-500/10", borderClass: "border-emerald-500/20" },
  "confidence.increase": { icon: ArrowTrendingUpIcon, iconClass: "text-violet-400", bgClass: "bg-violet-500/10", borderClass: "border-violet-500/20" },
  "confidence.decrease": { icon: ArrowTrendingDownIcon, iconClass: "text-zinc-400", bgClass: "bg-white/10", borderClass: "border-white/20" },
  "baseline.snapshot": { icon: CpuChipIcon, iconClass: "text-violet-400", bgClass: "bg-violet-500/10", borderClass: "border-violet-500/20" },
};

const PROVIDER_COLOR = {
  aws: "text-zinc-400 bg-white/10 border-white/20",
  azure: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  gcp: "text-red-400 bg-red-500/10 border-red-500/20",
} as const;

function eventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

interface MemoryTimelineProps {
  groups?: DayGroup[];
  className?: string;
}

export function MemoryTimeline({ groups = DEMO_GROUPS, className = "" }: MemoryTimelineProps) {
  const totalScans = groups.reduce((s, g) => s + g.summary.scans, 0);
  const totalPlans = groups.reduce((s, g) => s + g.summary.plans, 0);
  const totalSavings = groups.reduce((s, g) => s + g.summary.savings, 0);
  const totalFindings = groups.reduce((s, g) => s + g.summary.findings, 0);

  return (
    <div className={`relative rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <CpuChipIcon className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Operational Memory</h3>
            <span className="text-[10px] text-zinc-500 font-mono">{groups.length} days · {groups.reduce((s, g) => s + g.events.length, 0)} events</span>
          </div>
          <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">Continuous · Auditable</span>
        </div>
        {/* Aggregate stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "Scans", value: totalScans.toString(), color: "text-blue-400" },
            { label: "Plans applied", value: totalPlans.toString(), color: "text-emerald-400" },
            { label: "Savings locked", value: `$${(totalSavings / 1000).toFixed(1)}k`, color: "text-emerald-400" },
            { label: "Findings tracked", value: totalFindings.toString(), color: "text-zinc-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
              <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-6 py-6 max-h-[640px] overflow-y-auto">
        <div className="relative">
          {/* Continuous timeline rail */}
          <span aria-hidden className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-violet-500/30 via-white/[0.08] to-transparent" />

          {groups.map((group, gIdx) => (
            <div key={group.date} className={`relative ${gIdx === groups.length - 1 ? "" : "mb-8"}`}>
              {/* Day header */}
              <div className="relative flex items-center gap-3 mb-3 pl-10">
                <span className="absolute left-0 w-7 h-7 rounded-full bg-violet-500/15 border-2 border-violet-500/30 flex items-center justify-center">
                  <ClockIcon className="h-3 w-3 text-violet-400" />
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <h4 className="text-sm font-bold text-white">{group.label}</h4>
                  <span className="text-[10px] text-zinc-500 font-mono">{group.date}</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    {group.summary.scans > 0 && (
                      <span className="text-blue-400">{group.summary.scans} scan{group.summary.scans !== 1 ? "s" : ""}</span>
                    )}
                    {group.summary.plans > 0 && (
                      <span className="text-emerald-400">{group.summary.plans} plan{group.summary.plans !== 1 ? "s" : ""}</span>
                    )}
                    {group.summary.savings > 0 && (
                      <span className="text-emerald-400 font-semibold">+${group.summary.savings.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Events */}
              <ol className="space-y-2 pl-10">
                {group.events.map((event) => {
                  const config = KIND_CONFIG[event.kind];
                  const Icon = config.icon;
                  return (
                    <li key={event.id} className="relative rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 hover:border-white/[0.08] transition-colors group">
                      {/* Connector dot */}
                      <span aria-hidden className="absolute left-[-2.05rem] top-3.5 w-2.5 h-2.5 rounded-full border-2 border-[#09090b] bg-white/[0.1] group-hover:bg-violet-400 transition-colors" />

                      <div className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-lg ${config.bgClass} border ${config.borderClass} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-3.5 w-3.5 ${config.iconClass}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-xs font-semibold text-white">{event.title}</p>
                            {event.provider && (
                              <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${PROVIDER_COLOR[event.provider]}`}>
                                {event.provider}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 leading-relaxed">{event.detail}</p>
                          {event.delta && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {event.delta.direction === "up" && <ArrowTrendingUpIcon className="h-3 w-3 text-emerald-400" />}
                              {event.delta.direction === "down" && <ArrowTrendingDownIcon className="h-3 w-3 text-red-400" />}
                              <span className="text-[10px] text-zinc-600">{event.delta.label}</span>
                              <span className={`text-[10px] font-semibold ${
                                event.delta.direction === "up" ? "text-emerald-400" :
                                event.delta.direction === "down" ? "text-red-400" :
                                "text-zinc-400"
                              }`}>{event.delta.value}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-600 font-mono shrink-0 mt-1">{eventTime(event.timestamp)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          Showing {groups.length} day{groups.length !== 1 ? "s" : ""} · Memory window: 90 days
        </span>
        <button className="text-zinc-400 hover:text-white transition-colors font-medium">
          Export memory →
        </button>
      </div>
    </div>
  );
}

// Demo data — 5 days of operational events
const today = new Date();
const dayISO = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};
const eventISO = (offset: number, h: number, m: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - offset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const DEMO_GROUPS: DayGroup[] = [
  {
    date: dayISO(0),
    label: "Today",
    summary: { scans: 4, plans: 2, savings: 2400, findings: 14 },
    events: [
      {
        id: "t1",
        kind: "scan",
        title: "Production scan completed",
        detail: "142 resources discovered across 4 services · 14 findings · 4 critical",
        timestamp: eventISO(0, 9, 47),
        provider: "aws",
      },
      {
        id: "t2",
        kind: "baseline.snapshot",
        title: "Baseline snapshot captured",
        detail: "Pre-execution state preserved · rollback path verified (47s RTO)",
        timestamp: eventISO(0, 9, 51),
        provider: "aws",
      },
      {
        id: "t3",
        kind: "recommendation.accepted",
        title: "Right-size 3 EC2 instances · approved",
        detail: "Phase 1 of 4 executed · m5.4xlarge → m5.xlarge",
        timestamp: eventISO(0, 10, 12),
        provider: "aws",
        outcome: "positive",
        delta: { label: "Monthly savings", value: "+$2,400", direction: "up" },
      },
      {
        id: "t4",
        kind: "execution.applied",
        title: "Phase 1 applied successfully",
        detail: "1 instance modified · ALB health check passed · cost shift detected within 4 minutes",
        timestamp: eventISO(0, 10, 18),
        provider: "aws",
      },
      {
        id: "t5",
        kind: "confidence.increase",
        title: "Agent confidence increased",
        detail: "Successful execution + outcome match boosted confidence for right-sizing operations",
        timestamp: eventISO(0, 10, 19),
        delta: { label: "Confidence", value: "0.88 → 0.92", direction: "up" },
      },
    ],
  },
  {
    date: dayISO(1),
    label: "Yesterday",
    summary: { scans: 3, plans: 0, savings: 0, findings: 2 },
    events: [
      {
        id: "y1",
        kind: "drift.detected",
        title: "Configuration drift detected",
        detail: "2 security group rules modified outside of Axiom · diff captured for review",
        timestamp: eventISO(1, 14, 22),
        provider: "aws",
        outcome: "negative",
      },
      {
        id: "y2",
        kind: "scan",
        title: "Scheduled scan: Azure subscription",
        detail: "Service Principal connector · 84 resources · 6 findings",
        timestamp: eventISO(1, 8, 15),
        provider: "azure",
      },
      {
        id: "y3",
        kind: "recommendation.ignored",
        title: "Recommendation deferred",
        detail: "Reserved Instance purchase deferred · awaiting FinOps budget approval",
        timestamp: eventISO(1, 11, 30),
        provider: "aws",
        outcome: "neutral",
      },
    ],
  },
  {
    date: dayISO(2),
    label: "2 days ago",
    summary: { scans: 2, plans: 1, savings: 380, findings: 7 },
    events: [
      {
        id: "d2-1",
        kind: "execution.applied",
        title: "Cleaned up 7 unused EBS volumes",
        detail: "All snapshots retained · cost shift detected in 2 minutes",
        timestamp: eventISO(2, 16, 5),
        provider: "aws",
        delta: { label: "Monthly savings", value: "+$380", direction: "up" },
      },
      {
        id: "d2-2",
        kind: "approval.granted",
        title: "EBS cleanup approved",
        detail: "Blast radius: contained · approved by sam@example.com",
        timestamp: eventISO(2, 15, 50),
        provider: "aws",
      },
    ],
  },
  {
    date: dayISO(5),
    label: "5 days ago",
    summary: { scans: 1, plans: 0, savings: 0, findings: 11 },
    events: [
      {
        id: "d5-1",
        kind: "scan",
        title: "GCP scan: us-west1",
        detail: "Service Account connector · 30 resources · 7 findings · 5 critical",
        timestamp: eventISO(5, 19, 0),
        provider: "gcp",
      },
      {
        id: "d5-2",
        kind: "confidence.decrease",
        title: "Confidence reduced for IAM operations",
        detail: "Earlier execution failure tied to IAM action class · agent recalibrated",
        timestamp: eventISO(5, 19, 12),
        provider: "gcp",
        delta: { label: "IAM ops confidence", value: "0.74 → 0.61", direction: "down" },
      },
    ],
  },
  {
    date: dayISO(14),
    label: "2 weeks ago",
    summary: { scans: 1, plans: 1, savings: 9600, findings: 22 },
    events: [
      {
        id: "d14-1",
        kind: "baseline.snapshot",
        title: "Initial baseline established",
        detail: "First full scan · 264 resources mapped across AWS + Azure + GCP",
        timestamp: eventISO(14, 11, 0),
        provider: "aws",
      },
      {
        id: "d14-2",
        kind: "cost.shift",
        title: "Major cost optimization phase 1 complete",
        detail: "Reserved Instance restructuring + EBS cleanup + idle resource decommission",
        timestamp: eventISO(14, 15, 30),
        provider: "aws",
        delta: { label: "Total monthly impact", value: "+$9,600 saved", direction: "up" },
      },
    ],
  },
];
