"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheckIcon,
  DocumentTextIcon,
  ServerStackIcon,
  KeyIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CpuChipIcon,
  ArrowRightIcon,
  ComputerDesktopIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import {
  CONTROL_REGISTRY,
  CATEGORY_LABEL,
  STATUS_LABEL,
  summarizeControls,
  type ComplianceControl,
} from "@/lib/compliance/controlRegistry";
import { BUNDLE_KIND_LABEL } from "@/lib/compliance/evidenceBundle";
import type { ComplianceBundleKind } from "@/lib/compliance/evidenceBundle";
import { platformSummaries, PLATFORM_LABEL, STATUS_LABEL as RELEASE_STATUS_LABEL, SIGNING_LABEL, CHANNEL_LABEL } from "@/lib/release/versionModel";
import { CONNECTOR_EVIDENCE, summarizeConnectorEvidence } from "@/lib/connectors/permissionEvidence";
import { buildAiSafetyEvidence, summarizeAiSafety } from "@/lib/agent/aiSafetyEvidence";
import { buildDataHandlingSummary, summarizeDataHandling } from "@/lib/security/dataHandlingSummary";
import { summarizeValidation, VALIDATION_MATRIX } from "@/lib/validation/platformValidationMatrix";

export default function TrustCenterPage() {
  const controlSummary = summarizeControls();
  const releaseRows = platformSummaries();
  const connectorSummary = summarizeConnectorEvidence();
  const aiSafety = buildAiSafetyEvidence();
  const aiSummary = summarizeAiSafety(aiSafety);
  const dataHandling = buildDataHandlingSummary();
  const dataPosture = summarizeDataHandling(dataHandling);

  return (
    <div className="relative">
      {/* Premium hero — calm depth, sourceMode-honest from /api/trust/summary */}
      <Reveal direction="up" blur>
        <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
          <div
            className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
            style={{
              background:
                "radial-gradient(900px 320px at 12% 0%, rgba(16,185,129,0.08), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(99,102,241,0.06), transparent 60%)",
            }}
            aria-hidden
          />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
              <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-300" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">Trust Center · evidence-backed</span>
            </span>
            <Link href="/dashboard/evidence" className="text-[10px] text-zinc-500 hover:text-white transition-colors">Inspect raw evidence →</Link>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
            Enterprise <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">trust + controls.</span>
          </h1>
          <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
            Controls are listed only when they exist in code. Status is honest: <span className="text-emerald-300">implemented</span>, <span className="text-amber-300">partial</span>, or <span className="text-zinc-400">planned</span>. <span className="text-zinc-500">No SOC 2 / ISO certifications claimed without backing records.</span>
          </p>
        </div>
      </Reveal>

      {/* Canonical Trust strip — sources of truth from /api/trust/summary */}
      <CanonicalTrustStrip />

      {/* Posture KPIs */}
      <Stagger delay={0.05} interval={0.05} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Control coverage",     value: `${Math.round(controlSummary.score * 100)}%`, sub: `${controlSummary.implemented} implemented · ${controlSummary.partial} partial · ${controlSummary.planned} planned`, icon: ShieldCheckIcon, tone: "emerald" },
          { label: "Connectors evidenced", value: `${connectorSummary.total}`,                  sub: `${connectorSummary.live} live · ${connectorSummary.expanding} expanding · ${connectorSummary.preview} preview`, icon: ServerStackIcon, tone: "violet" },
          { label: "AI safety controls",   value: `${aiSummary.implemented}/${aiSummary.total}`, sub: `${aiSummary.partial} partial · ${aiSummary.planned} planned`, icon: CpuChipIcon, tone: "cyan" },
          { label: "Data assertions",      value: `${dataPosture.totalAssertions}`,              sub: `${dataPosture.enforced} enforced · ${dataPosture.attested} attested · ${dataPosture.aspirational} aspirational`, icon: KeyIcon, tone: "amber" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          const toneClass =
            kpi.tone === "emerald" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
            kpi.tone === "violet"  ? "text-violet-300 bg-violet-500/10 border-violet-500/20" :
            kpi.tone === "cyan"    ? "text-cyan-300 bg-cyan-500/10 border-cyan-500/20" :
                                     "text-amber-300 bg-amber-500/10 border-amber-500/20";
          return (
            <div key={kpi.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className={`w-9 h-9 rounded-lg border flex items-center justify-center mb-3 ${toneClass}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-2xl font-bold text-white tracking-[-0.04em]">{kpi.value}</p>
              <p className="text-[11px] text-zinc-500 uppercase tracking-[0.12em] mt-1">{kpi.label}</p>
              <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{kpi.sub}</p>
            </div>
          );
        })}
      </Stagger>

      {/* Controls registry — grouped by category */}
      <Reveal direction="up" delay={0.08}>
        <div className="mb-10">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.18em] mb-1">Controls registry</p>
              <h2 className="text-xl font-bold text-white">{CONTROL_REGISTRY.length} controls across {Object.keys(controlSummary.byCategory).length} categories.</h2>
            </div>
            <Link href="/docs/security-model" className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">
              Security model docs <ArrowRightIcon className="inline h-3 w-3 ml-0.5 -mt-0.5" />
            </Link>
          </div>
          <div className="space-y-4">
            {Object.entries(groupBy(CONTROL_REGISTRY, "category")).map(([cat, list]) => (
              <div key={cat} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between flex-wrap gap-2">
                  <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-[0.15em]">
                    {CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL]}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono">{list.length} control{list.length === 1 ? "" : "s"}</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {list.map((c) => <ControlRow key={c.id} control={c} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Bundle export menu */}
      <Reveal direction="up" delay={0.12}>
        <div className="mb-10 rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-cyan-500/[0.02] p-6 overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-[0.18em] mb-1">Evidence bundles</p>
              <h2 className="text-lg font-bold text-white">Export an evidence pack for review.</h2>
            </div>
            <span className="text-[11px] text-zinc-500">JSON · NDJSON (no fake PDF)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {(Object.keys(BUNDLE_KIND_LABEL) as ComplianceBundleKind[]).map((kind) => (
              <div key={kind} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 flex items-center gap-2">
                <ArrowDownTrayIcon className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                <span className="text-[11px] text-zinc-300 truncate">{BUNDLE_KIND_LABEL[kind]}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
            Each bundle is the canonical control registry × the live evidence collector for the selected scope. Honest limitations are listed inside the bundle when controls are partial or unverified.
          </p>
        </div>
      </Reveal>

      {/* Release distribution */}
      <Reveal direction="up" delay={0.16}>
        <div className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ComputerDesktopIcon className="h-4 w-4 text-violet-300" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-[0.15em]">Release distribution</p>
            </div>
            <Link href="/download" className="text-[11px] text-zinc-400 hover:text-white">Open download →</Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {releaseRows.map((row) => {
              const ready = row.publicDistributionReady;
              return (
                <div key={row.platform} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{PLATFORM_LABEL[row.platform]}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {row.version} · {CHANNEL_LABEL[row.channel]} · {SIGNING_LABEL[row.signing]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className={`px-2 py-0.5 rounded-full border ${
                      ready ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
                      row.status === "blocked" ? "text-red-300 bg-red-500/10 border-red-500/20" :
                      "text-amber-300 bg-amber-500/10 border-amber-500/20"
                    }`}>
                      {RELEASE_STATUS_LABEL[row.status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Connector permissions */}
      <Reveal direction="up" delay={0.2}>
        <div className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ServerStackIcon className="h-4 w-4 text-violet-300" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-[0.15em]">Connector permissions</p>
            </div>
            <Link href="/dashboard/integrations" className="text-[11px] text-zinc-400 hover:text-white">Open integrations →</Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {CONNECTOR_EVIDENCE.map((c) => (
              <div key={c.connectorId} className="px-5 py-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold text-white">{c.label}</p>
                  <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${
                    c.status === "live"      ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
                    c.status === "expanding" ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                    c.status === "preview"   ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                                               "text-zinc-400 bg-white/[0.04] border-white/[0.08]"
                  }`}>{c.status}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{c.authModel}</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  <span className="text-emerald-300">Reads:</span> {c.readPermissions.slice(0, 4).join(" · ")}
                  {c.readPermissions.length > 4 && <> · <span className="text-zinc-600">+{c.readPermissions.length - 4} more</span></>}
                </p>
                {c.writePermissions.length > 0 ? (
                  <p className="text-[11px] text-zinc-500 mt-1">
                    <span className="text-amber-300">Writes:</span> {c.writePermissions.join(" · ")}
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-300/80 mt-1">No writes by default · read-only.</p>
                )}
                <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                  <span className="text-zinc-400 font-semibold">Revoke:</span> {c.revocationPath.instructions}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* AI safety */}
      <Reveal direction="up" delay={0.24}>
        <div className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CpuChipIcon className="h-4 w-4 text-cyan-300" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-[0.15em]">AI safety</p>
            </div>
            <Link href="/dashboard/copilot" className="text-[11px] text-zinc-400 hover:text-white">Open copilot →</Link>
          </div>
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.04]">
            <div className="p-5">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-3">Controls</p>
              <div className="space-y-2">
                {aiSafety.controls.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      c.state === "implemented" ? "bg-emerald-400" :
                      c.state === "partial"     ? "bg-amber-400" :
                                                  "bg-zinc-600"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-zinc-200">{c.label}</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">{c.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.15em] mb-3">Common questions</p>
              <div className="space-y-3">
                {aiSafety.qa.map((q) => (
                  <div key={q.question}>
                    <p className="text-[12px] font-semibold text-white">{q.question}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{q.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Data handling */}
      <Reveal direction="up" delay={0.28}>
        <div className="mb-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyIcon className="h-4 w-4 text-amber-300" />
              <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-[0.15em]">Data handling</p>
            </div>
            <span className="text-[11px] text-zinc-500">{dataPosture.enforced} enforced · {dataPosture.attested} attested · {dataPosture.aspirational} aspirational</span>
          </div>
          <div className="grid md:grid-cols-2 gap-px bg-white/[0.04]">
            <DataAssertionGroup title="What we collect"     items={dataHandling.whatWeCollect}     accent="emerald" />
            <DataAssertionGroup title="What we don't collect" items={dataHandling.whatWeDoNotCollect} accent="zinc"    />
            <DataAssertionGroup title="What we store"        items={dataHandling.whatWeStore}        accent="violet"  />
            <DataAssertionGroup title="What is transient"    items={dataHandling.whatIsTransient}    accent="cyan"    />
            <DataAssertionGroup title="What can go to AI"    items={dataHandling.whatCanGoToAI}      accent="emerald" />
            <DataAssertionGroup title="What never goes to AI" items={dataHandling.whatNeverGoesToAI} accent="red"     />
          </div>
        </div>
      </Reveal>

      {/* Enterprise reviewer Q&A */}
      <Reveal direction="up" delay={0.32}>
        <div className="mt-8 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.02] p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
            <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-[0.18em]">If your security team asks…</p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-3 text-xs text-zinc-300">
            {[
              ["Is Axiom read-only by default?",        "Yes — every connector ships with a read-only auth model. Writes are opt-in and listed in the connector permission summary."],
              ["What access does Axiom need?",          "Per-provider in the connector permission table above. AWS: read-only IAM role with External ID. GitHub: minimal repo scopes via an installed app."],
              ["Can access be revoked?",                "Yes — every connector has a self-serve revoke path. Credentials are cleared from the vault immediately."],
              ["Are actions approved?",                 "High-risk actions are gated by the policy engine + approval center. The decision is server-side, not UI."],
              ["Are actions audited?",                  "Yes — every sensitive action emits a typed AuditRecord with correlation id, actor, outcome, and redacted detail."],
              ["Can AI see secrets?",                   "No. The canonical redactor + safe-context pipeline runs before every LLM call. Sensitive key names are blocked structurally."],
              ["Can desktop execute without approval?", "No. Local apply requires approval + tenant policy + rollback plan + reachable audit sink. Handoffs are signed + replay-protected + bound to the operation."],
              ["Are audit logs exportable?",            "Yes — JSON / CSV / NDJSON via /api/audit/bundle/[correlationId]. PDF is intentionally absent (we don't fake unavailable formats)."],
              ["What controls are implemented?",        `${controlSummary.implemented} of ${controlSummary.total} — see the controls registry above.`],
              ["What controls are planned?",            `${controlSummary.planned} planned, ${controlSummary.partial} partial. The registry's status field is honest.`],
            ].map(([q, a]) => (
              <li key={q} className="flex items-start gap-2">
                <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-300 shrink-0 mt-0.5" />
                <span className="leading-relaxed"><span className="font-semibold text-zinc-100">{q}</span> <span className="text-zinc-400">{a}</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-5 pt-5 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-3">
            <p className="text-[11px] text-zinc-500">Need a deeper review or DPA / security questionnaire?</p>
            <Link href="/contact?topic=security" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] text-xs font-semibold">
              Request enterprise security review
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Validation matrix headline — pulled from /lib/validation */}
      <Reveal direction="up" delay={0.34}>
        <ValidationSummaryStrip />
      </Reveal>

      {/* Self-serve links */}
      <Reveal direction="up" delay={0.36}>
        <div className="mt-8 grid sm:grid-cols-4 gap-3">
          {[
            { href: "/dashboard/validation",      label: "Validation matrix", icon: CubeTransparentIconShim, sub: "What actually works + multi-cloud capability table." },
            { href: "/dashboard/security-scanner", label: "Security scanner", icon: ShieldCheckIcon, sub: "Cloud + app + supply-chain + desktop checks." },
            { href: "/dashboard/security",        label: "Security center",   icon: ShieldCheckIcon, sub: "Tenant isolation, RBAC, credentials, redaction." },
            { href: "/dashboard/reliability",     label: "Reliability",       icon: BoltIcon, sub: "Circuits, retries, dead-letter, system health." },
          ].map(({ href, label, icon: Icon, sub }) => (
            <Link key={href} href={href} className="block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-emerald-500/25 hover:bg-emerald-500/[0.03] transition-colors">
              <Icon className="h-4 w-4 text-emerald-300 mb-2" />
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{sub}</p>
            </Link>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

function CubeTransparentIconShim(props: { className?: string }) {
  // Local SVG so we don't add another heroicons import. Cube outline.
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 7.5l-9-4.5-9 4.5L12 12l9-4.5z" />
      <path d="M3 7.5V16.5l9 4.5 9-4.5V7.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function ValidationSummaryStrip() {
  const summary = summarizeValidation();
  const actionable = VALIDATION_MATRIX.filter((r) => r.status === "partial" || r.status === "blocked").slice(0, 3);
  return (
    <Link
      href="/dashboard/validation"
      className="block mt-8 rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.05] via-transparent to-emerald-500/[0.03] p-5 hover:border-cyan-500/30 transition-colors group"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold text-cyan-300 uppercase tracking-[0.18em] mb-1">Validation matrix</p>
          <h3 className="text-base font-bold text-white">{summary.passing} of {summary.total} capabilities passing · {Math.round(summary.score * 100)}% score</h3>
          <p className="text-[12px] text-zinc-400 mt-1 leading-relaxed">
            {summary.partial} partial · {summary.preview} preview · {summary.blocked} blocked · {summary.failing} failing.
          </p>
        </div>
        <div className="flex items-center gap-1 text-cyan-300 font-semibold text-sm">
          Open validation matrix <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
      {actionable.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.05] grid sm:grid-cols-3 gap-2">
          {actionable.map((r) => (
            <div key={r.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
              <p className="text-[11px] text-zinc-300 font-semibold truncate">{r.capability}</p>
              <p className="text-[10px] text-amber-300/80 mt-0.5">{r.nextFix ?? "Action needed"}</p>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

function ControlRow({ control }: { control: ComplianceControl }) {
  const Icon =
    control.status === "implemented" ? CheckCircleIcon :
    control.status === "partial"     ? ExclamationTriangleIcon :
    control.status === "planned"     ? XCircleIcon :
                                       CheckCircleIcon;
  const tone =
    control.status === "implemented" ? "text-emerald-300" :
    control.status === "partial"     ? "text-amber-300" :
    control.status === "planned"     ? "text-zinc-500" :
                                       "text-zinc-400";
  return (
    <div className="px-5 py-3">
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 ${tone} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-semibold text-white">{control.title}</p>
            <span className={`text-[9px] font-bold uppercase tracking-wider border rounded-full px-1.5 py-px ${
              control.status === "implemented" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
              control.status === "partial"     ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
              control.status === "planned"     ? "text-zinc-400 bg-white/[0.04] border-white/[0.08]" :
                                                  "text-zinc-400 bg-white/[0.04] border-white/[0.08]"
            }`}>{STATUS_LABEL[control.status]}</span>
            {control.frameworkAlignments && control.frameworkAlignments.length > 0 && (
              <span className="text-[9px] text-zinc-500 font-mono">{control.frameworkAlignments.join(" · ")}</span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">{control.customerExplanation}</p>
          {control.evidence.length > 0 && (
            <p className="text-[10px] text-zinc-600 mt-1 font-mono truncate">
              evidence · {control.evidence.map((e) => e.ref).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DataAssertionGroup({
  title,
  items,
  accent,
}: {
  title: string;
  items: { id: string; statement: string; confidence: "enforced" | "attested" | "aspirational" }[];
  accent: "emerald" | "violet" | "cyan" | "amber" | "red" | "zinc";
}) {
  const tone =
    accent === "emerald" ? "text-emerald-300" :
    accent === "violet"  ? "text-violet-300" :
    accent === "cyan"    ? "text-cyan-300" :
    accent === "amber"   ? "text-amber-300" :
    accent === "red"     ? "text-red-300" :
                            "text-zinc-300";
  return (
    <div className="bg-[#0c0c10] p-5">
      <p className={`text-[10px] font-semibold uppercase tracking-[0.15em] mb-3 ${tone}`}>{title}</p>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-[11px] text-zinc-400 leading-relaxed">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
              a.confidence === "enforced"  ? "bg-emerald-400" :
              a.confidence === "attested"  ? "bg-amber-400" :
                                              "bg-zinc-600"
            }`} />
            <span>
              {a.statement}
              <span className="ml-1.5 text-[10px] text-zinc-600 font-mono">[{a.confidence}]</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function groupBy<T, K extends keyof T>(arr: T[], key: K): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = String(item[key]);
    (out[k] ?? (out[k] = [])).push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// CanonicalTrustStrip — anchors the Trust Center to the same canonical
// numbers /api/trust/summary reports. Replaces the prior pattern where the
// page composed locally and could drift from /api/axiom-os/state. Renders
// honest sourceMode pill + control/evidence counts + safeNextAction.
// ---------------------------------------------------------------------------

interface TrustSummaryLite {
  generatedAt: string;
  sourceMode: "live" | "partial" | "preview";
  controls: { total: number; implemented: number; partial: number; planned: number; notApplicable: number; score: number };
  evidence: { total: number; verified: number; selfAttested: number; manual: number; unverified: number; coverageScore: number };
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

function CanonicalTrustStrip() {
  const [summary, setSummary] = useState<TrustSummaryLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trust/summary", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: TrustSummaryLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setSummary(json.data);
        else setError(json.error?.userMessage ?? "Trust summary unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const controlPct = summary ? Math.round(summary.controls.score * 100) : 0;
  const coveragePct = summary ? Math.round(summary.evidence.coverageScore * 100) : 0;
  const sourceMode = summary?.sourceMode ?? "preview";
  const sourceTone =
    sourceMode === "live"    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
    sourceMode === "partial" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"        :
                                "bg-amber-500/15 text-amber-300 border-amber-500/30";

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing canonical trust summary…</p>
      </div>
    );
  }
  if (error || !summary) {
    return (
      <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-8">
        <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// trust summary unavailable</p>
        <p className="text-[13px] text-zinc-300">{error ?? "Sign in to load /api/trust/summary."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/[0.18] bg-gradient-to-br from-emerald-500/[0.04] via-white/[0.015] to-transparent p-5 mb-8 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2 py-0.5 ${sourceTone}`}>
          {sourceMode} · from /api/trust/summary
        </span>
        <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(summary.generatedAt).toLocaleTimeString()}</span>
      </div>
      <div className="grid sm:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Control coverage</p>
          <p className="text-3xl font-bold text-white tracking-tight">{controlPct}%</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            {summary.controls.implemented} implemented · {summary.controls.partial} partial · {summary.controls.planned} planned
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Evidence records</p>
          <p className="text-3xl font-bold text-white tracking-tight">{summary.evidence.total}</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            {summary.evidence.verified} verified · {summary.evidence.selfAttested} attested · {summary.evidence.manual} manual
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Evidence coverage</p>
          <p className={`text-3xl font-bold tracking-tight ${coveragePct >= 60 ? "text-emerald-300" : coveragePct >= 30 ? "text-amber-300" : "text-rose-300"}`}>{coveragePct}%</p>
          <p className="text-[11px] text-zinc-500 mt-1">Verified / total ratio</p>
        </div>
        <div className="flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Safe next action</p>
            <p className="text-[13px] font-semibold text-white leading-snug">{summary.safeNextAction.label}</p>
          </div>
          <Link href={summary.safeNextAction.href} className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-medium text-emerald-200 hover:text-emerald-100 transition-colors w-fit">
            Open → <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </div>
      {summary.limitations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// limitations</p>
          <p className="text-[12px] text-zinc-400 leading-relaxed">{summary.limitations[0]}</p>
        </div>
      )}
    </div>
  );
}
