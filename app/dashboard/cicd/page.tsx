"use client";

/**
 * /dashboard/cicd — CI/CD Live Operations.
 *
 * One canonical view of every CI/CD provider Axiom understands +
 * the closed operation catalog with hard-literal classification.
 * Mutations are declared, gated, and routed through the autonomy
 * loop. Hard-blocked operations are explicit.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  CodeBracketIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

type Provider = "github_actions" | "gitlab_ci" | "aws_codepipeline" | "gcp_cloud_build" | "azure_devops" | "circleci" | "jenkins";
type Classification = "readonly_allowed" | "policy_gated" | "approval_required" | "desktop_review_required" | "unsafe_never_automate" | "disabled_until_policy" | "disabled_until_credentials";

interface OpLite {
  kind: string;
  classification: Classification;
  label: string;
  description: string;
  rationale: string;
  evidenceRef: string;
  requiredPolicyId?: string;
}

interface ProviderLite {
  provider: Provider;
  mode: string;
  configured: boolean;
  headline: string;
  missingRequirements: string[];
  safeNextAction: { label: string; href: string };
}

interface ReportLite {
  generatedAt: string;
  providers: ProviderLite[];
  operations: OpLite[];
  summary: {
    providerCount: number;
    liveProviderCount: number;
    runsTotal: number;
    operationsTotal: number;
    operationsReadonly: number;
    operationsPolicyGated: number;
    operationsApprovalRequired: number;
    operationsDesktopReview: number;
    operationsHardBlocked: number;
  };
  overallSourceMode: string;
  safetyContract: "cicd_ops_gated_no_unsafe_execution";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const CLASSIFICATION_VISUAL: Record<Classification, { pill: string; icon: typeof CheckCircleIcon; label: string }> = {
  readonly_allowed:            { pill: "bg-emerald-500/15 text-emerald-300", icon: CheckCircleIcon,         label: "read-only" },
  policy_gated:                { pill: "bg-cyan-500/15 text-cyan-300",       icon: ClockIcon,               label: "policy-gated" },
  approval_required:           { pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon, label: "approval" },
  desktop_review_required:     { pill: "bg-violet-500/15 text-violet-300",   icon: ClockIcon,               label: "desktop review" },
  unsafe_never_automate:       { pill: "bg-rose-500/15 text-rose-300",       icon: LockClosedIcon,          label: "unsafe · never" },
  disabled_until_policy:       { pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon, label: "disabled · policy" },
  disabled_until_credentials:  { pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon, label: "disabled · creds" },
};

const PROVIDER_LABEL: Record<Provider, string> = {
  github_actions:   "GitHub Actions",
  gitlab_ci:        "GitLab CI",
  aws_codepipeline: "AWS CodePipeline",
  gcp_cloud_build:  "GCP Cloud Build",
  azure_devops:     "Azure DevOps",
  circleci:         "CircleCI",
  jenkins:          "Jenkins",
};

export default function CicdOpsPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cicd", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "CI/CD surface unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="relative">
      <PageIntro
        kicker="Operations · CI/CD"
        title={<>Every pipeline. <span className="text-zinc-500">Every gate.</span></>}
        description="GitHub Actions, GitLab CI, AWS CodePipeline, GCP Cloud Build, Azure DevOps, CircleCI, Jenkins — one closed operation catalog. Force-merge, push-to-protected-ref, signing-key rotation, and workflow YAML edits are hard-blocked at the type level."
        helps="See pipeline state across every provider, with policy-gated vs hard-blocked operations called out per pipeline."
        connectFirst="A code/CI connector — GitHub, GitLab, Azure DevOps, or any of the cloud-native pipeline runners."
        engineers={["DevOps Engineer", "Build / CI Engineer", "Security Engineer"]}
        requiresApproval="Every write action — deploy, force-merge, secret rotation. Hard-blocked actions never run."
        actions={[
          { label: "Manage connectors", href: "/dashboard/connectors" },
          { label: "View approvals", href: "/dashboard/approvals" },
        ]}
        safetyNote="Hard-blocked operations are unreachable at the type level · approval_only_no_execution"
      />

      {report && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Providers" value={String(report.summary.providerCount)} tone="zinc" />
          <Stat label="Live" value={String(report.summary.liveProviderCount)} tone={report.summary.liveProviderCount > 0 ? "emerald" : "amber"} />
          <Stat label="Operations" value={String(report.summary.operationsTotal)} tone="cyan" />
          <Stat label="Policy-gated" value={String(report.summary.operationsPolicyGated)} tone="cyan" />
          <Stat label="Hard-blocked" value={String(report.summary.operationsHardBlocked)} tone="rose" />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing CI/CD surface…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// surface unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          {/* Provider posture */}
          <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">// providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {report.providers.map((p) => (
              <div key={p.provider} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-white">{PROVIDER_LABEL[p.provider]}</p>
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                    p.mode === "live" ? "bg-emerald-500/15 text-emerald-300" :
                    p.mode === "partial_live" ? "bg-cyan-500/15 text-cyan-300" :
                    "bg-amber-500/15 text-amber-300"
                  }`}>{p.mode.replace(/_/g, " ")}</span>
                </div>
                <p className="text-[11.5px] text-zinc-300 leading-snug">{p.headline}</p>
                {p.missingRequirements.length > 0 && (
                  <div className="mt-2 rounded-md border border-amber-500/[0.12] bg-amber-500/[0.03] p-2">
                    <p className="text-[9px] font-mono text-amber-300/80 uppercase tracking-wider mb-0.5">Setup needed</p>
                    {p.missingRequirements.map((m, i) => (
                      <p key={i} className="text-[10.5px] font-mono text-zinc-300">{m}</p>
                    ))}
                  </div>
                )}
                <Link href={p.safeNextAction.href} className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-zinc-300 hover:text-white">
                  {p.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>

          {/* Operations catalog */}
          <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">// operation catalog</h2>
          <div className="space-y-1.5 mb-8">
            {report.operations.map((o) => {
              const v = CLASSIFICATION_VISUAL[o.classification];
              const Icon = v.icon;
              return (
                <div key={o.kind} className="flex items-start gap-2 rounded-md border border-white/[0.04] bg-white/[0.015] p-2.5">
                  <Icon className="h-3.5 w-3.5 text-white/60 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] text-white font-medium">{o.label}</span>
                      <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${v.pill}`}>{v.label}</span>
                      {o.requiredPolicyId && (
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">policy: {o.requiredPolicyId}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">{o.description}</p>
                    <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{o.rationale}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// CI/CD contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">{report.limitations.join(" ")}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "cyan" | "rose" | "zinc" }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    cyan:    "border-cyan-500/[0.18] bg-cyan-500/[0.03] text-cyan-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[20px] font-bold mt-1">{value}</p>
    </div>
  );
}
