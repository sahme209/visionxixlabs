"use client";

/**
 * ProviderDrilldown — shared drilldown view for /dashboard/{aws,azure,gcp,github}.
 *
 * Renders a single canonical ProviderPosture + matching operating loop +
 * critical blockers + safe-next-action — all from /api/axiom-os/state.
 *
 * No fabricated values. Every provider page is a thin wrapper around this.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CloudIcon,
  CodeBracketIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  KeyIcon,
  IdentificationIcon,
  GlobeAltIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import {
  resolveSetupSteps,
  GROUP_LABEL,
  type ConnectorSetupStep,
} from "@/lib/cloud/connectorSetupSteps";
import { PageIntro } from "@/components/dashboard/PageIntro";

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

interface CriticalBlockerLite {
  area: string;
  reason: string;
  safeNextAction?: { label: string; href: string };
}

interface AxiomOSStateLite {
  generatedAt: string;
  sourceMode: string;
  providers: ProviderPostureLite[];
  operatingLoops: OperatingLoopLite[];
  criticalBlockers: CriticalBlockerLite[];
  limitations: string[];
}

const PROVIDER_META: Record<string, { label: string; tagline: string; docs: string; icon: typeof CloudIcon }> = {
  aws:    { label: "AWS",    tagline: "Live read-only inventory across EC2 / S3 / RDS / VPC / SG / IAM",     docs: "/docs/aws-setup",                              icon: CloudIcon       },
  azure:  { label: "Azure",  tagline: "Live SP validation + preview ARM inventory foundation",              docs: "/docs/azure-setup",                            icon: CloudIcon       },
  gcp:    { label: "GCP",    tagline: "Live SA validation + preview Compute/Storage inventory foundation",  docs: "/docs/gcp-setup",                              icon: CloudIcon       },
  github: { label: "GitHub", tagline: "Live read-only repo / workflow / branch protection / deployment env",docs: "/docs/architecture#github-connector",          icon: CodeBracketIcon },
};

const MODE_TONE: Record<string, { border: string; bg: string; text: string; pill: string; dot: string }> = {
  live:         { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-400 animate-pulse" },
  partial_live: { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       dot: "bg-cyan-400 animate-pulse"    },
  expanding:    { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     dot: "bg-amber-400"                 },
  preview:      { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     dot: "bg-amber-400"                 },
  blocked:      { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300",       dot: "bg-rose-400"                  },
  disabled:     { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       dot: "bg-zinc-600"                  },
  unknown:      { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       dot: "bg-zinc-600"                  },
};

export function ProviderDrilldown({ providerId }: { providerId: "aws" | "azure" | "gcp" | "github" }) {
  const [state, setState] = useState<AxiomOSStateLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const meta = PROVIDER_META[providerId];

  useEffect(() => {
    let cancelled = false;
    fetch("/api/axiom-os/state", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: AxiomOSStateLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setState(json.data);
        else setError(json.error?.userMessage ?? "Provider state unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const provider = state?.providers.find((p) => p.provider === providerId);
  const loop = state?.operatingLoops.find((l) => l.provider === providerId);
  const blockers = (state?.criticalBlockers ?? []).filter((b) =>
    b.area.toLowerCase().includes(providerId) || b.reason.toLowerCase().includes(providerId)
  );

  const tone = MODE_TONE[provider?.mode ?? "preview"] ?? MODE_TONE.preview;
  const Icon = meta.icon;

  return (
    <div className="relative">
      <PageIntro
        kicker={`Cloud · ${meta.label.toLowerCase()} · ${(provider?.mode ?? (loading ? "composing…" : "preview")).replace(/_/g, " ")}${state?.generatedAt ? ` · last sync ${new Date(state.generatedAt).toLocaleTimeString()}` : ""}`}
        title={<>{meta.label} <span className="text-zinc-500">connector.</span></>}
        description={meta.tagline}
        helps={`See inventory, posture, cost, and findings specific to ${meta.label}. Per-region resource counts, top recommendations, and connection mode are surfaced from canonical state.`}
        connectFirst={`${meta.label} credentials wired via /dashboard/connectors. The drill-down fills in the moment your first scan completes.`}
        engineers={["Cloud", "Security", "FinOps", "Incident"]}
        requiresApproval={`Any write action proposed against your ${meta.label} resources. Read-only scans run automatically.`}
        actions={[
          { label: "Manage cloud connectors", href: "/dashboard/connectors" },
          { label: "Compare across providers", href: "/dashboard/multi-cloud" },
        ]}
        safetyNote="Read-only by default · Approval-gated execution · Sessions short-lived"
      />

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing posture…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// state unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && provider && (
        <>
          {/* Posture card */}
          <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-6 mb-6`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${tone.dot}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${tone.text}`}>{provider.mode.replace(/_/g, " ")}</span>
              <span className="text-[10px] font-mono text-zinc-500 ml-auto">{provider.connectionStatus.replace(/_/g, " ")}</span>
            </div>
            <p className="text-base font-semibold text-white mb-1 tracking-tight">{provider.headline}</p>
            <div className="flex items-center gap-4 text-[12px] text-zinc-400">
              {typeof provider.resourceCount === "number" && <span>{provider.resourceCount} resources</span>}
              {typeof provider.findingCount === "number" && (
                <span className={provider.findingCount > 0 ? "text-amber-300" : "text-emerald-300"}>
                  {provider.findingCount} attention-required
                </span>
              )}
              {provider.lastScannedAt && <span>last scan {new Date(provider.lastScannedAt).toLocaleTimeString()}</span>}
            </div>

            {provider.missingRequirements.length > 0 && (
              <ProviderSetupGuide rawRequirements={provider.missingRequirements} />
            )}

            <div className="flex items-center gap-4 mt-4">
              {provider.safeNextAction && (
                <Link href={provider.safeNextAction.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white transition-colors">
                  {provider.safeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
                </Link>
              )}
              <Link href={meta.docs} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-white transition-colors">Setup docs →</Link>
              <Link href="/docs/source-modes" className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-white transition-colors">What do these modes mean?</Link>
            </div>
          </div>

          {/* Operating loop summary */}
          {loop && (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-2">// operating loop</p>
              <div className="grid sm:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Current stage</p>
                  <p className="text-sm font-semibold text-white tracking-tight">{loop.currentStage.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Status</p>
                  <p className="text-sm font-semibold text-white tracking-tight">{loop.status.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Source mode</p>
                  <p className="text-sm font-semibold text-white tracking-tight">{loop.sourceMode.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Attention</p>
                  <p className={`text-sm font-semibold tracking-tight ${loop.attentionRequiredCount > 0 ? "text-amber-300" : "text-emerald-300"}`}>
                    {loop.attentionRequiredCount} required
                  </p>
                </div>
              </div>
              {loop.topSafeNextAction && (
                <Link href={loop.topSafeNextAction.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white transition-colors">
                  {loop.topSafeNextAction.label} <ArrowRightIcon className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}

          {/* Blockers */}
          {blockers.length > 0 && (
            <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6">
              <p className="text-[11px] font-mono text-rose-300/80 uppercase tracking-[0.18em] mb-2">// critical blockers</p>
              <ul className="space-y-2">
                {blockers.map((b, i) => (
                  <li key={i} className="text-[12px] text-rose-200/90 leading-relaxed">
                    <span className="font-semibold">{b.area}:</span> {b.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Safety footer */}
      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// safety contract</p>
            <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
              Read-only. Mutations require approval. {meta.label} writes are disabled by safety contract.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Guided setup card — replaces the bare AZURE_TENANT_ID / etc. list
 * with a labeled step list. Operators see "Azure directory (tenant) ID"
 * with a short description and a help link. The raw env-var name is
 * still surfaced in a small monospace line so engineers wiring the
 * back-end env still know what to set.
 */
function ProviderSetupGuide({ rawRequirements }: { rawRequirements: readonly string[] }) {
  const steps = resolveSetupSteps(rawRequirements);
  if (steps.length === 0) return null;

  // Group steps by their category so identity / credential / scope cards
  // are visually clustered, not interleaved.
  const byGroup: Record<string, ConnectorSetupStep[]> = {};
  for (const s of steps) {
    (byGroup[s.group] ??= []).push(s);
  }
  const groupOrder = Object.keys(byGroup) as Array<ConnectorSetupStep["group"]>;

  return (
    <div className="mt-4 rounded-xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-4">
      <div className="flex items-start gap-2 mb-3">
        <KeyIcon className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
        <div>
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em]">
            connection required · {steps.length} step{steps.length === 1 ? "" : "s"}
          </p>
          <p className="text-[12.5px] text-amber-100 mt-1 leading-snug">
            Provide the items below to switch this connector from preview to live.
            Secrets are stored encrypted; nothing is written without an approval packet.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {groupOrder.map((group) => {
          const items = byGroup[group];
          const GroupIcon =
            group === "credential" ? LockClosedIcon
            : group === "identity"   ? IdentificationIcon
            : group === "scope"      ? GlobeAltIcon
            : QuestionMarkCircleIcon;
          return (
            <div key={group} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-400 mb-2 inline-flex items-center gap-1.5">
                <GroupIcon className="h-3 w-3" />
                {GROUP_LABEL[group]}
              </p>
              <ul className="space-y-2">
                {items.map((step) => (
                  <li key={step.envVar} className="flex items-start gap-2.5">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400/80 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[12.5px] font-semibold text-white">{step.label}</p>
                        {step.isSecret && (
                          <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-widest text-rose-300">
                            secret
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-zinc-400 leading-snug">{step.description}</p>
                      <div className="mt-1 flex items-center gap-3 flex-wrap">
                        <code className="text-[10px] font-mono text-zinc-500" title="Environment variable name">
                          env · {step.envVar}
                        </code>
                        {step.helpHref && (
                          <Link
                            href={step.helpHref}
                            className="text-[10.5px] font-medium text-violet-300 hover:text-violet-200 transition inline-flex items-center gap-0.5"
                          >
                            where do I find this? <ArrowRightIcon className="h-2.5 w-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <details className="mt-3">
        <summary className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-zinc-500 cursor-pointer hover:text-zinc-300 transition">
          // advanced · raw env var names
        </summary>
        <ul className="mt-2 space-y-0.5">
          {steps.map((s) => (
            <li key={s.envVar} className="text-[11px] text-zinc-400 font-mono">{s.envVar}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
