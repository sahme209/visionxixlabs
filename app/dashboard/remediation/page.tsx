/**
 * /dashboard/remediation
 *
 * The Remediation Center — closed-loop remediation control panel. Each
 * row pairs a candidate with its Terraform/CLI/rollback/verification +
 * readiness so the operator can review and approve safely.
 *
 * Default action is review → approve → preview → verify. There is no
 * "Apply now" button on this page; apply is gated by approvals + policy
 * elsewhere.
 */

import Link from "next/link";
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  CommandLineIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

import { runRemediationPipeline, topReadyBundles } from "@/lib/remediation/remediationPipeline";
import { REMEDIATION_STATUS_LABEL, REMEDIATION_STATUS_SEMANTIC, CHANGE_TYPE_LABEL } from "@/lib/remediation/remediationModel";
import { RunRemediationPlanPanel } from "@/components/dashboard/RunRemediationPlanPanel";

export const dynamic = "force-dynamic";

const RISK_TONE = {
  critical: "text-rose-300 bg-rose-500/10 border-rose-500/25",
  high:     "text-zinc-300 bg-white/10 border-white/25",
  medium:   "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
  low:      "text-zinc-300 bg-zinc-500/10 border-zinc-500/25",
};

const STATUS_TONE = {
  pass:    "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  warn:    "text-zinc-300 bg-white/10 border-white/25",
  fail:    "text-rose-300 bg-rose-500/10 border-rose-500/25",
  neutral: "text-zinc-300 bg-zinc-500/10 border-zinc-500/25",
};

export default async function RemediationCenter() {
  const outcome = await runRemediationPipeline();
  const top = topReadyBundles(outcome, 8);

  const summary = outcome.summary;

  return (
    <div className="space-y-10">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <span className="text-[10px] font-mono font-semibold text-emerald-300 uppercase tracking-[0.22em]">Remediation Center</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-[-0.04em] mb-2">
          Closed-loop <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">remediation</span>.
        </h1>
        <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
          Every candidate carries a Terraform preview, CLI preview, rollback plan, verification checklist, and execution-readiness decision. Apply is approval-gated and reversible. Nothing on this page mutates cloud state.
        </p>
      </header>

      {/* Run remediation plan — clickable POST /api/remediation/plan */}
      <RunRemediationPlanPanel />

      {/* KPIs */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Candidates"        value={`${summary.total}`}            tone="text-violet-300"  detail="From security + releases + gaps." />
        <Kpi label="Approval-gated"    value={`${summary.approvalGated}`}    tone="text-zinc-300"   detail="Approver(s) required to proceed." />
        <Kpi label="Desktop-eligible"  value={`${summary.desktopEligible}`}  tone="text-cyan-300"    detail="Can be reviewed locally." />
        <Kpi label="Policy-blocked"    value={`${summary.blocked}`}          tone="text-rose-300"    detail="Blocked by governance / preview mode." />
      </section>

      {/* Risk breakdown */}
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="h-4 w-4 text-zinc-300" />
            <h2 className="text-base font-semibold text-white tracking-tight">Risk distribution</h2>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 tracking-wider">live = {outcome.bundles.filter((b) => b.candidate.sourceMode === "live").length} · preview = {outcome.bundles.filter((b) => b.candidate.sourceMode !== "live").length}</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {(["critical", "high", "medium", "low"] as const).map((r) => (
            <div key={r} className={`rounded-xl border p-4 ${RISK_TONE[r]}`}>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] mb-1">{r}</p>
              <p className="text-2xl font-bold">{summary.byRisk[r]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bundles */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white tracking-tight">Top ready remediations</h2>
        {top.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6 text-sm text-zinc-500">
            No candidates surfaced yet — connect a provider, then run the security scanner.
          </div>
        )}
        {top.map((bundle) => {
          const c = bundle.candidate;
          const semantic = REMEDIATION_STATUS_SEMANTIC[c.status];
          return (
            <details key={c.id} className="group rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#0d0d12] via-[#0a0a0f] to-[#08080c] overflow-hidden">
              <summary className="cursor-pointer list-none px-6 py-5 flex items-center justify-between gap-4 hover:bg-white/[0.02]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${RISK_TONE[c.riskLevel]}`}>{c.riskLevel}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${STATUS_TONE[semantic]}`}>{REMEDIATION_STATUS_LABEL[c.status]}</span>
                    <span className="text-[10px] font-mono text-zinc-600">{CHANGE_TYPE_LABEL[c.category]}</span>
                    <span className="text-[10px] font-mono text-zinc-600">·</span>
                    <span className="text-[10px] font-mono text-zinc-600">{c.provider}</span>
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{c.title}</p>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{c.impactSummary}</p>
                </div>
                <div className="shrink-0 flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                  <span title="Readiness decision">{bundle.readiness.decision}</span>
                  <ArrowPathIcon className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
                </div>
              </summary>

              <div className="px-6 pb-6 grid lg:grid-cols-2 gap-5 border-t border-white/[0.05]">
                {/* Terraform preview */}
                <Card Icon={CommandLineIcon} title="Terraform preview" tone="text-violet-300">
                  <p className="text-[11px] font-mono text-zinc-600 mb-2">{bundle.terraform.fileName}</p>
                  {bundle.terraform.manualReviewRequired ? (
                    <p className="text-xs text-zinc-300">Manual review required — no canonical HCL template yet.</p>
                  ) : (
                    <pre className="text-[10.5px] font-mono text-zinc-300 bg-black/40 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre">{bundle.terraform.hcl}</pre>
                  )}
                  <p className="text-[11px] text-zinc-500 mt-2">{bundle.terraform.explanation}</p>
                </Card>

                {/* CLI preview */}
                <Card Icon={CommandLineIcon} title="CLI preview" tone="text-cyan-300">
                  <p className="text-[11px] font-mono text-zinc-600 mb-2">{bundle.cli.cli}</p>
                  {bundle.cli.manualReviewRequired ? (
                    <p className="text-xs text-zinc-300">Manual review required — no canonical CLI template yet.</p>
                  ) : (
                    <pre className="text-[10.5px] font-mono text-zinc-300 bg-black/40 rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">{bundle.cli.command}</pre>
                  )}
                  <p className="text-[11px] text-zinc-500 mt-2">{bundle.cli.explanation}</p>
                  {bundle.cli.dryRunAvailable && (
                    <p className="text-[10px] font-mono text-emerald-300 mt-1">dry-run: available</p>
                  )}
                </Card>

                {/* Rollback */}
                <Card Icon={ArrowPathIcon} title="Rollback plan" tone="text-zinc-300">
                  <p className="text-xs text-zinc-300 mb-2">
                    {bundle.rollback.rollbackAvailable
                      ? `Available · complexity ${bundle.rollback.rollbackComplexity}`
                      : "Rollback is not safely available — change is one-way."}
                  </p>
                  <ul className="space-y-1 text-[11px] text-zinc-400">
                    {bundle.rollback.rollbackSteps.slice(0, 4).map((s) => (
                      <li key={s.ordinal}>{s.ordinal}. {s.detail}</li>
                    ))}
                  </ul>
                  {bundle.rollback.notes.length > 0 && (
                    <p className="text-[10px] font-mono text-zinc-300 mt-2">{bundle.rollback.notes[0]}</p>
                  )}
                </Card>

                {/* Verification */}
                <Card Icon={CheckCircleIcon} title="Verification" tone="text-emerald-300">
                  <p className="text-[11px] font-mono text-zinc-600 mb-2">method · {bundle.verification.validationMethod} · {bundle.verification.manualOrAutomated}</p>
                  <ul className="space-y-1 text-[11px] text-zinc-400">
                    {bundle.verification.checks.slice(0, 4).map((c) => (
                      <li key={c.id}>{c.ordinal}. {c.title} <span className="text-zinc-600">({c.execution})</span></li>
                    ))}
                  </ul>
                </Card>

                {/* Readiness + policy */}
                <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheckIcon className="h-3.5 w-3.5 text-violet-300" />
                      <p className="text-[10px] font-mono text-violet-300 uppercase tracking-[0.18em]">// readiness</p>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">policy · {c.policyDecision} · approval · {c.approvalRequirement}</span>
                  </div>
                  <p className="text-xs text-zinc-300 mb-3">{bundle.readiness.reason}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-[10px] font-mono">
                    {bundle.readiness.factors.slice(0, 8).map((f) => (
                      <div key={f.id} className="flex items-center gap-1.5">
                        {f.status === "pass" ? <CheckCircleIcon className="h-3 w-3 text-emerald-300" /> :
                         f.status === "warn" ? <ExclamationTriangleIcon className="h-3 w-3 text-zinc-300" /> :
                         f.status === "fail" ? <ClockIcon className="h-3 w-3 text-rose-300" /> :
                         <ClockIcon className="h-3 w-3 text-zinc-500" />}
                        <span className="text-zinc-400 truncate">{f.label}</span>
                      </div>
                    ))}
                  </div>
                  {bundle.readiness.safeNextAction.href ? (
                    <Link href={bundle.readiness.safeNextAction.href} className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-white">
                      {bundle.readiness.safeNextAction.label} →
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-zinc-500">{bundle.readiness.safeNextAction.label}</span>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </section>

      {/* Honest limitations */}
      <section className="rounded-xl border border-white/20 bg-white/[0.04] p-5">
        <p className="text-[10px] font-mono text-zinc-300 uppercase tracking-[0.22em] mb-2">Known limitations</p>
        <ul className="space-y-1 text-xs text-zinc-300">
          <li>• This page renders prepared remediation work. It does not apply changes.</li>
          <li>• Live cloud apply is only enabled when broker credentials + approvals + policy + signed audit are all green.</li>
          <li>• Manual-review previews are honestly labelled — no synthetic HCL/CLI is fabricated when a canonical template doesn&apos;t exist.</li>
          <li>• Desktop apply remains blocked by default until governance + signed binaries land.</li>
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone, detail }: { label: string; value: string; tone: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{label}</p>
      <p className={`text-3xl font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] text-zinc-500 mt-2">{detail}</p>
    </div>
  );
}

function Card({ Icon, title, tone, children }: { Icon: React.ComponentType<{ className?: string }>; title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        <h3 className="text-xs font-semibold text-white tracking-tight">{title}</h3>
      </div>
      {children}
    </div>
  );
}

