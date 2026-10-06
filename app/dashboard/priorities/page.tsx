"use client";

/**
 * /dashboard/priorities
 *
 * Operational Priority engine view. Fetches /api/intelligence/priorities
 * and renders the ranked priority list with full score breakdowns — so
 * operators can audit why each item is ranked where it is.
 *
 * No fake AI. No hidden reasoning. The score formula is transparent:
 *   composite = severityWeight × evidenceMultiplier × confidenceMultiplier × blockerPenalty
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  LockClosedIcon,
  CloudIcon,
  WrenchScrewdriverIcon,
  ComputerDesktopIcon,
  DocumentTextIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

type Severity = "critical" | "high" | "medium" | "low" | "info";
type Urgency  = "now" | "this_week" | "this_month" | "scheduled";
type SourceMode = "live" | "partial_live" | "preview" | "foundation" | "planned" | "blocked" | "disabled" | "unknown";
type Category =
  | "security_finding" | "release_blocker" | "integration_blocker" | "policy_violation"
  | "readiness_blocker" | "approval_pending" | "desktop_blocker" | "evidence_gap"
  | "operational_drift" | "recurring";

interface ScoreBreakdown {
  severityWeight: number;
  evidenceMultiplier: number;
  confidenceMultiplier: number;
  blockerPenalty: number;
  composite: number;
}

interface PriorityItemLite {
  id: string;
  rank: number;
  title: string;
  reasonSummary: string;
  category: Category;
  severity: Severity;
  urgency: Urgency;
  confidence: number;
  score: ScoreBreakdown;
  sourceSystem: string;
  sourceMode: SourceMode;
  affectedSystem?: string;
  blockedBy?: string;
  whyItMatters: string;
  technicalImpactSummary?: string;
  businessImpactSummary?: string;
  safeNextAction: { label: string; href: string };
  limitations: string[];
  evidenceRefs: string[];
  linkedGraphNodeIds: string[];
}

interface PriorityReportLite {
  generatedAt: string;
  items: PriorityItemLite[];
  summary: { total: number; critical: number; high: number; medium: number; low: number; info: number; blockedByConfig: number; blockedByPolicy: number };
  averageConfidence: number;
  overallSourceMode: SourceMode;
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const SEVERITY_VISUAL: Record<Severity, { border: string; bg: string; text: string; pill: string; dot: string }> = {
  critical: { border: "border-rose-500/[0.28]",   bg: "bg-rose-500/[0.05]",   text: "text-rose-300",    pill: "bg-rose-500/20 text-rose-200",      dot: "bg-rose-400 animate-pulse"   },
  high:     { border: "border-amber-500/[0.22]",  bg: "bg-amber-500/[0.05]",  text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",    dot: "bg-amber-400 animate-pulse"  },
  medium:   { border: "border-cyan-500/[0.22]",   bg: "bg-cyan-500/[0.04]",   text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",      dot: "bg-cyan-400"                 },
  low:      { border: "border-zinc-700/30",       bg: "bg-white/[0.02]",      text: "text-zinc-300",    pill: "bg-zinc-700/40 text-zinc-300",      dot: "bg-zinc-500"                 },
  info:     { border: "border-zinc-700/30",       bg: "bg-white/[0.02]",      text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",      dot: "bg-zinc-600"                 },
};

const CATEGORY_ICON: Record<Category, typeof CloudIcon> = {
  security_finding:    ShieldExclamationIcon,
  release_blocker:     WrenchScrewdriverIcon,
  integration_blocker: CloudIcon,
  policy_violation:    LockClosedIcon,
  readiness_blocker:   ExclamationTriangleIcon,
  approval_pending:    LockClosedIcon,
  desktop_blocker:     ComputerDesktopIcon,
  evidence_gap:        DocumentTextIcon,
  operational_drift:   ChartBarIcon,
  recurring:           ClockIcon,
};

export default function PrioritiesPage() {
  const [report, setReport] = useState<PriorityReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/intelligence/priorities", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: PriorityReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Priority report unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
                <ChartBarIcon className="h-3.5 w-3.5 text-cyan-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
                  Operational priorities · {(report?.overallSourceMode ?? "preview").replace(/_/g, " ")}
                </span>
              </span>
              {report?.generatedAt && (
                <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              What matters <span className="text-gradient">most right now.</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              Ranked by canonical signals. Every item shows its score formula — operators can audit why it lands where it does. <span className="text-zinc-500">No hidden reasoning. Confidence reflects evidence quality + source mode.</span>
            </p>
          </div>

          {report && (
            <div className="hidden md:flex items-end gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
              <Stat label="Critical" value={report.summary.critical} tone={report.summary.critical > 0 ? "text-rose-300" : "text-zinc-500"} />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="High" value={report.summary.high} tone={report.summary.high > 0 ? "text-amber-300" : "text-zinc-500"} />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Avg conf." value={Math.round(report.averageConfidence * 100) + "%"} tone="text-white" />
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// scoring canonical priorities…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// priorities unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && report.items.length === 0 && (
        <div className="rounded-2xl border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-6 mb-6">
          <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// queue clear</p>
          <p className="text-[14px] text-emerald-100 font-semibold">No operational priorities require attention.</p>
          <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">No critical findings, no pending approvals, no integration blockers. Use the recurring scan schedule to keep this true.</p>
        </div>
      )}

      {/* Priority rows */}
      {!loading && !error && report && report.items.length > 0 && (
        <div className="space-y-3 mb-10">
          {report.items.map((item) => {
            const sev = SEVERITY_VISUAL[item.severity];
            const Icon = CATEGORY_ICON[item.category];
            const isExpanded = expanded.has(item.id);
            return (
              <div key={item.id} className={`rounded-2xl border ${sev.border} ${sev.bg} hover:-translate-y-0.5 transition-all overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="w-full text-left p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 rounded-lg border ${sev.border} ${sev.bg} w-9 h-9 flex items-center justify-center`}>
                      <Icon className={`h-4.5 w-4.5 ${sev.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-zinc-500">#{item.rank}</span>
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${sev.pill}`}>
                          {item.severity}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">
                          {item.urgency.replace(/_/g, " ")}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                          {item.sourceMode.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 ml-auto">score {item.score.composite}</span>
                      </div>
                      <p className="text-[14px] font-semibold text-white tracking-tight leading-snug mb-1">{item.title}</p>
                      <p className="text-[12.5px] text-zinc-300 leading-relaxed">{item.reasonSummary}</p>

                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <span className="text-[11px] text-zinc-500 font-mono">
                          confidence {Math.round(item.confidence * 100)}%
                        </span>
                        {item.affectedSystem && <span className="text-[11px] text-zinc-500 font-mono">· {item.affectedSystem}</span>}
                        {item.blockedBy && <span className="text-[11px] text-rose-300/80 font-mono">· blocked by {item.blockedBy.replace(/_/g, " ")}</span>}
                        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{isExpanded ? "−" : "+"} score detail</span>
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 space-y-4">
                    {/* Score breakdown */}
                    <div className="rounded-lg bg-black/30 border border-white/[0.06] p-3">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2">// score breakdown</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                        <Factor label="Severity" value={item.score.severityWeight} />
                        <Factor label="× Evidence" value={item.score.evidenceMultiplier.toFixed(2)} />
                        <Factor label="× Confidence" value={item.score.confidenceMultiplier.toFixed(2)} />
                        <Factor label="× Blocker" value={item.score.blockerPenalty.toFixed(2)} />
                      </div>
                      <p className="text-[11px] font-mono text-emerald-300 mt-2">= composite {item.score.composite}</p>
                    </div>

                    {/* Why it matters */}
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// why it matters</p>
                      <p className="text-[12px] text-zinc-300 leading-relaxed">{item.whyItMatters}</p>
                    </div>

                    {item.technicalImpactSummary && (
                      <div>
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// technical impact</p>
                        <p className="text-[12px] text-zinc-300 leading-relaxed">{item.technicalImpactSummary}</p>
                      </div>
                    )}

                    {item.limitations.length > 0 && (
                      <div className="rounded-md border border-amber-500/[0.18] bg-amber-500/[0.04] p-2.5">
                        <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider mb-1">// limitations</p>
                        <ul className="space-y-0.5">
                          {item.limitations.slice(0, 2).map((l, i) => (
                            <li key={i} className="text-[11px] text-zinc-300 leading-snug">{l}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {item.evidenceRefs.length > 0 && (
                      <div>
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// evidence refs</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.evidenceRefs.map((ref, i) => (
                            <span key={i} className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">{ref}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="text-[11px] text-zinc-500">Safe next step</p>
                      <Link
                        href={item.safeNextAction.href}
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors"
                      >
                        {item.safeNextAction.label}
                        <ArrowRightIcon className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Engine contract footer */}
      {!loading && !error && report && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
          <ChartBarIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// priority engine contract</p>
            <p className="text-[13px] text-emerald-100 font-semibold leading-snug mb-1">
              composite = severityWeight × evidenceMultiplier × confidenceMultiplier × blockerPenalty
            </p>
            <p className="text-[12px] text-zinc-300 leading-relaxed">
              Pure projection over canonical AxiomOSState. No hidden chain-of-thought. Preview data lowers confidence honestly. The engine never auto-executes anything.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="text-right min-w-[4rem]">
      <p className={`text-2xl font-bold tracking-tight leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}

function Factor({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded bg-white/[0.02] border border-white/[0.04] px-2 py-1.5">
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="text-[13px] font-bold text-white tracking-tight">{value}</p>
    </div>
  );
}
