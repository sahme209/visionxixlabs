"use client";

import Link from "next/link";
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  LockClosedIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  CubeTransparentIcon,
  DocumentCheckIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AUTONOMY_LEVELS } from "@/lib/governance/autonomyLevels";
import { DEFAULT_POLICY_PACK } from "@/lib/governance/defaultPolicies";
import type { PolicyCategory, PolicyRule } from "@/lib/governance/policyModel";

// Static demo state — replaced when /api/operations/governance is wired.
const CURRENT_LEVEL = 2;
const ACTIVE_POLICY_PACK = "default";

const CATEGORY_LABEL: Record<PolicyCategory, string> = {
  security: "Security",
  cost: "Cost",
  compliance: "Compliance",
  reliability: "Reliability",
  release_governance: "Release governance",
  execution_safety: "Execution safety",
  desktop_execution: "Desktop execution",
  access_control: "Access control",
  auditability: "Auditability",
  rollback: "Rollback",
  autonomy_boundary: "Autonomy boundary",
};

const CATEGORY_COLOR: Record<PolicyCategory, string> = {
  security: "text-red-400 bg-red-500/10 border-red-500/20",
  cost: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  compliance: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  reliability: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  release_governance: "text-zinc-500 bg-violet-500/10 border-white/[0.08]",
  execution_safety: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  desktop_execution: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  access_control: "text-red-400 bg-red-500/10 border-red-500/20",
  auditability: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  rollback: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
  autonomy_boundary: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function GovernancePage() {
  const policiesByCategory = groupByCategory(DEFAULT_POLICY_PACK);

  return (
    <div className="relative">
      {/* Hero */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">
              Governance Control Center
            </p>
            <span className="text-[9px] font-semibold text-zinc-500 bg-violet-500/15 border border-white/[0.12] rounded-full px-2 py-0.5 uppercase tracking-wider">
              Enterprise · Human-in-the-loop
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Policy & <span className="text-gradient">Autonomy.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-3xl leading-relaxed">
            What Axiom is allowed to do — and what it can never do silently. <span className="dim-1">Every rule is explicit, every decision is auditable, every autonomy change goes through an admin gate.</span>
          </p>
        </div>
      </Reveal>

      {/* Autonomy level + KPIs */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Current autonomy", value: `Level ${CURRENT_LEVEL}`, sub: AUTONOMY_LEVELS[CURRENT_LEVEL].name, icon: LockClosedIcon, color: "text-zinc-500", bg: "bg-violet-500/10 border-white/[0.08]" },
          { label: "Active policy pack", value: ACTIVE_POLICY_PACK, sub: `${DEFAULT_POLICY_PACK.length} rules · ${DEFAULT_POLICY_PACK.filter((r) => r.enabled).length} active`, icon: DocumentCheckIcon, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Blocked actions", value: "0", sub: "Past 24h · no violations", icon: ShieldExclamationIcon, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Pending policy approvals", value: "3", sub: "1 production · 2 staging", icon: ShieldCheckIcon, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`w-9 h-9 rounded-lg ${kpi.bg} border flex items-center justify-center mb-3`}>
                <Icon className={`h-4.5 w-4.5 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight mb-0.5">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 leading-tight">{kpi.label}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{kpi.sub}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Autonomy ladder */}
      <Reveal direction="up" delay={0.08}>
        <div className="mb-8 rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.04] via-transparent to-fuchsia-500/[0.03] p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/[0.025] blur-[60px] pointer-events-none" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div>
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Autonomy ladder</p>
                <h2 className="text-lg font-bold text-white">Axiom can never silently escalate.</h2>
              </div>
              <Link href="/docs/approval-workflow" target="_blank" className="text-[11px] font-semibold text-zinc-300 hover:text-white transition-colors">
                How autonomy works →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {AUTONOMY_LEVELS.map((spec) => {
                const isCurrent = spec.level === CURRENT_LEVEL;
                return (
                  <div
                    key={spec.level}
                    className={`rounded-xl border p-3 transition-all ${
                      isCurrent
                        ? "border-violet-500/40 bg-white/[0.025] shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                        : "border-white/[0.06] bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded-full border ${
                          isCurrent ? "text-violet-300 bg-violet-500/15 border-white/[0.12]" : "text-zinc-500 bg-white/[0.04] border-white/[0.06]"
                        }`}>
                          Level {spec.level}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold text-emerald-400 inline-flex items-center gap-1">
                            <CheckCircleIcon className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </div>
                      {spec.requiresExplicitOptIn && !isCurrent && (
                        <span className="text-[9px] font-semibold text-amber-400 inline-flex items-center gap-0.5">
                          <LockClosedIcon className="h-2.5 w-2.5" />
                          Opt-in
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-white mb-1">{spec.name}</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed mb-2">{spec.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {spec.capabilities.slice(0, 4).map((cap) => (
                        <span key={cap} className="text-[9px] text-emerald-400/80 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-full px-1.5 py-px">
                          ✓ {cap.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Policy rules — grouped */}
      <Reveal direction="up" delay={0.12}>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Policy rules</p>
              <h2 className="text-xl font-bold text-white">{DEFAULT_POLICY_PACK.length} rules across {Object.keys(policiesByCategory).length} categories.</h2>
            </div>
            <Link href="/docs/permissions-model" target="_blank" className="text-[11px] font-semibold text-zinc-300 hover:text-white transition-colors">
              Permissions model →
            </Link>
          </div>
        </div>
      </Reveal>

      <div className="space-y-5">
        {Object.entries(policiesByCategory).map(([category, rules]) => (
          <Reveal key={category} direction="up" delay={0.05}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${CATEGORY_COLOR[category as PolicyCategory]}`}>
                    {CATEGORY_LABEL[category as PolicyCategory]}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">{rules.length} rule{rules.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {rules.map((rule) => (
                  <PolicyRuleRow key={rule.id} rule={rule} />
                ))}
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Footer trust strip */}
      <Reveal direction="up" delay={0.2}>
        <div className="mt-8 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Enterprise trust guarantees</p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2 text-xs text-zinc-300">
            {[
              "No silent autonomy escalation — admin role required for every level change",
              "No policy bypass — every action evaluated by the engine",
              "No high-risk action without approval",
              "No destructive action without rollback review",
              "No execution without an audit event",
              "No desktop apply without local user confirmation",
              "No ReleaseOps production deploy without governance review",
              "No hidden policy logic — every rule visible on this page",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  );
}

function PolicyRuleRow({ rule }: { rule: PolicyRule }) {
  const decisionColor =
    rule.decision === "block" ? "text-red-400 bg-red-500/10 border-red-500/20" :
    rule.decision === "require_approval" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

  const severityColor =
    rule.severity === "critical" ? "text-red-400" :
    rule.severity === "high" ? "text-amber-400" :
    rule.severity === "medium" ? "text-amber-400/80" :
    "text-zinc-500";

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] px-4 py-3 hover:border-white/[0.12] transition-colors">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${decisionColor}`}>
            {rule.decision.replace(/_/g, " ")}
          </span>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${severityColor}`}>
            {rule.severity}
          </span>
          {rule.requireRollback && (
            <span className="text-[9px] font-semibold text-fuchsia-400 inline-flex items-center gap-0.5">
              <ArrowPathIcon className="h-2.5 w-2.5" />
              rollback
            </span>
          )}
          {rule.requireAudit && (
            <span className="text-[9px] font-semibold text-emerald-400 inline-flex items-center gap-0.5">
              <DocumentCheckIcon className="h-2.5 w-2.5" />
              audit
            </span>
          )}
          {rule.requireVerifications && rule.requireVerifications.length > 0 && (
            <span className="text-[9px] font-semibold text-blue-400 inline-flex items-center gap-0.5">
              <CheckCircleIcon className="h-2.5 w-2.5" />
              verify
            </span>
          )}
        </div>
        <span className="text-[10px] text-zinc-600 font-mono">{rule.id}</span>
      </div>
      <p className="text-sm font-semibold text-white mb-0.5 leading-snug">{rule.name}</p>
      <p className="text-xs text-zinc-500 leading-relaxed">{rule.description}</p>
      {rule.requiredApproverRole && (
        <p className="text-[10px] text-zinc-600 mt-1.5">
          Approver: <span className="text-zinc-400">{rule.requiredApproverRole.replace(/_/g, " ")}</span>
          {rule.requiredApprovers && rule.requiredApprovers > 1 && <span className="text-zinc-400"> · {rule.requiredApprovers} required</span>}
        </p>
      )}
    </div>
  );
}

function groupByCategory(rules: PolicyRule[]): Record<string, PolicyRule[]> {
  const out: Record<string, PolicyRule[]> = {};
  for (const r of rules) {
    (out[r.category] ??= []).push(r);
  }
  return out;
}

// Suppress unused import warnings for icons reserved for future use.
void XCircleIcon;
void CubeTransparentIcon;
void Cog6ToothIcon;
void ArrowRightIcon;
