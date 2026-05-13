"use client";

import { useEffect, useState } from "react";
import {
  BoltIcon,
  ShieldExclamationIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  DocumentCheckIcon,
  CloudArrowDownIcon,
  LockClosedIcon,
  ClockIcon,
  RocketLaunchIcon,
  XCircleIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";

export type ActivityEventType =
  | "scan.completed"
  | "scan.started"
  | "scan.failed"
  | "finding.detected"
  | "finding.critical"
  | "plan.generated"
  | "plan.approved"
  | "plan.applied"
  | "drift.detected"
  | "rollback.prepared"
  | "savings.identified"
  | "agent.reasoning"
  | "approval.required"
  | "monitoring.alert"
  | "audit.event"
  // ReleaseOps event types
  | "release.assessed"
  | "release.approved"
  | "release.deployed"
  | "release.blocked"
  | "release.rolled_back"
  | "release.drift_detected"
  | "release.readiness_dropped"
  | "release.config_mismatch"
  | "release.dependency_conflict"
  | "release.verification_passed"
  | "release.approval_pending"
  | "release.servicenow_synced"
  | "release.terraform_plan";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description?: string;
  provider?: "aws" | "azure" | "gcp" | "system";
  region?: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  timestamp: string;
  metadata?: Record<string, string | number>;
}

const EVENT_CONFIG: Record<
  ActivityEventType,
  { icon: typeof BoltIcon; iconClass: string; bgClass: string; borderClass: string }
> = {
  "scan.completed": {
    icon: CheckCircleIcon,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
  },
  "scan.started": {
    icon: ArrowPathIcon,
    iconClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/20",
  },
  "scan.failed": {
    icon: ExclamationTriangleIcon,
    iconClass: "text-red-400",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/20",
  },
  "finding.detected": {
    icon: ShieldExclamationIcon,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
  },
  "finding.critical": {
    icon: ShieldExclamationIcon,
    iconClass: "text-red-400",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/20",
  },
  "plan.generated": {
    icon: DocumentCheckIcon,
    iconClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/20",
  },
  "plan.approved": {
    icon: CheckCircleIcon,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
  },
  "plan.applied": {
    icon: BoltIcon,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
  },
  "drift.detected": {
    icon: ExclamationTriangleIcon,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
  },
  "rollback.prepared": {
    icon: ArrowPathIcon,
    iconClass: "text-cyan-400",
    bgClass: "bg-cyan-500/10",
    borderClass: "border-cyan-500/20",
  },
  "savings.identified": {
    icon: CurrencyDollarIcon,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
  },
  "agent.reasoning": {
    icon: CpuChipIcon,
    iconClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/20",
  },
  "approval.required": {
    icon: LockClosedIcon,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
  },
  "monitoring.alert": {
    icon: CloudArrowDownIcon,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
  },
  "audit.event": {
    icon: DocumentCheckIcon,
    iconClass: "text-zinc-400",
    bgClass: "bg-white/[0.04]",
    borderClass: "border-white/[0.08]",
  },
  // ReleaseOps event configs
  "release.assessed": {
    icon: DocumentCheckIcon,
    iconClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/20",
  },
  "release.approved": {
    icon: CheckCircleIcon,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
  },
  "release.deployed": {
    icon: RocketLaunchIcon,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
  },
  "release.blocked": {
    icon: XCircleIcon,
    iconClass: "text-red-400",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/20",
  },
  "release.rolled_back": {
    icon: ArrowPathIcon,
    iconClass: "text-cyan-400",
    bgClass: "bg-cyan-500/10",
    borderClass: "border-cyan-500/20",
  },
  "release.drift_detected": {
    icon: ExclamationTriangleIcon,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
  },
  "release.readiness_dropped": {
    icon: ShieldExclamationIcon,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
  },
  "release.config_mismatch": {
    icon: ExclamationTriangleIcon,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
  },
  "release.dependency_conflict": {
    icon: ShieldExclamationIcon,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
  },
  "release.verification_passed": {
    icon: CheckCircleIcon,
    iconClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
  },
  "release.approval_pending": {
    icon: LockClosedIcon,
    iconClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
  },
  "release.servicenow_synced": {
    icon: DocumentCheckIcon,
    iconClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/20",
  },
  "release.terraform_plan": {
    icon: CodeBracketIcon,
    iconClass: "text-violet-400",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/20",
  },
};

const PROVIDER_LABEL: Record<NonNullable<ActivityEvent["provider"]>, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  system: "System",
};

const PROVIDER_COLOR: Record<NonNullable<ActivityEvent["provider"]>, string> = {
  aws: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  azure: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  gcp: "text-red-400 bg-red-500/10 border-red-500/20",
  system: "text-zinc-400 bg-white/[0.04] border-white/[0.08]",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

interface ActivityFeedProps {
  events?: ActivityEvent[];
  title?: string;
  showLive?: boolean;
  maxItems?: number;
  className?: string;
  /** When true, fetch from /api/operations/events on mount and every 30s. */
  liveFetch?: boolean;
}

export function ActivityFeed({
  events,
  title = "Operational Activity",
  showLive = true,
  maxItems = 20,
  className = "",
  liveFetch = false,
}: ActivityFeedProps) {
  const [items, setItems] = useState<ActivityEvent[]>(events ?? DEMO_EVENTS);
  const [source, setSource] = useState<"prop" | "api" | "demo">(events ? "prop" : "demo");
  const [, setTick] = useState(0);

  // Re-render every 30s to refresh "X minutes ago" labels
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // If parent provided events, sync
  useEffect(() => {
    if (events) {
      setItems(events);
      setSource("prop");
    }
  }, [events]);

  // Live-fetch from the operations event-stream API
  useEffect(() => {
    if (!liveFetch || events) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/operations/events?limit=${maxItems}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { events?: ActivityEvent[] };
        if (cancelled || !data.events) return;
        if (data.events.length > 0) {
          setItems(data.events);
          setSource("api");
        }
      } catch { /* keep demo data on failure — surfaces still render */ }
    };

    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [liveFetch, events, maxItems]);

  const visible = items.slice(0, maxItems);

  return (
    <div className={`relative rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center gap-3">
          {showLive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <span className="text-[10px] text-zinc-500 font-mono">{items.length} events</span>
        </div>
        <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">Live · Auto-refresh 30s</span>
      </div>

      {/* Feed */}
      <ol className="relative">
        {visible.map((event, idx) => {
          const config = EVENT_CONFIG[event.type];
          const Icon = config.icon;
          const isLast = idx === visible.length - 1;
          return (
            <li key={event.id} className="relative px-6 py-4 hover:bg-white/[0.02] transition-colors group">
              {/* Timeline rail */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute left-[2.05rem] top-12 bottom-0 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-transparent"
                />
              )}
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={`relative w-8 h-8 rounded-lg ${config.bgClass} border ${config.borderClass} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 ${config.iconClass}`} />
                  {event.severity === "critical" && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white truncate">{event.title}</p>
                    {event.provider && (
                      <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${PROVIDER_COLOR[event.provider]}`}>
                        {PROVIDER_LABEL[event.provider]}
                        {event.region && ` · ${event.region}`}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{event.description}</p>
                  )}
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-zinc-600 font-mono">
                      {Object.entries(event.metadata).map(([k, v]) => (
                        <span key={k} className="inline-flex items-center gap-1">
                          <span className="text-zinc-700">{k}:</span>
                          <span className="text-zinc-400">{v}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1 text-[10px] text-zinc-600 shrink-0 mt-1">
                  <ClockIcon className="h-3 w-3" />
                  {timeAgo(event.timestamp)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Showing {visible.length} of {items.length}</span>
          {source === "api" && (
            <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-px uppercase tracking-wider">Live data</span>
          )}
          {source === "demo" && (
            <span className="text-[9px] font-semibold text-zinc-500 bg-white/[0.04] border border-white/[0.08] rounded-full px-1.5 py-px uppercase tracking-wider">Sample</span>
          )}
        </div>
        <button className="text-zinc-400 hover:text-white transition-colors font-medium">
          View full audit log →
        </button>
      </div>
    </div>
  );
}

// Demo events used when no events prop is provided. Keeps the UI alive
// for screenshots, demos, and first-time users without real scan data.
const NOW = Date.now();
const DEMO_EVENTS: ActivityEvent[] = [
  {
    id: "e1",
    type: "scan.completed",
    title: "Infrastructure scan completed",
    description: "142 resources discovered across 4 services · 14 findings · 4 critical",
    provider: "aws",
    region: "us-east-1",
    timestamp: new Date(NOW - 47_000).toISOString(),
    metadata: { resources: 142, findings: 14, duration: "2m 14s" },
  },
  {
    id: "e2",
    type: "finding.critical",
    title: "Public S3 bucket detected",
    description: "prod-customer-uploads is publicly readable · contains PII risk",
    provider: "aws",
    region: "us-east-1",
    severity: "critical",
    timestamp: new Date(NOW - 60_000).toISOString(),
    metadata: { bucket: "prod-customer-uploads", risk: "PII" },
  },
  {
    id: "e3",
    type: "savings.identified",
    title: "Cost optimization opportunity",
    description: "3 oversized EC2 instances · rightsizing saves $2,400/mo",
    provider: "aws",
    region: "us-east-1",
    timestamp: new Date(NOW - 90_000).toISOString(),
    metadata: { savings: "$2,400/mo", instances: 3 },
  },
  {
    id: "e4",
    type: "agent.reasoning",
    title: "Reasoning loop completed · confidence 0.92",
    description: "12-step cognitive evaluation · prioritized 14 findings into 4 phased plans",
    provider: "system",
    timestamp: new Date(NOW - 105_000).toISOString(),
    metadata: { confidence: 0.92, steps: 12, phases: 4 },
  },
  {
    id: "e5",
    type: "plan.generated",
    title: "Execution plan generated",
    description: "Phase 1 of 4 · 6 resources affected · Terraform validated · pre-rollback ready",
    provider: "aws",
    timestamp: new Date(NOW - 120_000).toISOString(),
    metadata: { phase: "1/4", resources: 6 },
  },
  {
    id: "e6",
    type: "approval.required",
    title: "Approval required: IAM policy modification",
    description: "Blast radius limit triggered for prod-api-role · awaiting human review",
    provider: "aws",
    severity: "high",
    timestamp: new Date(NOW - 180_000).toISOString(),
    metadata: { role: "prod-api-role", blast: "high" },
  },
  {
    id: "e7",
    type: "drift.detected",
    title: "Configuration drift detected",
    description: "2 security group rules modified outside of Axiom · diff captured",
    provider: "aws",
    region: "us-west-2",
    timestamp: new Date(NOW - 320_000).toISOString(),
    metadata: { sg: "sg-0a1b2c3d", rules: 2 },
  },
  {
    id: "e8",
    type: "rollback.prepared",
    title: "Rollback strategy verified",
    description: "Pre-flight snapshot captured · rollback in 47s if execution fails",
    provider: "system",
    timestamp: new Date(NOW - 600_000).toISOString(),
    metadata: { rollback: "47s", snapshot: "verified" },
  },
  {
    id: "e9",
    type: "scan.completed",
    title: "Scheduled scan: Azure subscription",
    description: "Service Principal connector · VM + Storage + Network discovery",
    provider: "azure",
    timestamp: new Date(NOW - 1_800_000).toISOString(),
    metadata: { subscription: "sub-prod-eu", resources: 84 },
  },
  {
    id: "e10",
    type: "plan.applied",
    title: "Execution plan applied",
    description: "Phase 1 completed in 38s · 6/6 resources updated · cost saving locked in",
    provider: "aws",
    timestamp: new Date(NOW - 5_400_000).toISOString(),
    metadata: { phase: "1/4", duration: "38s" },
  },
];
