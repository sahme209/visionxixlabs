"use client";

/**
 * JourneyTimeline — demo-grade 7-step narrative driven by /api/axiom-os/state.
 *
 *   1. Source connected     (provider-specific  · ProviderPosture)
 *   2. Latest scan          (provider-specific  · OperatingLoopSummary)
 *   3. Security findings    (cross-cutting      · SecurityPostureSummary)
 *   4. Remediation          (cross-cutting      · RemediationPostureSummary)
 *   5. Approvals            (cross-cutting      · ApprovalPostureSummary)
 *   6. Desktop review       (cross-cutting      · DesktopPostureSummary)
 *   7. Trust evidence       (cross-cutting      · EvidencePostureSummary)
 *
 * Steps 3-7 are explicitly labeled "cross-cutting" because counts are
 * tenant-wide (across all providers, not filtered to a single one). When
 * the platform gains per-provider filters, this component can refine.
 *
 * Every value is canonical. No fabricated metrics. Each step renders an
 * honest empty / blocked / preview state.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  CloudIcon,
  PlayCircleIcon,
  ShieldExclamationIcon,
  WrenchScrewdriverIcon,
  LockClosedIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

interface ProviderPostureLite {
  provider: string;
  mode: string;
  headline: string;
  connectionStatus: string;
  missingRequirements: string[];
  resourceCount?: number;
  findingCount?: number;
  lastScannedAt?: string;
  safeNextAction?: { label: string; href: string };
}

interface OperatingLoopLite {
  provider: string;
  currentStage: string;
  status: string;
  sourceMode: string;
  attentionRequiredCount: number;
  topSafeNextAction?: { label: string; href: string };
}

interface AxiomOSStateLite {
  generatedAt: string;
  sourceMode: string;
  providers: ProviderPostureLite[];
  operatingLoops: OperatingLoopLite[];
  securityPosture:    { sourceMode: string; data: { totalFindings: number; criticalCount: number; highCount: number; mediumCount: number; lowCount: number; compoundedRiskCount: number; affectedSystems: string[] }; safeNextAction?: { label: string; href: string } };
  remediationPosture: { sourceMode: string; data: { candidateCount: number; simulatedCount: number; approvalGatedCount: number; desktopReviewEligibleCount: number };               safeNextAction?: { label: string; href: string } };
  approvalPosture:    { sourceMode: string; data: { pendingCount: number; highRiskCount: number; expiredCount: number };                                                            safeNextAction?: { label: string; href: string } };
  desktopPosture:     { sourceMode: string; data: { binaryAvailable: boolean; signingStatus: string; pairedSessions: number; localExecutionDisabled: true };                       safeNextAction?: { label: string; href: string } };
  evidencePosture:    { sourceMode: string; data: { totalRecords: number; verifiedRecords: number; coverageScore: number };                                                         safeNextAction?: { label: string; href: string } };
}

type Provider = "aws" | "azure" | "gcp" | "github";

const PROVIDER_LABEL: Record<Provider, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  github: "GitHub",
};

const SOURCE_TONE: Record<string, { dot: string; text: string; pill: string }> = {
  live:         { dot: "bg-emerald-400 animate-pulse", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300" },
  partial_live: { dot: "bg-cyan-400 animate-pulse",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300"       },
  expanding:    { dot: "bg-zinc-400",                 text: "text-zinc-300",   pill: "bg-white/15 text-zinc-300"     },
  preview:      { dot: "bg-zinc-400",                 text: "text-zinc-300",   pill: "bg-white/15 text-zinc-300"     },
  blocked:      { dot: "bg-rose-400",                  text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300"       },
  disabled:     { dot: "bg-zinc-600",                  text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300"       },
  unknown:      { dot: "bg-zinc-600",                  text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300"       },
};

function toneOf(mode: string) {
  return SOURCE_TONE[mode] ?? SOURCE_TONE.preview;
}

export function JourneyTimeline({ provider }: { provider: Provider }) {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
        else setError(json.error?.userMessage ?? "Journey state unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing {PROVIDER_LABEL[provider]} journey…</p>
      </div>
    );
  }
  if (error || !state) {
    return (
      <div className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
        <p className="text-[11px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-1">// journey unavailable</p>
        <p className="text-[13px] text-zinc-300">{error ?? "Sign in to load canonical state."}</p>
      </div>
    );
  }

  const providerPosture = state.providers.find((p) => p.provider === provider);
  const loop = state.operatingLoops.find((l) => l.provider === provider);

  const steps: JourneyStep[] = [
    {
      n: 1,
      icon: CloudIcon,
      title: "Source connected",
      scope: "provider",
      sourceMode: providerPosture?.mode ?? "preview",
      summary: providerPosture?.headline ?? "Provider not connected",
      counts: providerPosture?.missingRequirements && providerPosture.missingRequirements.length > 0
        ? `${providerPosture.missingRequirements.length} missing requirement${providerPosture.missingRequirements.length === 1 ? "" : "s"}`
        : "Connected · read-only",
      safeNextAction: providerPosture?.safeNextAction,
      done: providerPosture?.mode === "live",
    },
    {
      n: 2,
      icon: PlayCircleIcon,
      title: "Latest scan",
      scope: "provider",
      sourceMode: loop?.sourceMode ?? "preview",
      summary: loop ? `Stage: ${loop.currentStage.replace(/_/g, " ")} · ${loop.status.replace(/_/g, " ")}` : "No operating loop yet",
      counts: typeof loop?.attentionRequiredCount === "number" ? `${loop.attentionRequiredCount} attention-required` : "—",
      safeNextAction: loop?.topSafeNextAction,
      done: loop?.status === "completed",
    },
    {
      n: 3,
      icon: ShieldExclamationIcon,
      title: "Security findings",
      scope: "cross-cutting",
      sourceMode: state.securityPosture.sourceMode,
      summary: state.securityPosture.data.totalFindings === 0
        ? "No findings yet — scanner has not produced output for this tenant"
        : `${state.securityPosture.data.totalFindings} finding${state.securityPosture.data.totalFindings === 1 ? "" : "s"} across ${state.securityPosture.data.affectedSystems.length} system${state.securityPosture.data.affectedSystems.length === 1 ? "" : "s"}`,
      counts: `${state.securityPosture.data.criticalCount} critical · ${state.securityPosture.data.highCount} high · ${state.securityPosture.data.compoundedRiskCount} compound`,
      safeNextAction: state.securityPosture.safeNextAction ?? { label: "Open Security Scanner", href: "/dashboard/security" },
      done: state.securityPosture.data.criticalCount === 0 && state.securityPosture.data.highCount === 0,
    },
    {
      n: 4,
      icon: WrenchScrewdriverIcon,
      title: "Remediation prepared",
      scope: "cross-cutting",
      sourceMode: state.remediationPosture.sourceMode,
      summary: state.remediationPosture.data.candidateCount === 0
        ? "No remediation candidates prepared"
        : `${state.remediationPosture.data.candidateCount} candidate${state.remediationPosture.data.candidateCount === 1 ? "" : "s"} prepared · ${state.remediationPosture.data.simulatedCount} simulated`,
      counts: `${state.remediationPosture.data.approvalGatedCount} approval-gated · ${state.remediationPosture.data.desktopReviewEligibleCount} desktop-eligible`,
      safeNextAction: state.remediationPosture.safeNextAction ?? { label: "Open Remediation", href: "/dashboard/remediation" },
      done: state.remediationPosture.data.candidateCount > 0,
    },
    {
      n: 5,
      icon: LockClosedIcon,
      title: "Approvals awaiting",
      scope: "cross-cutting",
      sourceMode: state.approvalPosture.sourceMode,
      summary: state.approvalPosture.data.pendingCount === 0
        ? "Approval queue empty"
        : `${state.approvalPosture.data.pendingCount} pending approval${state.approvalPosture.data.pendingCount === 1 ? "" : "s"}`,
      counts: `${state.approvalPosture.data.highRiskCount} high-risk · ${state.approvalPosture.data.expiredCount} expired`,
      safeNextAction: state.approvalPosture.safeNextAction ?? { label: "Open Approvals", href: "/dashboard/approvals" },
      done: state.approvalPosture.data.pendingCount === 0 && state.approvalPosture.data.expiredCount === 0,
    },
    {
      n: 6,
      icon: ComputerDesktopIcon,
      title: "Desktop review",
      scope: "cross-cutting",
      sourceMode: state.desktopPosture.sourceMode,
      summary: state.desktopPosture.data.pairedSessions === 0
        ? "No desktop session paired"
        : `${state.desktopPosture.data.pairedSessions} paired session${state.desktopPosture.data.pairedSessions === 1 ? "" : "s"}`,
      counts: `Signing: ${state.desktopPosture.data.signingStatus.replace(/_/g, " ")} · local exec: disabled`,
      safeNextAction: state.desktopPosture.safeNextAction ?? { label: "Open desktop", href: "/download" },
      done: state.desktopPosture.data.pairedSessions > 0,
    },
    {
      n: 7,
      icon: DocumentTextIcon,
      title: "Trust evidence",
      scope: "cross-cutting",
      sourceMode: state.evidencePosture.sourceMode,
      summary: state.evidencePosture.data.totalRecords === 0
        ? "No evidence records yet"
        : `${state.evidencePosture.data.totalRecords} record${state.evidencePosture.data.totalRecords === 1 ? "" : "s"} · ${Math.round(state.evidencePosture.data.coverageScore * 100)}% coverage`,
      counts: `${state.evidencePosture.data.verifiedRecords} verified`,
      safeNextAction: state.evidencePosture.safeNextAction ?? { label: "Inspect evidence", href: "/dashboard/evidence" },
      done: state.evidencePosture.data.verifiedRecords > 0,
    },
  ];

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.02] via-white/[0.01] to-transparent p-6 md:p-8 relative overflow-hidden mb-8">
      <div
        className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
        style={{
          background:
            "radial-gradient(700px 280px at 90% 0%, rgba(99,102,241,0.06), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// {PROVIDER_LABEL[provider]} demo journey</p>
        <span className="text-[10px] font-mono text-zinc-600">·</span>
        <p className="text-[11px] font-mono text-zinc-500">{steps.filter((s) => s.done).length}/{steps.length} steps complete</p>
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight mb-5">
        Connect → Scan → Find → Remediate → Approve → Review → Evidence
      </h2>

      <ol className="relative space-y-3">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-white/[0.06]" aria-hidden />

        {steps.map((step) => (
          <StepRow key={step.n} step={step} />
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface JourneyStep {
  n: number;
  icon: typeof CloudIcon;
  title: string;
  scope: "provider" | "cross-cutting";
  sourceMode: string;
  summary: string;
  counts: string;
  safeNextAction?: { label: string; href: string };
  done: boolean;
}

function StepRow({ step }: { step: JourneyStep }) {
  const tone = toneOf(step.sourceMode);
  const Icon = step.done ? CheckCircleIcon : step.icon;
  return (
    <li className="relative pl-10">
      <div className={`absolute left-0 top-2 w-8 h-8 rounded-xl flex items-center justify-center border ${step.done ? "bg-emerald-500/[0.10] border-emerald-500/[0.30]" : "bg-white/[0.04] border-white/[0.10]"}`}>
        <Icon className={`h-4 w-4 ${step.done ? "text-emerald-300" : "text-zinc-300"}`} />
      </div>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15] transition-colors p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Step {step.n}</span>
              <h3 className="text-[14px] font-semibold text-white tracking-tight">{step.title}</h3>
              <span className={`inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider rounded-full px-1.5 py-px ${tone.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
                {step.sourceMode.replace(/_/g, " ")}
              </span>
              {step.scope === "cross-cutting" && (
                <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 border border-white/[0.06] rounded-full px-1.5 py-px">cross-cutting</span>
              )}
            </div>
            <p className="text-[12.5px] text-zinc-300 leading-relaxed mb-1">{step.summary}</p>
            <p className="text-[11px] text-zinc-500 leading-snug font-mono">{step.counts}</p>
          </div>
          {step.safeNextAction && (
            <Link
              href={step.safeNextAction.href}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors shrink-0"
            >
              {step.safeNextAction.label}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
