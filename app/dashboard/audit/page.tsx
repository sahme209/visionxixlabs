"use client";

import Link from "next/link";
import {
  DocumentTextIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
  ArrowRightIcon,
  UserIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { buildStoryFeed } from "@/lib/audit/auditIntelligence";
import type { AuditStory, StoryRiskLevel } from "@/lib/audit/auditIntelligence";
import type { AuditRecord, AuditAction, AuditOutcome } from "@/lib/audit/secureAudit";
import { BUNDLE_KIND_LABEL } from "@/lib/audit/auditBundle";
import type { AuditBundleKind } from "@/lib/audit/auditBundle";
import { id } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Honest preview records — same shape as the canonical AuditRecord.
// ---------------------------------------------------------------------------

const RAW: { action: AuditAction; outcome?: AuditOutcome; minsAgo: number; correlation: string; actorUserId?: string; entityRef?: string; detail?: Record<string, string | number | boolean>; errorCode?: string }[] = [
  // Story 1: plan -> approval -> export
  { action: "execution_plan.create",  minsAgo: 38, correlation: "plan_s3_close",   actorUserId: "u_alice", entityRef: "plan:plan_s3_close", detail: { risk: "high", steps: 4 } },
  { action: "approval.grant",         minsAgo: 30, correlation: "plan_s3_close",   actorUserId: "u_bob",   entityRef: "approval:apr_42",    detail: { approver: "bob", scope: "any_member" } },
  { action: "execution_plan.submit",  minsAgo: 28, correlation: "plan_s3_close",   actorUserId: "u_alice", entityRef: "plan:plan_s3_close" },
  { action: "execution_plan.export",  minsAgo: 27, correlation: "plan_s3_close",   actorUserId: "u_alice", entityRef: "export:tf_19" },

  // Story 2: AWS scan
  { action: "scan.start",      minsAgo: 95, correlation: "scan_aws_prod", entityRef: "connector:aws-prod", detail: { provider: "aws", regions: 3 } },
  { action: "scan.success",    minsAgo: 90, correlation: "scan_aws_prod", entityRef: "snapshot:snp_a3b1",  detail: { resources: 412, findings: 17 } },

  // Story 3: blocked by policy
  { action: "execution_plan.create", minsAgo: 200, correlation: "plan_iam_tighten", actorUserId: "u_alice", entityRef: "plan:plan_iam", detail: { risk: "high", actionClass: "iam_modification" } },
  { action: "system.error",          minsAgo: 199, correlation: "plan_iam_tighten", actorUserId: "u_alice", entityRef: "plan:plan_iam", outcome: "blocked", errorCode: "policy.requires_security_review" },

  // Story 4: github sync failure
  { action: "connector.validate.attempt", minsAgo: 412, correlation: "github_sync", entityRef: "connector:github" },
  { action: "connector.validate.failure", minsAgo: 411, correlation: "github_sync", entityRef: "connector:github", outcome: "failure", errorCode: "github.5xx" },

  // Story 5: cross-tenant attempt
  { action: "tenant.cross_attempt", minsAgo: 700, correlation: "tenant_probe", actorUserId: "u_probe", entityRef: "execution:other_tenant", outcome: "blocked", detail: { expected: "preview", actual: "other-org" } },

  // Story 6: copilot
  { action: "copilot.query",  minsAgo: 12, correlation: "copilot_q1", actorUserId: "u_alice", entityRef: "conv:c_alice_1", detail: { intent: "informational" } },

  // Story 7: desktop pair + handoff
  { action: "desktop.pair",          minsAgo: 1440, correlation: "desk_pair", actorUserId: "u_alice", entityRef: "desktop:macos_alice" },
  { action: "desktop.handoff.issue", minsAgo: 60,   correlation: "desk_pair", actorUserId: "u_alice", entityRef: "handoff:hf_19", detail: { plan: "plan_s3_close" } },
];

const RECORDS: AuditRecord[] = RAW.map((r, idx) => ({
  id: id.auditEvent(`aud_preview_${idx}`),
  organizationId: id.organization("preview"),
  actorUserId: r.actorUserId ? id.user(r.actorUserId) : undefined,
  actorKind: r.actorUserId ? "user" : "system",
  action: r.action,
  outcome: r.outcome ?? "success",
  entityRef: r.entityRef,
  correlationId: id.correlation(r.correlation),
  source: "preview",
  occurredAt: new Date(Date.now() - r.minsAgo * 60_000).toISOString(),
  detail: r.detail,
  errorCode: r.errorCode,
}));

const STORIES = buildStoryFeed(RECORDS);

export default function AuditCenterPage() {
  const totalStories = STORIES.length;
  const blockedStories = STORIES.filter((s) => s.hasBlockedAction).length;
  const securityStories = STORIES.filter((s) => s.hasSecurityEvent).length;
  const userActorStories = STORIES.filter((s) => s.actors.some((a) => a.kind === "user")).length;

  return (
    <div className="relative">
      {/* Hero */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <DocumentTextIcon className="h-4 w-4 text-fuchsia-400" />
            <p className="text-[10px] font-semibold text-fuchsia-400 uppercase tracking-widest">Audit Center</p>
            <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">
              Preview
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Evidence-backed <span className="text-gradient">audit stories.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-3xl leading-relaxed">
            Every action grouped into a coherent story — actors, policies, approvals, artifacts, outcomes. <span className="dim-1">Exportable as JSON, CSV, or NDJSON for compliance review.</span>
          </p>
        </div>
      </Reveal>

      {/* KPI strip */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Audit stories",      value: String(totalStories),       sub: "in the recent window",                            icon: DocumentTextIcon, semantic: "neutral" },
          { label: "Blocked actions",    value: String(blockedStories),     sub: blockedStories === 0 ? "All actions passed" : "Includes policy + tenant blocks", icon: ExclamationTriangleIcon, semantic: blockedStories > 0 ? "warning" : "success" },
          { label: "Security events",    value: String(securityStories),    sub: "auth / cross-tenant / membership",                icon: ShieldCheckIcon, semantic: securityStories > 0 ? "warning" : "success" },
          { label: "User-led stories",   value: String(userActorStories),   sub: "system actions audited separately",                icon: UserIcon, semantic: "success" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          const tone =
            kpi.semantic === "success" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
            kpi.semantic === "warning" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                                          "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20";
          const iconTone = tone.split(" ")[0];
          return (
            <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`w-9 h-9 rounded-lg ${tone} border flex items-center justify-center mb-3`}>
                <Icon className={`h-4.5 w-4.5 ${iconTone}`} />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight mb-0.5">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 leading-tight">{kpi.label}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{kpi.sub}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Bundle export menu */}
      <Reveal direction="up" delay={0.08}>
        <div className="mb-8 rounded-2xl border border-fuchsia-500/15 bg-gradient-to-br from-fuchsia-500/[0.03] via-transparent to-violet-500/[0.02] p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-fuchsia-500/[0.06] blur-[60px] pointer-events-none" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div>
                <p className="text-[10px] font-semibold text-fuchsia-400 uppercase tracking-widest mb-1">Bundle export</p>
                <h2 className="text-lg font-bold text-white">Compliance-ready evidence packs.</h2>
              </div>
              <span className="text-[11px] text-zinc-500">JSON · CSV · NDJSON (PDF on roadmap)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {(Object.keys(BUNDLE_KIND_LABEL) as AuditBundleKind[]).map((kind) => (
                <div key={kind} className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2 flex items-center gap-2">
                  <ArrowDownTrayIcon className="h-3.5 w-3.5 text-fuchsia-300 shrink-0" />
                  <span className="text-[11px] text-zinc-300 truncate">{BUNDLE_KIND_LABEL[kind]}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 mt-3">All bundles pass through redaction before serialisation — raw credentials, tokens, and private keys are never included.</p>
          </div>
        </div>
      </Reveal>

      {/* Story feed */}
      <Reveal direction="up" delay={0.12}>
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Audit timeline</p>
          <h2 className="text-xl font-bold text-white">{STORIES.length} stories · grouped by correlation id.</h2>
        </div>
      </Reveal>

      <div className="space-y-3 mb-8">
        {STORIES.map((story) => (
          <Reveal key={story.correlationId} direction="up" delay={0.04}>
            <StoryCard story={story} />
          </Reveal>
        ))}
      </div>

      {/* Trust strip */}
      <Reveal direction="up" delay={0.24}>
        <div className="mt-8 rounded-2xl border border-fuchsia-500/15 bg-fuchsia-500/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <CpuChipIcon className="h-4 w-4 text-fuchsia-400" />
            <p className="text-[10px] font-semibold text-fuchsia-400 uppercase tracking-widest">Audit guarantees</p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2 text-xs text-zinc-300">
            {[
              ["Every sensitive action audited",         "API guard wraps the action, records success/failure with correlation ids."],
              ["Cross-tenant attempts logged separately","Mismatched tenants surface as not_found but record a tenant.cross_attempt entry."],
              ["Redaction applied before persistence",   "All free-text fields and metadata pass through canonical redaction before write."],
              ["Approvals tied to plans",                "Every approval grant / deny links to its execution plan in the same story."],
              ["Policy decisions visible",               "Policy evaluations appear in the story timeline alongside the affected action."],
              ["Desktop actions auditable",              "Pairing, handoff, and verification all participate in the audit story."],
              ["Copilot interactions auditable",         "Query, intent, evidence used, and guardrail modifications all recorded."],
              ["Exportable for review",                  "Bundle engine produces JSON / CSV / NDJSON envelopes carrying the full story."],
            ].map(([q, a]) => (
              <li key={q} className="flex items-start gap-2">
                <CheckCircleIcon className="h-3.5 w-3.5 text-fuchsia-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed"><span className="font-semibold text-zinc-100">{q}</span> <span className="dim-1">{a}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* Self-serve links */}
      <Reveal direction="up" delay={0.28}>
        <div className="mt-8 grid sm:grid-cols-3 gap-3">
          {[
            { href: "/dashboard/traces",       label: "Trace viewer",     icon: DocumentTextIcon,   sub: "Span timelines, evidence, and redacted spans for every operation." },
            { href: "/dashboard/security",     label: "Security center",  icon: ShieldCheckIcon,    sub: "Tenant isolation, RBAC, credential health, redaction coverage." },
            { href: "/dashboard/reliability",  label: "Reliability",      icon: ComputerDesktopIcon, sub: "Circuits, retries, dead-letters, and system health." },
          ].map(({ href, label, icon: Icon, sub }) => (
            <Link key={href} href={href} className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-fuchsia-500/25 hover:bg-fuchsia-500/[0.03] transition-colors">
              <Icon className="h-4 w-4 text-fuchsia-400 mb-2" />
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{sub}</p>
            </Link>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

function StoryCard({ story }: { story: AuditStory }) {
  const semantic =
    story.risk === "critical" ? "error" :
    story.risk === "high"     ? "warning" :
    story.risk === "medium"   ? "warning" :
                                 "success";
  const border =
    semantic === "error"   ? "border-red-500/20"   :
    semantic === "warning" ? "border-amber-500/20" :
                              "border-white/[0.06]";
  return (
    <div className={`rounded-2xl border ${border} bg-white/[0.02] overflow-hidden`}>
      <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${riskBadge(story.risk)}`}>
            {story.risk}
          </span>
          <p className="text-sm font-semibold text-white truncate">{story.title}</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono shrink-0">
          {story.actors.map((a) => (
            <span key={`${a.kind}::${a.label}`} className="inline-flex items-center gap-1">
              <UserIcon className="h-3 w-3" /> {a.userId ?? a.label}
            </span>
          ))}
          <span>{formatRelative(story.startedAt)}</span>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-white/[0.05]">
        <p className="text-[12px] text-zinc-400 leading-relaxed">{story.summary}</p>
      </div>

      <div className="px-5 py-3">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Timeline · {story.timeline.length}</p>
        <div className="space-y-1.5">
          {story.timeline.map((t) => (
            <div key={t.recordId} className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                t.outcome === "success" ? "bg-emerald-400" :
                t.outcome === "blocked" ? "bg-amber-400"  :
                                           "bg-red-400"
              }`} />
              <span className="text-[11px] text-zinc-300 font-mono">{t.action}</span>
              <span className="text-[10px] text-zinc-500 truncate flex-1">{t.detailLine ?? ""}</span>
              <span className="text-[10px] text-zinc-500 font-mono shrink-0">{formatRelative(t.occurredAt)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-2.5 bg-white/[0.01] border-t border-white/[0.04] flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5">
          {story.policyApplied && <Badge label="Policy applied" tone="violet" />}
          {story.approvalGranted && <Badge label="Approval granted" tone="emerald" />}
          {story.approvalDenied  && <Badge label="Approval denied" tone="red" />}
          {story.rollbackPrepared && <Badge label="Rollback prepared" tone="cyan" />}
          {story.verificationCompleted && <Badge label="Verification" tone="emerald" />}
          {story.hasBlockedAction && <Badge label="Blocked action" tone="amber" />}
          {story.hasSecurityEvent && <Badge label="Security event" tone="fuchsia" />}
        </div>
        <Link href="/dashboard/traces" className="text-[11px] font-semibold text-fuchsia-300 hover:text-fuchsia-200">
          View trace <ArrowRightIcon className="inline h-3 w-3 ml-0.5 -mt-0.5" />
        </Link>
      </div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "violet" | "emerald" | "amber" | "red" | "cyan" | "fuchsia" }) {
  const map: Record<string, string> = {
    violet:  "text-violet-300 bg-violet-500/10 border-violet-500/20",
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    amber:   "text-amber-300 bg-amber-500/10 border-amber-500/20",
    red:     "text-red-300 bg-red-500/10 border-red-500/20",
    cyan:    "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
    fuchsia: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20",
  };
  return (
    <span className={`text-[9px] font-semibold uppercase tracking-wider border rounded-full px-1.5 py-px ${map[tone]}`}>
      {label}
    </span>
  );
}

function riskBadge(risk: StoryRiskLevel): string {
  switch (risk) {
    case "critical": return "text-red-300 bg-red-500/10 border-red-500/20";
    case "high":     return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "medium":   return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "low":      return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
    case "info":     return "text-zinc-400 bg-white/[0.04] border-white/[0.08]";
  }
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60_000) return `${Math.round(diff / (60 * 60_000))}h ago`;
  return `${Math.round(diff / (24 * 60 * 60_000))}d ago`;
}
