/**
 * /dashboard/orchestration
 *
 * Operations control tower. Surfaces active orchestrations, their stage
 * + status, blockers, approval state, desktop review eligibility, and
 * Terraform apply boundary. The default action everywhere is review.
 */

import {
  ShieldCheckIcon,
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";

import { runRemediationPipeline } from "@/lib/remediation/remediationPipeline";
import { listApprovals } from "@/lib/approvals/approvalEngine";
import { listActiveLocks } from "@/lib/execution/executionLocks";
import { evaluateTerraformBoundary } from "@/lib/execution/terraformBoundary";
import { loadAppEnv } from "@/lib/config/env";
import {
  ORCHESTRATION_STAGE_LABEL,
  ORCHESTRATION_STATUS_LABEL,
  STATUS_SEMANTIC,
  defaultStatusForStage,
  type OrchestrationStage,
} from "@/lib/execution/orchestrationModel";

export const dynamic = "force-dynamic";

function stageFromBundleStatus(status: string): OrchestrationStage {
  switch (status) {
    case "approved":            return "approved";
    case "requires_approval":   return "approval_requested";
    case "blocked_by_policy":   return "execution_blocked";
    case "ready_for_review":    return "simulated";
    case "ready_for_desktop":   return "desktop_review_ready";
    case "plan_generated":      return "planned";
    case "needs_validation":    return "planned";
    case "execution_disabled":  return "execution_blocked";
    default:                     return "identified";
  }
}

const STATUS_TONE = {
  pass:    "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  warn:    "text-amber-300 bg-amber-500/10 border-amber-500/25",
  fail:    "text-rose-300 bg-rose-500/10 border-rose-500/25",
  neutral: "text-zinc-300 bg-zinc-500/10 border-zinc-500/25",
};

const RISK_TONE = {
  critical: "text-rose-300 bg-rose-500/10 border-rose-500/25",
  high:     "text-amber-300 bg-amber-500/10 border-amber-500/25",
  medium:   "text-cyan-300 bg-cyan-500/10 border-cyan-500/25",
  low:      "text-zinc-300 bg-zinc-500/10 border-zinc-500/25",
};

export default async function OrchestrationCenter() {
  const env = loadAppEnv();
  const pipeline = await runRemediationPipeline();
  const approvals = listApprovals({});
  const locks = listActiveLocks({});

  const boundaries = (["aws", "azure", "gcp", "github", "desktop"] as const).map((p) =>
    evaluateTerraformBoundary({
      provider: p,
      brokerCredentialsPresent: p === "aws" ? env.awsBrokerConfigured : false,
      applyFeatureFlagOn: false,
      auditSinkReady: false,
      desktopSigningReady: env.desktopDownloadsEnabled,
    }),
  );

  const orchestrations = pipeline.bundles.map((b) => {
    const stage = stageFromBundleStatus(b.finalStatus);
    return {
      id: `orc.${b.candidate.id}`,
      title: b.candidate.title,
      provider: b.candidate.provider,
      stage,
      status: defaultStatusForStage(stage),
      risk: b.candidate.riskLevel,
      sourceMode: b.candidate.sourceMode,
      detail: b.candidate.impactSummary,
      readiness: b.readiness.decision,
    };
  });

  const totals = {
    total: orchestrations.length,
    waitingApproval: orchestrations.filter((o) => o.stage === "approval_requested").length,
    blocked:         orchestrations.filter((o) => o.stage === "execution_blocked").length,
    desktopReady:    orchestrations.filter((o) => o.stage === "desktop_review_ready").length,
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-3">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <span className="text-[10px] font-mono font-semibold text-emerald-300 uppercase tracking-[0.22em]">Orchestration Center</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-[-0.04em] mb-2">
          The <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">operations control tower</span>.
        </h1>
        <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
          Every remediation passes through the same governed flow: simulated → policy → approval → preflight → desktop review → execution-ready → verification → rollback readiness → audit. Nothing on this page applies a change.
        </p>
      </header>

      {/* Totals */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Active orchestrations" value={`${totals.total}`}           tone="text-violet-300" detail="One per remediation candidate." />
        <Kpi label="Waiting approval"      value={`${totals.waitingApproval}`} tone="text-amber-300"  detail="Operator + approver decision." />
        <Kpi label="Blocked"               value={`${totals.blocked}`}         tone="text-rose-300"   detail="Policy / source / missing prereqs." />
        <Kpi label="Desktop review ready"  value={`${totals.desktopReady}`}    tone="text-cyan-300"   detail="Can be reviewed locally." />
      </section>

      {/* Terraform boundary */}
      <section className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#0d0d12] via-[#0a0a0f] to-[#08080c] p-6">
        <div className="flex items-center gap-2 mb-4">
          <CommandLineIcon className="h-4 w-4 text-cyan-300" />
          <h2 className="text-base font-semibold text-white tracking-tight">Terraform plan / apply boundary</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {boundaries.map((b) => (
            <div key={b.provider} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">{b.provider}</p>
              <div className="space-y-1 text-[11px] font-mono">
                <p className={b.previewAvailable ? "text-emerald-300" : "text-rose-300"}>preview · {b.previewAvailable ? "yes" : "no"}</p>
                <p className={b.planAvailable    ? "text-emerald-300" : "text-rose-300"}>plan · {b.planAvailable ? "yes" : "no"}</p>
                <p className={b.applyAvailable   ? "text-emerald-300" : "text-amber-300"}>apply · {b.applyAvailable ? "yes" : "disabled"}</p>
              </div>
              {!b.applyAvailable && (
                <p className="text-[10px] text-zinc-500 mt-2 line-clamp-3">{b.whyApplyBlocked}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Orchestration list */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white tracking-tight">Active orchestrations</h2>
        {orchestrations.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6 text-sm text-zinc-500">
            No orchestrations yet — connect a provider, then run the security scanner.
          </div>
        )}
        {orchestrations.slice(0, 10).map((o) => {
          const semantic = STATUS_SEMANTIC[o.status];
          return (
            <div key={o.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.015] px-6 py-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${RISK_TONE[o.risk]}`}>{o.risk}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${STATUS_TONE[semantic]}`}>{ORCHESTRATION_STATUS_LABEL[o.status]}</span>
                    <span className="text-[10px] font-mono text-zinc-600">stage · {ORCHESTRATION_STAGE_LABEL[o.stage]}</span>
                    <span className="text-[10px] font-mono text-zinc-600">·</span>
                    <span className="text-[10px] font-mono text-zinc-600">{o.provider}</span>
                    <span className="text-[10px] font-mono text-zinc-600">·</span>
                    <span className="text-[10px] font-mono text-zinc-600">source · {o.sourceMode}</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{o.title}</p>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{o.detail}</p>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 shrink-0">readiness · {o.readiness}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* Approvals + locks */}
      <section className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
            <h2 className="text-base font-semibold text-white tracking-tight">Approval engine</h2>
          </div>
          {approvals.length === 0 ? (
            <p className="text-xs text-zinc-500">No approvals in flight. Approvals appear here when remediations require them.</p>
          ) : (
            <ul className="space-y-2">
              {approvals.slice(0, 6).map((a) => (
                <li key={a.id} className="text-[11px] flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0">
                  <span className="truncate">
                    <span className="text-zinc-300">{a.changeSummary}</span>
                    <span className="text-zinc-600"> · {a.provider}</span>
                  </span>
                  <span className="text-zinc-500">{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6">
          <div className="flex items-center gap-2 mb-4">
            <LockClosedIcon className="h-4 w-4 text-amber-300" />
            <h2 className="text-base font-semibold text-white tracking-tight">Active execution locks</h2>
          </div>
          {locks.length === 0 ? (
            <p className="text-xs text-zinc-500">No active locks. Locks appear here when concurrent work would conflict.</p>
          ) : (
            <ul className="space-y-2">
              {locks.slice(0, 6).map((l) => (
                <li key={l.id} className="text-[11px] flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0">
                  <span className="text-zinc-300 truncate">{l.kind} · {l.resourceRef}</span>
                  <span className="text-zinc-500">{new Date(l.expiresAt).toISOString().slice(0, 19)}Z</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Honest footer */}
      <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
        <div className="flex items-center gap-2 mb-2">
          <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
          <p className="text-[10px] font-mono text-amber-300 uppercase tracking-[0.22em]">Known limitations</p>
        </div>
        <ul className="space-y-1 text-xs text-zinc-300">
          <li>• Live Terraform apply is disabled by default. The boundary refuses apply across every provider until governance + signed audit + signed binaries are wired.</li>
          <li>• Approvals + locks are in-memory today. Decisions made here are not persisted across deploys until Prisma promotion lands.</li>
          <li>• Desktop apply remains intentionally blocked — the desktop adapter refuses execute() on the server side.</li>
          <li>• Every readiness factor must pass before an orchestration can advance from <span className="font-mono">approved</span> to <span className="font-mono">execution_ready</span>.</li>
        </ul>
      </section>

      {/* Decorative CPU icon to keep import set lean */}
      <div className="hidden"><CpuChipIcon className="h-4 w-4" /><ClockIcon className="h-4 w-4" /></div>
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
