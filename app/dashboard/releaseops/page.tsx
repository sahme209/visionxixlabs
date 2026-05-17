"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  BoltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CloudArrowDownIcon,
  CommandLineIcon,
  CpuChipIcon,
  DocumentCheckIcon,
  EyeIcon,
  LockClosedIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { ActivityFeed, type ActivityEvent } from "@/components/operations/ActivityFeed";
import { ReleasePipelineGrid } from "@/components/operations/ReleasePipelineGrid";
import { ReadinessScoreCard } from "@/components/operations/ReadinessScoreCard";
import { evaluateBlockers, BLOCKER_KIND_LABEL } from "@/lib/releaseops/deploymentBlockers";
import { assessReleaseRisk, RISK_LABEL, riskSemantic } from "@/lib/releaseops/releaseRisk";

// ReleaseOps-specific demo event stream — mixes release/Terraform/approval events
const NOW = Date.now();
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

const RELEASE_EVENTS: ActivityEvent[] = [
  {
    id: "re1",
    type: "release.approval_pending",
    title: "Approval required: payments-api v4.12.0",
    description: "2 approvers required · production · ServiceNow CR-8421 open",
    provider: "system",
    severity: "high",
    timestamp: minAgo(2),
    metadata: { service: "payments-api", env: "production", approvers: 2 },
  },
  {
    id: "re2",
    type: "release.terraform_plan",
    title: "Terraform plan generated · infra/vpc-peering",
    description: "+12 add · ~3 change · -0 destroy · plan validated · rollback ready",
    provider: "aws",
    timestamp: minAgo(6),
    metadata: { add: 12, change: 3, destroy: 0 },
  },
  {
    id: "re3",
    type: "release.drift_detected",
    title: "Pipeline drift detected: checkout-frontend",
    description: "Required reviewers config changed outside Axiom · 2 protections removed",
    provider: "system",
    severity: "high",
    timestamp: minAgo(11),
    metadata: { service: "checkout-frontend" },
  },
  {
    id: "re4",
    type: "release.deployed",
    title: "data-pipeline shipped to production",
    description: "Canary 1% → 10% → 50% → 100% completed in 18 minutes · zero error rate",
    provider: "aws",
    timestamp: minAgo(28),
    metadata: { service: "data-pipeline", duration: "18m" },
  },
  {
    id: "re5",
    type: "release.verification_passed",
    title: "Post-execution verification passed",
    description: "data-pipeline · zero drift · SLO unchanged · cost shift within bounds",
    provider: "system",
    timestamp: minAgo(31),
    metadata: { service: "data-pipeline" },
  },
  {
    id: "re6",
    type: "release.blocked",
    title: "auth-gateway v2.8.1 blocked at governance gate",
    description: "Composite readiness 62 below threshold 75 · rollback unverified · escalating",
    provider: "system",
    severity: "high",
    timestamp: minAgo(46),
    metadata: { service: "auth-gateway", score: 62 },
  },
  {
    id: "re7",
    type: "release.readiness_dropped",
    title: "Readiness score dropped for auth-gateway",
    description: "Incident on 2026-05-09 lowered rollback dimension to 0.42 · agent recalibrated",
    provider: "system",
    timestamp: minAgo(60),
    metadata: { service: "auth-gateway", delta: "-7 pts" },
  },
  {
    id: "re8",
    type: "release.servicenow_synced",
    title: "ServiceNow CR-8421 synchronized",
    description: "Risk justification + rollback strategy attached · auto-close on verification",
    provider: "system",
    timestamp: minAgo(82),
    metadata: { cr: "CR-8421" },
  },
  {
    id: "re9",
    type: "release.assessed",
    title: "Readiness assessment completed: 16 services scored",
    description: "Fleet average 82.5 · 2 services below threshold · 1 service trending down",
    provider: "system",
    timestamp: minAgo(120),
    metadata: { services: 16, avg: 82.5 },
  },
  {
    id: "re10",
    type: "release.config_mismatch",
    title: "Runtime config mismatch: billing-worker",
    description: "staging has FEATURE_NEW_BILLING_PATH=true · production has false · awaiting alignment",
    provider: "system",
    severity: "medium",
    timestamp: minAgo(180),
    metadata: { service: "billing-worker" },
  },
];

// CI/CD connector status
const CONNECTORS = [
  { id: "github", label: "GitHub Actions", status: "connected", repos: 14, pipelines: 47 },
  { id: "gitlab", label: "GitLab CI", status: "connected", repos: 4, pipelines: 11 },
  { id: "azure_devops", label: "Azure DevOps", status: "connected", repos: 6, pipelines: 18 },
  { id: "jenkins", label: "Jenkins", status: "connected", repos: 3, pipelines: 12 },
  { id: "argocd", label: "ArgoCD", status: "syncing", repos: 8, pipelines: 22 },
  { id: "servicenow", label: "ServiceNow", status: "connected", repos: undefined, pipelines: undefined },
];

const CONNECTOR_STATUS_COLOR = {
  connected: { dot: "bg-emerald-400", label: "Connected", text: "text-emerald-400" },
  syncing: { dot: "bg-blue-400 animate-pulse", label: "Syncing", text: "text-blue-400" },
  disconnected: { dot: "bg-zinc-500", label: "Disconnected", text: "text-zinc-500" },
} as const;

// Environment coordination data
const ENVIRONMENTS = [
  { name: "Production", count: 16, healthy: 13, atRisk: 2, blocked: 1, color: "red" },
  { name: "Staging", count: 16, healthy: 15, atRisk: 1, blocked: 0, color: "amber" },
  { name: "Development", count: 16, healthy: 16, atRisk: 0, blocked: 0, color: "blue" },
];

const ENV_BG = {
  red: "bg-red-500/10 border-red-500/20 text-red-400",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
} as const;

export default function ReleaseOpsCommandCenterPage() {
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const update = () =>
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      {/* Hero header */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-zinc-500" />
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                ReleaseOps · source mode reported by /api/releaseops/state
              </p>
              <span className="text-[9px] font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5 uppercase tracking-wider">
                Axiom · Capability surface
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {currentTime || "—:—:—"} local
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            ReleaseOps <span className="text-gradient">Command Center.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-3xl leading-relaxed">
            Deployment intelligence across every connected CI/CD system. <span className="dim-1">Live pipelines · readiness scoring · approval orchestration · drift detection · rollback readiness.</span> <span className="dim-2">Axiom orchestrates above your existing tooling — it does not replace it.</span>
          </p>
        </div>
      </Reveal>

      {/* Top metrics row */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Active pipelines", value: "8", trend: "3 running · 2 awaiting", trendColor: "text-blue-400", icon: BoltIcon, bg: "bg-blue-500/10 border-blue-500/20", iconColor: "text-blue-400" },
          { label: "Fleet readiness", value: "82.5", trend: "+1.8 pts this week", trendColor: "text-emerald-400", icon: ShieldCheckIcon, bg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-400" },
          { label: "Services below threshold", value: "2", trend: "1 critical · 1 watch", trendColor: "text-amber-400", icon: ShieldExclamationIcon, bg: "bg-amber-500/10 border-amber-500/20", iconColor: "text-amber-400" },
          { label: "Approvals pending", value: "5", trend: "2 production · 3 staging", trendColor: "text-amber-400", icon: LockClosedIcon, bg: "bg-amber-500/10 border-amber-500/20", iconColor: "text-amber-400" },
          { label: "Deployments today", value: "14", trend: "94% success · 1 rollback", trendColor: "text-emerald-400", icon: RocketLaunchIcon, bg: "bg-violet-500/10 border-violet-500/20", iconColor: "text-violet-400" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-white/[0.12] transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${kpi.bg} border flex items-center justify-center`}>
                  <Icon className={`h-4.5 w-4.5 ${kpi.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white tracking-tight mb-1">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 leading-tight">{kpi.label}</p>
              <p className={`text-[10px] mt-2 font-medium ${kpi.trendColor}`}>{kpi.trend}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Active pipelines (full width) */}
      <Reveal direction="up" delay={0.1}>
        <div className="mb-6">
          <ReleasePipelineGrid />
        </div>
      </Reveal>

      {/* Release risk panel — typed engine output */}
      <Reveal direction="up" delay={0.11}>
        <div className="mb-6">
          <ReleaseRiskPanel />
        </div>
      </Reveal>

      {/* Main grid: readiness on left, event feed + sidebars on right */}
      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Readiness */}
          <Reveal direction="up" delay={0.12}>
            <ReadinessScoreCard />
          </Reveal>

          {/* Activity feed scoped to ReleaseOps */}
          <Reveal direction="up" delay={0.16}>
            <ActivityFeed events={RELEASE_EVENTS} title="ReleaseOps activity" />
          </Reveal>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Environments */}
          <Reveal direction="up" delay={0.1}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01]">
                <h3 className="text-sm font-semibold text-white">Environment coordination</h3>
              </div>
              <div className="p-3 space-y-2">
                {ENVIRONMENTS.map((e) => (
                  <div key={e.name} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${ENV_BG[e.color as keyof typeof ENV_BG]}`}>
                          {e.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">{e.count} services</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-center">
                        <p className="text-sm font-bold text-emerald-400">{e.healthy}</p>
                        <p className="text-[8px] text-emerald-400/70 uppercase tracking-wider font-semibold">Healthy</p>
                      </div>
                      <div className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-1 text-center">
                        <p className="text-sm font-bold text-amber-400">{e.atRisk}</p>
                        <p className="text-[8px] text-amber-400/70 uppercase tracking-wider font-semibold">At risk</p>
                      </div>
                      <div className="rounded bg-red-500/10 border border-red-500/20 px-2 py-1 text-center">
                        <p className="text-sm font-bold text-red-400">{e.blocked}</p>
                        <p className="text-[8px] text-red-400/70 uppercase tracking-wider font-semibold">Blocked</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* CI/CD Integrations */}
          <Reveal direction="up" delay={0.14}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.01]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">CI/CD integrations</h3>
                  <span className="text-[10px] text-zinc-500 font-mono">{CONNECTORS.length} connected</span>
                </div>
              </div>
              <div className="p-3 space-y-1.5">
                {CONNECTORS.map((c) => {
                  const cfg = CONNECTOR_STATUS_COLOR[c.status as keyof typeof CONNECTOR_STATUS_COLOR];
                  return (
                    <div key={c.id} className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 hover:border-white/[0.08] transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-white">{c.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          <span className={`text-[9px] font-semibold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
                        </div>
                      </div>
                      {c.repos != null && (
                        <p className="text-[10px] text-zinc-500 font-mono">
                          {c.repos} repos · {c.pipelines} pipelines
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-3 pb-3">
                <Link
                  href="/contact?topic=releaseops"
                  className="flex items-center justify-center gap-1.5 w-full text-[11px] text-zinc-400 hover:text-white border border-dashed border-white/[0.1] hover:border-white/[0.2] rounded-xl py-2.5 transition-colors"
                >
                  + Connect another system
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Platform Integration Quick Actions */}
          <Reveal direction="up" delay={0.18}>
            <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.04] via-transparent to-fuchsia-500/[0.03] p-4 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-violet-500/[0.06] blur-[40px] pointer-events-none" aria-hidden />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <CpuChipIcon className="h-4 w-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">Cross-platform jump</h3>
                </div>
                <div className="space-y-1.5">
                  {[
                    { href: "/dashboard/topology", icon: ArrowsRightLeftIcon, label: "Infra topology", desc: "Live cloud map" },
                    { href: "/dashboard/workflows", icon: BoltIcon, label: "Workflows", desc: "Continuous ops" },
                    { href: "/dashboard/memory", icon: ChartBarIcon, label: "Memory", desc: "Operational history" },
                    { href: "/dashboard/command-center", icon: EyeIcon, label: "Cloud command center", desc: "Infra ops" },
                    { href: "/axiom/releaseops", icon: DocumentCheckIcon, label: "ReleaseOps overview", desc: "Capability docs" },
                  ].map((a) => {
                    const Icon = a.icon;
                    return (
                      <Link
                        key={a.label}
                        href={a.href}
                        className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white transition-colors shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-zinc-300 group-hover:text-white transition-colors font-medium">{a.label}</p>
                            <p className="text-[10px] text-zinc-600">{a.desc}</p>
                          </div>
                        </div>
                        <ArrowRightIcon className="h-3 w-3 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Operating principle */}
          <Reveal direction="up" delay={0.22}>
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Orchestration principle</p>
              </div>
              <p className="text-sm font-semibold text-white mb-1">Above. Never instead.</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Axiom does not replace GitHub, GitLab, Azure DevOps, Jenkins, Terraform, Kubernetes, or ServiceNow. <span className="text-zinc-500">It coordinates, analyzes, governs, scores, and orchestrates them — adding the operational intelligence layer they don&apos;t ship with.</span>
              </p>
            </div>
          </Reveal>

          {/* Documentation links */}
          <Reveal direction="up" delay={0.26}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Learn ReleaseOps</p>
              <div className="space-y-1">
                {[
                  { href: "/docs/releaseops", label: "ReleaseOps overview" },
                  { href: "/docs/releaseops/connectors", label: "CI/CD connectors" },
                  { href: "/docs/releaseops/readiness", label: "Readiness scoring" },
                  { href: "/docs/approval-workflow", label: "Approval workflow" },
                  { href: "/docs/security-model", label: "Security model" },
                ].map((doc) => (
                  <Link
                    key={doc.href}
                    href={doc.href}
                    className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-white/[0.04] transition-colors group"
                  >
                    <span className="text-[11px] text-zinc-400 group-hover:text-white transition-colors">{doc.label}</span>
                    <ArrowRightIcon className="h-3 w-3 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Footer principle bar */}
      <Reveal direction="up" delay={0.28}>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <CommandLineIcon className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Operate releases from your workstation</p>
              <p className="text-[11px] text-zinc-500">Axiom desktop surfaces approvals, readiness shifts, and rollback orchestration natively · no browser required</p>
            </div>
          </div>
          <Link
            href="/download"
            className="btn-amber-shimmer inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold"
          >
            Download desktop agent
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Reveal>

      {/* Trust footer strip */}
      <Reveal direction="up" delay={0.32}>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[10px] text-zinc-500">
          {[
            { label: "Approval-gated execution", icon: LockClosedIcon },
            { label: "Least-privilege by default", icon: ShieldCheckIcon },
            { label: "Immutable audit trail", icon: DocumentCheckIcon },
            { label: "Pre-verified rollback", icon: CloudArrowDownIcon },
            { label: "Outcome-driven confidence", icon: CheckCircleIcon },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <span key={t.label} className="inline-flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-emerald-500" />
                {t.label}
              </span>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Release risk panel — typed engine output (deploymentBlockers + releaseRisk)
// ---------------------------------------------------------------------------

function ReleaseRiskPanel() {
  // Honest preview release — same shape the engines run on in production.
  const release = {
    id: "rel_payments_4120",
    service: "payments-api",
    repositoryId: "repo_payments",
    pipelineId: "pipe_payments_prod",
    system: "github" as const,
    environment: "production" as const,
    status: "awaiting_approval" as const,
    ref: "main",
    commit: "9a7e1c4",
    author: "alice@example.com",
    startedAt: new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
    blastRadius: "moderate" as const,
    approvals: [
      { id: "apr_1", source: "github" as const, approver: "bob", approvedAt: new Date(Date.now() - 30 * 60_000).toISOString(), required: true },
      { id: "apr_2", source: "github" as const, approver: "—",   required: true },
    ],
    rollback: { verified: false, strategy: "redeploy_prior" as const, priorReleaseId: "rel_payments_4119", rtoSec: 180 },
  };
  const readiness = {
    serviceId: "svc_payments",
    serviceName: "payments-api",
    team: "payments",
    environment: "production" as const,
    compositeScore: 68,
    trend: "up" as const,
    dimensions: [
      { key: "branch_governance"        as const, label: "Branch governance",        score: 0.85, detail: "Required reviewers + signed commits in place." },
      { key: "rollback_readiness"       as const, label: "Rollback readiness",       score: 0.40, detail: "Rollback strategy defined but unverified." },
      { key: "observability"            as const, label: "Observability",            score: 0.70, detail: "Metrics + traces emitted; alerts wired." },
      { key: "deployment_maturity"      as const, label: "Deployment maturity",      score: 0.75, detail: "Canary supported; auto-rollback configured." },
      { key: "release_auditability"     as const, label: "Release auditability",     score: 0.90, detail: "Every release fully audited." },
    ],
    rollbackVerified: false,
  };
  const blockers = evaluateBlockers({
    release,
    branchProtections: [
      { branch: "main", requiredReviewers: 1, requireCodeOwnerReviews: false, requireLinearHistory: true, requireSignedCommits: false, requireStatusChecks: ["build", "test"], enforceAdmins: true },
    ],
    readiness,
    hasFreshTerraformPlan: true,
    driftDetected: false,
    hasOpenIncident: false,
  });
  const risk = assessReleaseRisk({ release, readiness, blockers });

  const semantic = riskSemantic(risk.level);
  const tone =
    semantic === "error"   ? "border-red-500/20 bg-red-500/[0.04]"   :
    semantic === "warning" ? "border-amber-500/20 bg-amber-500/[0.04]" :
                             "border-emerald-500/20 bg-emerald-500/[0.04]";

  return (
    <div className={`rounded-2xl border ${tone} p-6 overflow-hidden`}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 mb-1">
            Release risk · payments-api v4.12.0
          </p>
          <h2 className="text-lg font-bold text-white tracking-[-0.03em]">
            {RISK_LABEL[risk.level]} · {risk.score}/100 · {risk.shouldBlock ? "blocked" : risk.requiresApproval ? "needs approval" : "ready"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {risk.safeNextAction && (
            <Link
              href={risk.safeNextAction.href}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] text-xs font-semibold"
            >
              {risk.safeNextAction.label}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
      <p className="text-sm text-zinc-300 mb-4 leading-relaxed">{risk.summary}</p>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-2">Contributing factors</p>
          <div className="space-y-1.5">
            {risk.factors.slice(0, 5).map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-12 h-1.5 rounded-full bg-white/[0.04] overflow-hidden mt-1.5 shrink-0">
                  <div className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${Math.min(100, f.weight * 2)}%` }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-zinc-200">{f.label}</p>
                  <p className="text-[11px] text-zinc-500 whitespace-pre-line">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-2">
            Deployment blockers · {blockers.length}
          </p>
          {blockers.length === 0 ? (
            <p className="text-[12px] text-emerald-300">No blockers — release is structurally clean.</p>
          ) : (
            <div className="space-y-1.5">
              {blockers.slice(0, 5).map((b) => (
                <div key={b.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[12px] font-semibold text-zinc-100 truncate">{b.title}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px shrink-0 ${
                      b.severity === "critical" ? "text-red-300 bg-red-500/10 border-red-500/20" :
                      b.severity === "high"     ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                      b.severity === "medium"   ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                                                  "text-zinc-400 bg-zinc-700/30 border-zinc-700/40"
                    }`}>{b.severity}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{b.detail}</p>
                  <p className="text-[10px] text-zinc-600 mt-1">{BLOCKER_KIND_LABEL[b.kind]}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
