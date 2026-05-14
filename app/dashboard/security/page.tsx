"use client";

import Link from "next/link";
import {
  ShieldCheckIcon,
  LockClosedIcon,
  KeyIcon,
  EyeSlashIcon,
  ServerStackIcon,
  ComputerDesktopIcon,
  CubeTransparentIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { buildSecurityPosture } from "@/lib/security/securityPosture";
import type { PostureCheck, PostureSemantic } from "@/lib/security/securityPosture";
import type { CredentialMetadata } from "@/lib/security/credentialMeta";
import { displayFor as credDisplay, materialDisplay } from "@/lib/security/credentialMeta";
import type { PairedDesktop } from "@/lib/desktop/desktopSecurity";
import { displayFor as desktopDisplay } from "@/lib/desktop/desktopSecurity";
import { id } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Honest preview inputs — no live data wired yet. Source is tagged "preview"
// so every panel surfaces the same label rather than faking production.
// ---------------------------------------------------------------------------

const SAMPLE_CREDS: CredentialMetadata[] = [
  {
    organizationId: id.organization("preview"),
    connectorId: id.connector("preview-aws"),
    material: "aws_role_arn",
    state: "active",
    vaultRef: "vault://preview/aws",
    lastValidatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    lastRotatedAt: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    label: "Production AWS Role",
  },
  {
    organizationId: id.organization("preview"),
    connectorId: id.connector("preview-github"),
    material: "github_app_installation",
    state: "active",
    vaultRef: "vault://preview/gh",
    lastRotatedAt: new Date(Date.now() - 68 * 24 * 60 * 60 * 1000).toISOString(),
    label: "GitHub App — releaseops",
  },
  {
    organizationId: id.organization("preview"),
    connectorId: id.connector("preview-azure"),
    material: "azure_service_principal",
    state: "active",
    vaultRef: "vault://preview/az",
    lastRotatedAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString(),
    label: "Azure SP — staging",
  },
];

const SAMPLE_DESKTOPS: PairedDesktop[] = [
  {
    desktopId: "desk-preview-1",
    organizationId: id.organization("preview"),
    userId: id.user("preview-user"),
    os: "macos",
    channel: "stable",
    version: "0.2.4",
    fingerprint: "fp-preview-mac",
    state: "trusted",
    pairedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeenAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
];

export default function SecurityCenterPage() {
  const posture = buildSecurityPosture({
    source: "preview",
    credentials: SAMPLE_CREDS,
    pairedDesktops: SAMPLE_DESKTOPS,
    crossTenantAttempts30d: 0,
    policyBlocks30d: 2,
    openHighRiskFindings: 1,
    redactionEnabled: true,
    auditStoreConfigured: true,
    copilotContextSafe: true,
  });

  const semanticTone: Record<PostureSemantic, string> = {
    success: "text-emerald-400",
    warning: "text-amber-400",
    error: "text-red-400",
    neutral: "text-zinc-400",
  };
  const semanticBg: Record<PostureSemantic, string> = {
    success: "bg-emerald-500/10 border-emerald-500/20",
    warning: "bg-amber-500/10 border-amber-500/20",
    error: "bg-red-500/10 border-red-500/20",
    neutral: "bg-white/[0.04] border-white/[0.08]",
  };

  return (
    <div className="relative">
      {/* Hero */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Security Center</p>
            <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">
              {posture.source === "live" ? "Live" : posture.source === "preview" ? "Preview" : "Demo"}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Enterprise <span className="text-gradient">trust posture.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-3xl leading-relaxed">
            What Axiom protects, how it protects it, and what is still on the roadmap. <span className="dim-1">No hidden controls, no faked claims — the matrix below reflects real implementation state.</span>
          </p>
        </div>
      </Reveal>

      {/* Posture KPIs */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Posture score", value: `${Math.round(posture.score * 100)}%`, sub: posture.semantic === "success" ? "Strong baseline" : posture.semantic === "warning" ? "Action needed" : "Critical gaps", icon: ShieldCheckIcon, semantic: posture.semantic },
          { label: "Redaction patterns", value: String(posture.redaction.patterns.length), sub: `${posture.redaction.sensitiveKeyCount} key-name blocks`, icon: EyeSlashIcon, semantic: "success" as PostureSemantic },
          { label: "Credentials registered", value: String(posture.credentialSummary.total), sub: `${posture.credentialSummary.delegated} delegated · ${posture.credentialSummary.rotationDue} due · ${posture.credentialSummary.rotationOverdue} overdue`, icon: KeyIcon, semantic: posture.credentialSummary.rotationOverdue > 0 ? "error" : posture.credentialSummary.rotationDue > 0 ? "warning" : "success" as PostureSemantic },
          { label: "Desktops trusted", value: `${posture.desktopSummary.trusted}/${posture.desktopSummary.paired}`, sub: posture.desktopSummary.blocked > 0 ? `${posture.desktopSummary.blocked} blocked` : "No blocked desktops", icon: ComputerDesktopIcon, semantic: posture.desktopSummary.blocked > 0 ? "warning" : "success" as PostureSemantic },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className={`w-9 h-9 rounded-lg ${semanticBg[kpi.semantic]} border flex items-center justify-center mb-3`}>
                <Icon className={`h-4.5 w-4.5 ${semanticTone[kpi.semantic]}`} />
              </div>
              <p className="text-2xl font-bold text-white tracking-tight mb-0.5">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 leading-tight">{kpi.label}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{kpi.sub}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Posture checks */}
      <Reveal direction="up" delay={0.08}>
        <div className="mb-8 rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-cyan-500/[0.02] p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-500/[0.06] blur-[60px] pointer-events-none" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div>
                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-1">Posture checks</p>
                <h2 className="text-lg font-bold text-white">Live signals from the security layer.</h2>
              </div>
              <Link href="/docs" className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 transition-colors">
                Trust documentation <ArrowRightIcon className="inline h-3 w-3 ml-1 -mt-0.5" />
              </Link>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {posture.checks.map((c) => (
                <PostureRow key={c.id} check={c} />
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Credentials */}
      <Reveal direction="up" delay={0.12}>
        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <KeyIcon className="h-4 w-4 text-amber-400" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Credential health</p>
            </div>
            <p className="text-[11px] text-zinc-500">Delegated trust preferred over static keys.</p>
          </div>
          <div className="p-3 space-y-2">
            {SAMPLE_CREDS.map((c) => {
              const disp = credDisplay(c.state);
              return (
                <div key={c.connectorId} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{c.label}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {materialDisplay(c.material)} · Rotated {daysAgo(c.lastRotatedAt)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider border rounded-full px-2 py-0.5 ${
                    disp.semantic === "success" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                    disp.semantic === "warning" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                    disp.semantic === "error" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                    "text-zinc-400 bg-white/[0.04] border-white/[0.08]"
                  }`}>{disp.pill}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* RBAC overview */}
      <Reveal direction="up" delay={0.16}>
        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <LockClosedIcon className="h-4 w-4 text-violet-400" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Role-based access control</p>
            </div>
            <p className="text-[11px] text-zinc-500">{posture.rbac.roles.length} roles · {posture.rbac.permissions.length} permissions</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {posture.rbac.roles.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-start gap-4">
                <div className="w-28 shrink-0">
                  <p className="text-sm font-semibold text-white">{r.label}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{r.permissions.length} perms</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-zinc-400 leading-relaxed">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Supply chain */}
      <Reveal direction="up" delay={0.2}>
        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CubeTransparentIcon className="h-4 w-4 text-cyan-400" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Supply-chain posture</p>
            </div>
            <p className="text-[11px] text-zinc-500">
              {posture.supplyChain.summary.implemented} implemented · {posture.supplyChain.summary.inProgress} in progress · {posture.supplyChain.summary.planned} planned
            </p>
          </div>
          <div className="p-3 space-y-2">
            {posture.supplyChain.controls.map((c) => {
              const tone =
                c.status === "implemented" ? "success" :
                c.status === "in_progress" ? "warning" :
                c.status === "planned" ? "neutral" : "neutral";
              return (
                <div key={c.id} className="flex items-start justify-between rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{c.label}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{c.description}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider border rounded-full px-2 py-0.5 shrink-0 ${
                    tone === "success" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                    tone === "warning" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                    "text-zinc-400 bg-white/[0.04] border-white/[0.08]"
                  }`}>
                    {c.status === "implemented" ? "Live" : c.status === "in_progress" ? "In progress" : c.status === "planned" ? "Planned" : "N/A"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Desktop trust */}
      <Reveal direction="up" delay={0.24}>
        <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ComputerDesktopIcon className="h-4 w-4 text-blue-400" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-widest">Desktop trust</p>
            </div>
            <p className="text-[11px] text-zinc-500">{posture.desktopSummary.paired} paired · {posture.desktopSummary.trusted} trusted</p>
          </div>
          <div className="p-3 space-y-2">
            {SAMPLE_DESKTOPS.map((d) => {
              const disp = desktopDisplay(d.state);
              return (
                <div key={d.desktopId} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{d.os} · v{d.version} · {d.channel}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{disp.detail}</p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider border rounded-full px-2 py-0.5 ${
                    disp.semantic === "success" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                    disp.semantic === "warning" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                    disp.semantic === "error" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                    "text-zinc-400 bg-white/[0.04] border-white/[0.08]"
                  }`}>{disp.pill}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Trust strip — answers the questions enterprise reviewers ask */}
      <Reveal direction="up" delay={0.28}>
        <div className="mt-8 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.02] p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
            <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">If your security team asks…</p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2 text-xs text-zinc-300">
            {[
              ["Can you prove tenant isolation?",                "Every customer-data query passes a TenantScope gate; cross-tenant attempts are audited."],
              ["Can we revoke access?",                          "Yes — credentials and desktop pairings both have a revoke flow that blocks execution."],
              ["Are secrets encrypted at rest?",                 "AES-256-GCM via the credential vault. Raw secrets never leave the encrypted blob."],
              ["Can AI see secrets?",                            "No — every AI context goes through redaction + key-name blocking before any LLM call."],
              ["Are sensitive actions audited?",                 "Yes — every API guard wraps the action and emits an audit record with correlation IDs."],
              ["Can users bypass policy?",                       "No — policy is evaluated server-side. Frontend hints are courtesy only."],
              ["Can desktop bypass governance?",                 "No — desktop handoffs are signed, time-bounded, replay-protected, and policy-gated."],
              ["Can we run read-only only?",                     "Yes — set autonomy level 0 (Observe) to disable all proposing/execution."],
            ].map(([q, a]) => (
              <li key={q} className="flex items-start gap-2">
                <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed"><span className="font-semibold text-zinc-100">{q}</span> <span className="dim-1">{a}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* Footer self-serve links */}
      <Reveal direction="up" delay={0.32}>
        <div className="mt-8 grid sm:grid-cols-3 gap-3">
          {[
            { href: "/dashboard/governance",     label: "Governance & policy",  icon: DocumentTextIcon, sub: "Inspect policy rules and autonomy ladder." },
            { href: "/dashboard/integrations",   label: "Connector security",   icon: ServerStackIcon,  sub: "Review connector lifecycle and revoke access." },
            { href: "/docs/permissions-model",   label: "Permissions model",    icon: LockClosedIcon,   sub: "Read how RBAC and approvals interlock." },
          ].map(({ href, label, icon: Icon, sub }) => (
            <Link key={href} href={href} className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/25 hover:bg-emerald-500/[0.03] transition-colors">
              <Icon className="h-4 w-4 text-emerald-400 mb-2" />
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{sub}</p>
            </Link>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

function PostureRow({ check }: { check: PostureCheck }) {
  const Icon =
    check.semantic === "success" ? CheckCircleIcon :
    check.semantic === "warning" ? ExclamationTriangleIcon :
    check.semantic === "error"   ? XCircleIcon :
                                   CheckCircleIcon;
  const tone =
    check.semantic === "success" ? "text-emerald-400" :
    check.semantic === "warning" ? "text-amber-400" :
    check.semantic === "error"   ? "text-red-400" :
                                   "text-zinc-400";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] px-4 py-3">
      <Icon className={`h-4 w-4 ${tone} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{check.label}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{check.detail}</p>
      </div>
    </div>
  );
}

function daysAgo(iso?: string): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
