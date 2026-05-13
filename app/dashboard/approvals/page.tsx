"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ClockIcon,
  CommandLineIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

// ---------------------------------------------------------------------------
// Demo approval queue (placeholder until backend wiring)
// ---------------------------------------------------------------------------

interface DemoApproval {
  id: string;
  title: string;
  provider: "aws" | "azure" | "gcp";
  service: string;
  environment: "production" | "staging";
  risk: "low" | "medium" | "high";
  blastRadius: "contained" | "moderate" | "broad";
  monthlySavingsUsd?: number;
  requestedAt: string;
  requestedBy: "agent" | string;
  reason: string;
  rollbackVerified: boolean;
  rollbackRtoSec: number;
  approversRequired: number;
  policyDecisionDetail: string;
  resources: number;
  hasTerraform: boolean;
  hasCli: boolean;
  hasDesktopHandoff: boolean;
  status: "pending" | "expiring_soon";
  expiresInHours: number;
}

const APPROVALS: DemoApproval[] = [
  {
    id: "apr_payments_iam",
    title: "Tighten IAM policy · prod-api-role",
    provider: "aws",
    service: "payments-api",
    environment: "production",
    risk: "high",
    blastRadius: "broad",
    requestedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    requestedBy: "agent",
    reason: "Over-permissive policy detected — proposal removes 4 unused actions.",
    rollbackVerified: true,
    rollbackRtoSec: 30,
    approversRequired: 2,
    policyDecisionDetail: "Broad blast radius + high risk in production requires multi-party approval and an external change request.",
    resources: 1,
    hasTerraform: true,
    hasCli: true,
    hasDesktopHandoff: true,
    status: "pending",
    expiresInHours: 23,
  },
  {
    id: "apr_rightsize_phase3",
    title: "Right-size 3 EC2 instances · phase 3 of 4",
    provider: "aws",
    service: "checkout-workers",
    environment: "production",
    risk: "low",
    blastRadius: "contained",
    monthlySavingsUsd: 800,
    requestedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    requestedBy: "agent",
    reason: "Phases 1 + 2 applied successfully; phase 3 mirrors the same change pattern.",
    rollbackVerified: true,
    rollbackRtoSec: 47,
    approversRequired: 1,
    policyDecisionDetail: "Low-risk action with verified rollback. Trust Ladder can promote this class once success streak passes threshold.",
    resources: 2,
    hasTerraform: true,
    hasCli: true,
    hasDesktopHandoff: true,
    status: "pending",
    expiresInHours: 22,
  },
  {
    id: "apr_ebs_cleanup",
    title: "Delete 7 unused EBS volumes",
    provider: "aws",
    service: "storage",
    environment: "production",
    risk: "low",
    blastRadius: "contained",
    monthlySavingsUsd: 380,
    requestedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    requestedBy: "agent",
    reason: "Volumes detached > 30 days, no snapshots referenced.",
    rollbackVerified: true,
    rollbackRtoSec: 0,
    approversRequired: 1,
    policyDecisionDetail: "Low-risk destructive action — snapshots preserved, all volumes detached > 30 days.",
    resources: 7,
    hasTerraform: false,
    hasCli: true,
    hasDesktopHandoff: false,
    status: "pending",
    expiresInHours: 21,
  },
  {
    id: "apr_drift_sg",
    title: "Restore prior security group rules · sg-0a1b2c",
    provider: "aws",
    service: "api-gateway",
    environment: "production",
    risk: "medium",
    blastRadius: "moderate",
    requestedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    requestedBy: "agent",
    reason: "2 rules added out-of-band on 2026-05-10; drift triage classified as needing remediation.",
    rollbackVerified: true,
    rollbackRtoSec: 15,
    approversRequired: 1,
    policyDecisionDetail: "Medium-risk drift correction. Verified rollback path. Single-approver review.",
    resources: 1,
    hasTerraform: true,
    hasCli: true,
    hasDesktopHandoff: true,
    status: "expiring_soon",
    expiresInHours: 3,
  },
];

const RISK_COLOR = {
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

const PROVIDER_COLOR = {
  aws: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  azure: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  gcp: "text-red-400 bg-red-500/10 border-red-500/20",
};

const ENV_COLOR = {
  production: "text-red-400 bg-red-500/10 border-red-500/20",
  staging: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

type FilterKind = "all" | "production" | "high_risk" | "expiring_soon";

export default function ApprovalsPage() {
  const [filter, setFilter] = useState<FilterKind>("all");
  const [selected, setSelected] = useState<string | null>(APPROVALS[0]?.id ?? null);

  const filtered = APPROVALS.filter((a) => {
    if (filter === "all") return true;
    if (filter === "production") return a.environment === "production";
    if (filter === "high_risk") return a.risk === "high";
    if (filter === "expiring_soon") return a.status === "expiring_soon";
    return true;
  });

  const active = filtered.find((a) => a.id === selected) ?? filtered[0];

  return (
    <div className="relative">
      {/* Header */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <LockClosedIcon className="h-4 w-4 text-amber-400" />
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">
              Approval Center
            </p>
            <span className="text-[9px] font-semibold text-violet-400 bg-violet-500/15 border border-violet-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">
              Enterprise · Human-in-the-loop
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Pending <span className="text-gradient">Approvals.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-3xl leading-relaxed">
            Every change Axiom proposes lands here first. <span className="dim-1">You see the reasoning, the policy decision, the rollback strategy, and the verification checklist before approving.</span> <span className="dim-2">No silent execution. No silent escalation.</span>
          </p>
        </div>
      </Reveal>

      {/* KPI strip */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Pending now", value: APPROVALS.length, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: LockClosedIcon },
          { label: "Production", value: APPROVALS.filter((a) => a.environment === "production").length, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: ShieldExclamationIcon },
          { label: "High risk", value: APPROVALS.filter((a) => a.risk === "high").length, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: ShieldExclamationIcon },
          { label: "Expiring soon", value: APPROVALS.filter((a) => a.status === "expiring_soon").length, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: ClockIcon },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`w-9 h-9 rounded-lg ${kpi.bg} border flex items-center justify-center mb-3`}>
                <Icon className={`h-4.5 w-4.5 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight mb-0.5">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 leading-tight">{kpi.label}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Filter row */}
      <Reveal direction="up" delay={0.08}>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mr-2">Filter:</span>
          {([
            { id: "all" as const, label: "All approvals" },
            { id: "production" as const, label: "Production" },
            { id: "high_risk" as const, label: "High risk" },
            { id: "expiring_soon" as const, label: "Expiring soon" },
          ] as { id: FilterKind; label: string }[]).map((f) => {
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
        </div>
      </Reveal>

      {/* Main grid — queue on left, detail on right */}
      <div className="grid lg:grid-cols-5 gap-5">
        {/* Queue list */}
        <div className="lg:col-span-2">
        <Reveal direction="up" delay={0.1}>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{filtered.length} approvals</h3>
              <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">Live queue</span>
            </div>
            <div className="p-2 space-y-1.5">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    a.id === active?.id
                      ? "border-violet-500/30 bg-violet-500/[0.06]"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${PROVIDER_COLOR[a.provider]}`}>{a.provider}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${ENV_COLOR[a.environment]}`}>{a.environment}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${RISK_COLOR[a.risk]}`}>{a.risk} risk</span>
                    </div>
                    {a.status === "expiring_soon" && (
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-1.5 py-px inline-flex items-center gap-1">
                        <ClockIcon className="h-2.5 w-2.5" />
                        {a.expiresInHours}h
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white mb-1 leading-snug">{a.title}</p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{a.resources} resource{a.resources !== 1 ? "s" : ""} · {timeSince(a.requestedAt)}</span>
                    {a.monthlySavingsUsd != null && (
                      <span className="text-emerald-400 font-semibold">+${a.monthlySavingsUsd}/mo</span>
                    )}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-zinc-500">No approvals match this filter.</p>
                </div>
              )}
            </div>
          </div>
        </Reveal>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
        <Reveal direction="up" delay={0.14}>
          {active ? <ApprovalDetailPanel approval={active} /> : (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
              <p className="text-sm text-zinc-500">Select an approval from the queue to see the full plan.</p>
            </div>
          )}
        </Reveal>
        </div>
      </div>
    </div>
  );
}

function ApprovalDetailPanel({ approval }: { approval: DemoApproval }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${PROVIDER_COLOR[approval.provider]}`}>{approval.provider}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${ENV_COLOR[approval.environment]}`}>{approval.environment}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${RISK_COLOR[approval.risk]}`}>{approval.risk} risk</span>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{approval.blastRadius} blast</span>
        </div>
        <h3 className="text-xl font-bold text-white tracking-[-0.02em] mb-2">{approval.title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed mb-3">{approval.reason}</p>
        <div className="flex items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 flex-wrap">
          <span>{approval.resources} resource{approval.resources !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>Requested by {approval.requestedBy === "agent" ? "Axiom Agent" : approval.requestedBy}</span>
          <span>·</span>
          <span>{timeSince(approval.requestedAt)}</span>
        </div>
      </div>

      {/* Policy decision */}
      <div className="px-6 py-4 border-b border-white/[0.06] bg-amber-500/[0.03]">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-1">
              Policy decision · {approval.approversRequired} approver{approval.approversRequired !== 1 ? "s" : ""} required
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed">{approval.policyDecisionDetail}</p>
          </div>
        </div>
      </div>

      {/* Blast radius — graph intelligence */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Blast radius · graph analysis</p>
        <div className={`rounded-xl border p-4 ${
          approval.blastRadius === "broad" ? "border-red-500/15 bg-red-500/[0.03]" :
          approval.blastRadius === "moderate" ? "border-amber-500/15 bg-amber-500/[0.03]" :
          "border-emerald-500/15 bg-emerald-500/[0.03]"
        }`}>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold uppercase tracking-wider ${
                approval.blastRadius === "broad" ? "text-red-400" :
                approval.blastRadius === "moderate" ? "text-amber-400" :
                "text-emerald-400"
              }`}>
                {approval.blastRadius} blast radius
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">{approval.resources} direct · 2 indirect dependencies</span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed mb-2">
            {approval.environment === "production"
              ? `Change reaches ${approval.resources} production resource${approval.resources !== 1 ? "s" : ""} and 2 dependent nodes through the dependency graph.`
              : `Change is scoped to ${approval.resources} ${approval.environment} resource${approval.resources !== 1 ? "s" : ""} with shallow dependency depth.`}
          </p>
          <div className="flex items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500 flex-wrap">
            <span>·</span>
            <span>Provider: {approval.provider.toUpperCase()}</span>
            <span>·</span>
            <span>Rollback complexity: {approval.rollbackVerified ? "trivial · pre-flight ready" : "complex · unverified"}</span>
          </div>
        </div>
      </div>

      {/* Plan artifacts */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Plan artifacts</p>
        <div className="grid sm:grid-cols-3 gap-2">
          <ArtifactTile available={approval.hasTerraform} icon={CommandLineIcon} label="Terraform" detail="Phase-by-phase IaC" />
          <ArtifactTile available={approval.hasCli} icon={CommandLineIcon} label="CLI script" detail="Provider commands" />
          <ArtifactTile available={approval.hasDesktopHandoff} icon={CpuChipIcon} label="Desktop handoff" detail="Open in Axiom app" />
        </div>
      </div>

      {/* Rollback readiness */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Rollback readiness</p>
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <ArrowPathIcon className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-white">
                {approval.rollbackVerified ? "Rollback path verified" : "Rollback unverified — blocking"}
              </p>
              <p className="text-xs text-zinc-400">
                {approval.rollbackVerified
                  ? `Measured RTO ${approval.rollbackRtoSec}s · auto-fires on health failure`
                  : "Plan cannot proceed until rollback is verified."}
              </p>
            </div>
          </div>
          <Link href="/docs/rollback" target="_blank" className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
            Rollback strategy →
          </Link>
        </div>
      </div>

      {/* Verification preview */}
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">What will be verified after apply</p>
        <ul className="space-y-1.5 text-xs text-zinc-400">
          {[
            "Resource state matches the plan target",
            "Health checks pass on dependent ALB / SLO targets",
            "Cost shift lands in Cost Explorer within 24 hours",
            "No new drift events on affected resources for 12 hours",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action row */}
      <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <ClockIcon className="h-3.5 w-3.5" />
          Expires in {approval.expiresInHours} hours
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/[0.1] text-zinc-300 text-xs font-semibold hover:bg-white/[0.04] hover:border-white/[0.2] transition-colors">
            <XCircleIcon className="h-3.5 w-3.5" />
            Reject
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/[0.1] text-zinc-300 text-xs font-semibold hover:bg-white/[0.04] hover:border-white/[0.2] transition-colors">
            <ClockIcon className="h-3.5 w-3.5" />
            Snooze 1h
          </button>
          <button
            disabled={!approval.rollbackVerified}
            className={`btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider ${approval.rollbackVerified ? "" : "opacity-40 cursor-not-allowed"}`}
          >
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Approve & apply
          </button>
        </div>
      </div>

      {/* Docs row */}
      <div className="px-6 py-3 bg-white/[0.01] flex items-center justify-between flex-wrap gap-2 text-[11px]">
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
          <Link href="/docs/approval-workflow" target="_blank" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
            How approvals work →
          </Link>
          <Link href="/docs/execution-plans" target="_blank" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
            Execution plan details →
          </Link>
          <Link href="/docs/rollback" target="_blank" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
            Rollback strategy →
          </Link>
        </div>
        <Link href={`/dashboard/execution/${approval.id}`} className="text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1 font-medium">
          Open full execution detail
          <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function ArtifactTile({ available, icon: Icon, label, detail }: { available: boolean; icon: typeof CommandLineIcon; label: string; detail: string }) {
  return (
    <div className={`rounded-xl border p-3 flex items-start gap-2 ${available ? "border-emerald-500/15 bg-emerald-500/[0.03]" : "border-white/[0.06] bg-white/[0.02]"}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${available ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/[0.04] border border-white/[0.08]"}`}>
        <Icon className={`h-3.5 w-3.5 ${available ? "text-emerald-400" : "text-zinc-600"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={`text-xs font-semibold ${available ? "text-white" : "text-zinc-500"}`}>{label}</p>
          {available ? (
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Ready</span>
          ) : (
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">N/A</span>
          )}
        </div>
        <p className={`text-[10px] mt-0.5 ${available ? "text-zinc-500" : "text-zinc-600"}`}>{detail}</p>
      </div>
    </div>
  );
}

// Suppress unused-import warning while DocumentCheckIcon + ExclamationTriangleIcon
// are reserved for future use in the page.
void DocumentCheckIcon;
void ExclamationTriangleIcon;
