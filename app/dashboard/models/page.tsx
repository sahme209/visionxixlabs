/**
 * /dashboard/models — model registry.
 *
 * Catalog of local + cloud AI models the platform can invoke. Each
 * model carries license, hardware requirement, evaluation score, risk
 * level, and an approval state. A model that doesn't appear here as
 * approved cannot be invoked by any agent — that's the safety contract.
 *
 * Reads from lib/platform/platformSeedData.ts. No automatic downloads
 * happen from this page — model installation is desktop-side, gated by
 * the desktop runtime safety contract.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  CpuChipIcon,
  CloudIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import {
  DEMO_LOCAL_MODELS,
  type ModelStatus,
  type RiskLevel,
} from "@/lib/platform/platformSeedData";
import { DemoBadge } from "@/components/platform/DemoBadge";
import { PlatformHero } from "@/components/platform/PlatformHero";
import { getTenantFreshness } from "@/lib/platform/tenantFreshness";
import { TenantEmptyState } from "@/components/platform/TenantEmptyState";

export const metadata: Metadata = {
  title: "Model registry · Axiom",
  description:
    "Local and cloud AI models, with license, evaluation score, risk level, and an approved-vs-candidate gate. Only approved models can be invoked.",
};

const STATUS_TONE: Record<ModelStatus, string> = {
  approved:   "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  candidate:  "border-cyan-500/30    bg-cyan-500/10    text-cyan-300",
  evaluating: "border-amber-500/30   bg-amber-500/10   text-amber-300",
  rejected:   "border-rose-500/30    bg-rose-500/10    text-rose-300",
  installed:  "border-violet-500/30  bg-violet-500/10  text-violet-300",
};

const RISK_TONE: Record<RiskLevel, string> = {
  low:      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium:   "border-amber-500/30   bg-amber-500/10   text-amber-300",
  high:     "border-rose-500/30    bg-rose-500/10    text-rose-300",
  critical: "border-rose-500/40    bg-rose-500/15    text-rose-200",
};

const MODE_ICON = {
  local:  ComputerDesktopIcon,
  cloud:  CloudIcon,
  hybrid: CpuChipIcon,
};

export default async function ModelsPage() {
  const freshness = await getTenantFreshness();
  const showSampleData = !freshness.freshTenant;
  const byStatus = DEMO_LOCAL_MODELS.reduce<Record<ModelStatus, number>>(
    (acc, m) => {
      acc[m.status] += 1;
      return acc;
    },
    { approved: 0, candidate: 0, evaluating: 0, rejected: 0, installed: 0 },
  );

  return (
    <div className="relative">
      <PlatformHero
        eyebrow="AI ops · model registry"
        eyebrowTone="emerald"
        title="Model registry"
        description="Local + cloud AI models with license, evaluation score, hardware requirement, and approval state. Agents can only invoke an approved model. Installation is desktop-side and gated by the desktop runtime safety contract."
        gradientFromColor="radial-gradient(900px 320px at 14% 0%, rgba(45,212,191,0.12), transparent 60%), radial-gradient(700px 260px at 86% 110%, rgba(56,189,248,0.06), transparent 60%)"
        right={
          <>
            {showSampleData && (
              <>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2.5 py-1 text-[11px] font-mono">
                  {byStatus.approved} approved
                </span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-2.5 py-1 text-[11px] font-mono">
                  {byStatus.candidate} candidate
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2.5 py-1 text-[11px] font-mono">
                  {byStatus.evaluating} evaluating
                </span>
                <DemoBadge />
              </>
            )}
          </>
        }
      />

      {!showSampleData && (
        <div className="mb-6">
          <TenantEmptyState
            icon={CpuChipIcon}
            tone="emerald"
            eyebrow="Model registry empty"
            title="Curate your AI model fleet once your workspace is live."
            description="Approve cloud and local models for your team. Only approved models can be invoked by an agent — every other call is refused at the safety gate. Local models install via the desktop runtime; cloud models route through your selected provider with PII redaction applied first."
            agiNote="AGI proposes a starter shortlist (one general reasoning model, one secure local fallback) the moment a workspace is provisioned — you approve before anything runs."
            actions={[
              { href: "/dashboard/connectors", label: "Connect first cloud", variant: "primary" },
              { href: "/dashboard/ai-settings", label: "AI settings", variant: "ghost" },
            ]}
          />
        </div>
      )}

      {/* Models grid */}
      {showSampleData && (
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {DEMO_LOCAL_MODELS.map((m) => {
          const ModeIcon = MODE_ICON[m.mode];
          return (
            <article
              key={m.id}
              className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-5 hover:border-violet-500/30 hover:bg-white/[0.025] transition flex flex-col"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-white">{m.name}</p>
                  <p className="mt-0.5 text-[10.5px] font-mono text-zinc-500">
                    {m.source.replace("_", " ")} · {m.license} · {m.parameterCount}
                  </p>
                </div>
                <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap", STATUS_TONE[m.status]].join(" ")}>
                  {m.status}
                </span>
              </header>

              <div className="mt-3 flex flex-wrap gap-1.5 text-[10.5px] font-mono">
                <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-300 inline-flex items-center gap-1">
                  <ModeIcon className="h-3 w-3" />
                  {m.mode}
                </span>
                <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-zinc-300">
                  {m.modelType}
                </span>
                <span className={["rounded-full px-2 py-0.5 border whitespace-nowrap", RISK_TONE[m.riskLevel]].join(" ")}>
                  risk · {m.riskLevel}
                </span>
              </div>

              <p className="mt-3 text-[11px] text-zinc-500">
                Hardware: <span className="text-zinc-300">{m.hardware}</span>
              </p>

              {m.evaluationScore !== undefined ? (
                <div className="mt-3">
                  <div className="flex items-baseline justify-between text-[10.5px] font-mono uppercase tracking-widest text-zinc-500">
                    <span>eval score</span>
                    <span className="text-zinc-300">{(m.evaluationScore * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={[
                        "h-full transition-all",
                        m.evaluationScore >= 0.7
                          ? "bg-emerald-500/60"
                          : m.evaluationScore >= 0.5
                            ? "bg-amber-500/60"
                            : "bg-rose-500/60",
                      ].join(" ")}
                      style={{ width: `${m.evaluationScore * 100}%` }}
                      aria-hidden
                    />
                  </div>
                </div>
              ) : null}

              {m.supportedAgents.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1.5">
                    Supported agents
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.supportedAgents.map((a) => (
                      <span
                        key={a}
                        className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-0.5 text-[10.5px] font-mono text-zinc-300"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {m.notes ? (
                <p className="mt-3 text-[11.5px] text-zinc-500 leading-snug border-l-2 border-white/[0.08] pl-3">
                  {m.notes}
                </p>
              ) : null}
            </article>
          );
        })}
      </section>
      )}

      {/* Safety rail */}
      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <header className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-300" />
          <h2 className="text-[13px] font-semibold text-emerald-100">Model invocation rules</h2>
        </header>
        <ul className="text-[12.5px] text-emerald-100/85 leading-relaxed space-y-1.5 list-disc list-inside marker:text-emerald-400/80">
          <li>Only <em>approved</em> or <em>installed</em> models can be invoked by an agent — every other call is refused at the safety gate.</li>
          <li>Cloud models route through your selected provider with PII redaction applied before any prompt leaves your workspace.</li>
          <li>Local models only run via the paired desktop runtime — never auto-installed from this page.</li>
          <li>Every invocation is recorded against your workspace with cost and latency tracked per call.</li>
          <li>Rejected models remain on your registry as durable evidence of the decision.</li>
        </ul>
        <div className="mt-4 flex items-center gap-2">
          <Link
            href="/dashboard/ai-settings"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-medium text-emerald-200 hover:bg-emerald-500/15 transition"
          >
            AI settings
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <Link
            href="/dashboard/ai-usage"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
          >
            AI usage
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}
