"use client";

/**
 * /dashboard/integrations/health
 *
 * Integration Health Center — one row per major source Axiom reads
 * from. Fetches /api/integrations/health and renders status / source
 * mode / headline / missing config / safeNextAction per integration.
 *
 * Replaces the implicit assumption that operators can infer health
 * by visiting each provider drilldown. Now one page tells them
 * which sources are healthy, blocked, or preview.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  EyeIcon,
  MinusCircleIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";

type IntegrationHealthStatus = "healthy" | "degraded" | "preview" | "blocked" | "disabled" | "unknown";
type IntegrationHealthSourceMode = "live" | "partial_live" | "preview" | "foundation" | "planned" | "disabled" | "blocked" | "unknown";

interface IntegrationHealthEntryLite {
  id: string;
  label: string;
  status: IntegrationHealthStatus;
  sourceMode: IntegrationHealthSourceMode;
  headline: string;
  lastCheckedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  failureReason?: string;
  missingConfig: string[];
  missingPermissions: string[];
  limitations: string[];
  safeNextAction?: { label: string; href: string };
  setupRoute?: string;
  evidenceRefs: string[];
}

interface IntegrationHealthReportLite {
  generatedAt: string;
  overallStatus: IntegrationHealthStatus;
  overallSourceMode: IntegrationHealthSourceMode;
  entries: IntegrationHealthEntryLite[];
  summary: { total: number; healthy: number; degraded: number; preview: number; blocked: number; disabled: number };
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const STATUS_VISUAL: Record<IntegrationHealthStatus, { border: string; bg: string; text: string; pill: string; icon: typeof CheckCircleIcon }> = {
  healthy:  { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", icon: CheckCircleIcon       },
  degraded: { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon },
  preview:  { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: EyeIcon                 },
  blocked:  { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300",       icon: XCircleIcon             },
  disabled: { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       icon: MinusCircleIcon         },
  unknown:  { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       icon: MinusCircleIcon         },
};

export default function IntegrationHealthPage() {
  const [report, setReport] = useState<IntegrationHealthReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations/health", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: IntegrationHealthReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Integration health unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const overall = report?.overallStatus ?? "preview";
  const overallTone = STATUS_VISUAL[overall];

  return (
    <div className="relative">
      {/* Hero */}
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="grid md:grid-cols-[1fr_auto] items-end gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
                <ServerStackIcon className="h-3.5 w-3.5 text-cyan-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
                  Integration health · {(report?.overallSourceMode ?? "preview").replace(/_/g, " ")}
                </span>
              </span>
              {report?.generatedAt && (
                <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
              )}
              <Link href="/dashboard/integrations" className="text-[10px] text-zinc-500 hover:text-white transition-colors ml-auto">All connectors →</Link>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              Are my sources <span className="text-gradient">healthy?</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              One row per source. Real status, real source mode, real missing config — no fake healthy state. <span className="text-zinc-500">Derived from canonical AxiomOSState; pure read-only.</span>
            </p>
          </div>

          {report && (
            <div className="hidden md:flex items-end gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
              <Stat label="Healthy" value={report.summary.healthy} tone="text-emerald-300" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Preview" value={report.summary.preview + report.summary.degraded} tone="text-amber-300" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Blocked" value={report.summary.blocked} tone={report.summary.blocked > 0 ? "text-rose-300" : "text-zinc-500"} />
            </div>
          )}
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing health report…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// health unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {/* Overall callout */}
      {!loading && !error && report && (
        <div className={`rounded-2xl border ${overallTone.border} ${overallTone.bg} p-5 mb-6 flex items-start gap-3`}>
          <overallTone.icon className={`h-5 w-5 ${overallTone.text} mt-0.5 shrink-0`} />
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-mono uppercase tracking-[0.18em] ${overallTone.text} mb-1`}>// overall · {overall}</p>
            <p className="text-[13px] text-white font-semibold leading-snug">
              {overall === "healthy"  ? `All ${report.summary.total} sources healthy.` :
               overall === "blocked"  ? `${report.summary.blocked} source${report.summary.blocked === 1 ? "" : "s"} blocked — operator action required.` :
               overall === "degraded" ? `Mixed state · ${report.summary.healthy} healthy, ${report.summary.degraded + report.summary.preview} preview / degraded.` :
               overall === "preview"  ? `Mostly preview state — wire credentials to unlock live sources.` :
                                        `Source mode: ${report.overallSourceMode.replace(/_/g, " ")}.`}
            </p>
            {report.limitations.length > 0 && (
              <p className="text-[11px] text-zinc-500 mt-1.5 leading-snug">{report.limitations[0]}</p>
            )}
          </div>
        </div>
      )}

      {/* Per-source rows */}
      {!loading && !error && report && (
        <div className="space-y-3 mb-10">
          {report.entries.map((e) => {
            const v = STATUS_VISUAL[e.status];
            const Icon = v.icon;
            return (
              <div key={e.id} className={`rounded-2xl border ${v.border} ${v.bg} p-5 hover:-translate-y-0.5 transition-all`}>
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4.5 w-4.5 ${v.text}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-white tracking-tight">{e.label}</h3>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                        sourceMode: {e.sourceMode.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill} shrink-0`}>
                    {e.status}
                  </span>
                </div>

                <p className="text-[12.5px] text-zinc-300 leading-relaxed mb-3">{e.headline}</p>

                {/* Timeline strip */}
                <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono mb-3 flex-wrap">
                  <span>checked {new Date(e.lastCheckedAt).toLocaleTimeString()}</span>
                  {e.lastSuccessAt && <span>· last success {new Date(e.lastSuccessAt).toLocaleTimeString()}</span>}
                  {e.lastFailureAt && <span className="text-rose-300/80">· last failure {new Date(e.lastFailureAt).toLocaleTimeString()}</span>}
                </div>

                {e.failureReason && (
                  <div className="rounded-md border border-rose-500/[0.18] bg-rose-500/[0.04] p-2.5 mb-3">
                    <p className="text-[10px] font-mono text-rose-300/80 uppercase tracking-wider mb-1">// failure reason</p>
                    <p className="text-[12px] text-zinc-200 leading-snug">{e.failureReason}</p>
                  </div>
                )}

                {e.missingConfig.length > 0 && (
                  <div className="rounded-md border border-amber-500/[0.18] bg-amber-500/[0.04] p-2.5 mb-3">
                    <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider mb-1">Setup needed</p>
                    <ul className="space-y-0.5">
                      {e.missingConfig.slice(0, 4).map((c, i) => (
                        <li key={i} className="text-[11px] text-zinc-300 font-mono leading-snug">{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {e.limitations.length > 0 && (
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5 mb-3">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// limitations</p>
                    <ul className="space-y-0.5">
                      {e.limitations.slice(0, 2).map((l, i) => (
                        <li key={i} className="text-[11px] text-zinc-400 leading-snug">{l}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  {e.safeNextAction && (
                    <Link
                      href={e.safeNextAction.href}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors"
                    >
                      {e.safeNextAction.label}
                      <ArrowRightIcon className="h-3 w-3" />
                    </Link>
                  )}
                  {e.setupRoute && (
                    <Link
                      href={e.setupRoute}
                      className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-white transition-colors"
                    >
                      Setup docs
                    </Link>
                  )}
                  {e.evidenceRefs.length > 0 && (
                    <span className="text-[10px] font-mono text-zinc-600 ml-auto">
                      {e.evidenceRefs[0]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="text-right min-w-[4.5rem]">
      <p className={`text-2xl font-bold tracking-tight leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}
