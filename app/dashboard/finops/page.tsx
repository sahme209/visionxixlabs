"use client";

/**
 * /dashboard/finops
 *
 * FinOps foundation view. Honest cost-intelligence state. Until cost
 * telemetry connectors are wired, every signal is labeled honestly:
 * "evidence_unavailable" / "requires_cost_telemetry". Zero fabricated
 * dollar savings.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  ServerStackIcon,
  CloudIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";

type ConnectorStatus = "live" | "ready_pending_config" | "foundation" | "blocked" | "disabled";
type SignalStatus = "evidence_unavailable" | "review_recommended" | "potential_savings" | "requires_cost_telemetry";
type ConnectorId = "aws_cost_explorer" | "azure_cost_management" | "gcp_billing" | "github_actions_billing";

interface ConnectorLite {
  id: ConnectorId;
  label: string;
  status: ConnectorStatus;
  sourceMode: string;
  headline: string;
  missingConfig: string[];
  unlocks: string[];
  safeNextAction: { label: string; href: string };
  evidenceRef: string;
}

interface SignalLite {
  id: string;
  kind: "cost_visibility" | "optimization_opportunity" | "anomaly" | "forecast";
  title: string;
  description: string;
  status: SignalStatus;
  sourceMode: string;
  expectedOutcome: string;
  evidenceRefs: string[];
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

interface ReportLite {
  generatedAt: string;
  connectors: ConnectorLite[];
  signals: SignalLite[];
  summary: { liveConnectors: number; foundationConnectors: number; blockedConnectors: number; confirmedDollarSavings: 0; potentialOpportunities: number };
  overallStatus: "no_telemetry" | "partial_telemetry" | "full_telemetry";
  safetyContract: "no_fabricated_savings_or_costs";
  limitations: string[];
}

const STATUS_VISUAL: Record<ConnectorStatus, { border: string; bg: string; text: string; pill: string }> = {
  live:                 { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300" },
  ready_pending_config: { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300"     },
  foundation:           { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300"       },
  blocked:              { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300"       },
  disabled:             { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300"       },
};

const CONNECTOR_LABEL: Record<ConnectorStatus, string> = {
  live:                 "Live · cost data flowing",
  ready_pending_config: "Ready · pending config",
  foundation:           "Foundation",
  blocked:              "Blocked",
  disabled:             "Disabled",
};

const SIGNAL_LABEL: Record<SignalStatus, string> = {
  evidence_unavailable:    "Evidence unavailable",
  review_recommended:      "Review recommended",
  potential_savings:       "Potential savings opportunity",
  requires_cost_telemetry: "Requires cost telemetry",
};

const SIGNAL_TONE: Record<SignalStatus, { border: string; bg: string; text: string; pill: string }> = {
  evidence_unavailable:    { border: "border-zinc-700/30",       bg: "bg-white/[0.02]",       text: "text-zinc-400",   pill: "bg-zinc-700/40 text-zinc-300"   },
  review_recommended:      { border: "border-cyan-500/[0.22]",   bg: "bg-cyan-500/[0.04]",   text: "text-cyan-300",   pill: "bg-cyan-500/15 text-cyan-300"    },
  potential_savings:       { border: "border-emerald-500/[0.22]",bg: "bg-emerald-500/[0.04]", text: "text-emerald-300",pill: "bg-emerald-500/15 text-emerald-300" },
  requires_cost_telemetry: { border: "border-amber-500/[0.22]",  bg: "bg-amber-500/[0.04]",   text: "text-amber-300",  pill: "bg-amber-500/15 text-amber-300"  },
};

const CONNECTOR_ICON: Record<ConnectorId, typeof CloudIcon> = {
  aws_cost_explorer:      CloudIcon,
  azure_cost_management:  CloudIcon,
  gcp_billing:            CloudIcon,
  github_actions_billing: CodeBracketIcon,
};

export default function FinOpsPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/finops/summary", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "FinOps summary unavailable.");
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
      {/* Hero */}
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <CurrencyDollarIcon className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              FinOps · no_fabricated_savings_or_costs
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Cost <span className="text-gradient">intelligence.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Foundation surface for FinOps. <span className="text-zinc-500">Zero fabricated dollar savings. Every signal is labeled "evidence unavailable" / "requires cost telemetry" until real connectors land.</span>
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// loading FinOps state…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// FinOps unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          {/* Honest counts ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <SummaryStat label="Live connectors" value={report.summary.liveConnectors} tone={report.summary.liveConnectors > 0 ? "text-emerald-300" : "text-zinc-500"} />
            <SummaryStat label="Foundation" value={report.summary.foundationConnectors} tone="text-cyan-300" />
            <SummaryStat label="Confirmed savings" value={`$${report.summary.confirmedDollarSavings}`} tone="text-zinc-500" extraNote="literal · always 0 until telemetry" />
            <SummaryStat label="Potential opps." value={report.summary.potentialOpportunities} tone={report.summary.potentialOpportunities > 0 ? "text-emerald-300" : "text-zinc-500"} />
          </div>

          {/* Connectors */}
          <section className="mb-8">
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// cost connectors</p>
            <div className="grid lg:grid-cols-2 gap-2">
              {report.connectors.map((c) => {
                const v = STATUS_VISUAL[c.status];
                const Icon = CONNECTOR_ICON[c.id];
                return (
                  <div key={c.id} className={`rounded-2xl border ${v.border} ${v.bg} p-4`}>
                    <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-4.5 w-4.5 ${v.text}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold text-white tracking-tight">{c.label}</p>
                          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">{c.sourceMode}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill}`}>
                        {CONNECTOR_LABEL[c.status]}
                      </span>
                    </div>
                    <p className="text-[12px] text-zinc-300 leading-relaxed mb-2">{c.headline}</p>

                    {c.missingConfig.length > 0 && (
                      <div className="rounded-md border border-amber-500/[0.18] bg-amber-500/[0.04] p-2 mb-2">
                        <p className="text-[9px] font-mono text-amber-300/80 uppercase tracking-wider mb-1">Setup needed</p>
                        <ul className="space-y-0.5">
                          {c.missingConfig.map((m, i) => (
                            <li key={i} className="text-[10px] font-mono text-zinc-300">{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">unlocks:</span>
                      {c.unlocks.map((u, i) => (
                        <span key={i} className="text-[10px] font-mono text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">{u}</span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Link href={c.safeNextAction.href} className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white">
                        {c.safeNextAction.label}
                        <ArrowRightIcon className="h-3 w-3" />
                      </Link>
                      <span className="text-[9px] font-mono text-zinc-500">evidence: {c.evidenceRef}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Signals */}
          <section className="mb-8">
            <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-3">// cost signals (honest preview)</p>
            <div className="space-y-2">
              {report.signals.map((s) => {
                const v = SIGNAL_TONE[s.status];
                return (
                  <div key={s.id} className={`rounded-2xl border ${v.border} ${v.bg} p-4`}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <ServerStackIcon className={`h-3.5 w-3.5 ${v.text}`} />
                      <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill}`}>
                        {SIGNAL_LABEL[s.status]}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{s.kind.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-[13.5px] font-semibold text-white tracking-tight">{s.title}</p>
                    <p className="text-[12px] text-zinc-300 leading-relaxed mt-0.5">{s.description}</p>
                    <p className="text-[11px] text-zinc-400 italic leading-snug mt-2">
                      <span className="text-zinc-500 font-mono uppercase tracking-wider text-[9px]">expected outcome:</span> {s.expectedOutcome}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-2 flex-wrap text-[10px] font-mono text-zinc-500">
                      <span>{s.limitations[0]}</span>
                      <Link href={s.safeNextAction.href} className="inline-flex items-center gap-1 text-zinc-300 hover:text-white">
                        {s.safeNextAction.label}
                        <ArrowRightIcon className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Contract footer */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// FinOps contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
                {report.limitations.join(" ")}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone, extraNote }: { label: string; value: number | string; tone: string; extraNote?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
      {extraNote && <p className="text-[9px] font-mono text-zinc-500 mt-0.5">{extraNote}</p>}
    </div>
  );
}
