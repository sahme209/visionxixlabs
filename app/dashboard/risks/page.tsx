"use client";

/**
 * /dashboard/risks
 *
 * Risk Queue — operator-facing aggregation of actionable risks. Each
 * item carries a canonical state-machine status, suggested owner role,
 * linked finding/remediation/simulation/approval ids, and safeNextAction.
 *
 * Read-only. The queue never executes a state-machine transition; the
 * existing approval/remediation engines do that with their own audited
 * routes.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  LockClosedIcon,
  EyeIcon,
  XCircleIcon,
  ComputerDesktopIcon,
  CloudIcon,
  ClockIcon,
  RocketLaunchIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";

type RiskStatus =
  | "open" | "investigating" | "remediation_prepared" | "simulation_ready"
  | "approval_required" | "accepted_risk" | "blocked"
  | "resolved_simulated" | "closed";

type RiskCategory =
  | "security_finding" | "release_blocker" | "integration_blocker"
  | "policy_violation" | "readiness_blocker" | "desktop_blocker"
  | "scheduled_scan_failure" | "operational_drift";

type Severity = "critical" | "high" | "medium" | "low" | "info";
type SourceMode = "live" | "partial_live" | "preview" | "foundation" | "planned" | "blocked" | "disabled" | "unknown";

interface RiskItemLite {
  id: string;
  rank: number;
  title: string;
  description: string;
  sourceSystem: string;
  sourceMode: SourceMode;
  severity: Severity;
  category: RiskCategory;
  affectedSystem?: string;
  status: RiskStatus;
  ownerRole: string;
  evidenceRefs: string[];
  linkedGraphNodeIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  suspectedCause?: string;
  whyItMatters: string;
  safeNextAction: { label: string; href: string };
  limitations: string[];
}

interface RiskQueueLite {
  generatedAt: string;
  items: RiskItemLite[];
  summary: {
    total: number; open: number; investigating: number;
    remediationPrepared: number; simulationReady: number;
    approvalRequired: number; blocked: number;
    resolvedSimulated: number; closed: number;
    bySeverity: Record<Severity, number>;
    byCategory: Record<RiskCategory, number>;
  };
  overallSourceMode: SourceMode;
  limitations: string[];
  safeNextAction: { label: string; href: string };
  safetyContract: "risk_review_only_no_execution";
}

const STATUS_VISUAL: Record<RiskStatus, { border: string; bg: string; text: string; pill: string; icon: typeof CheckCircleIcon }> = {
  open:                 { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon },
  investigating:        { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       icon: EyeIcon                  },
  remediation_prepared: { border: "border-white/[0.10]",  bg: "bg-white/[0.015]",  text: "text-violet-300",  pill: "bg-violet-500/15 text-violet-300",   icon: CheckCircleIcon          },
  simulation_ready:     { border: "border-white/[0.06]",  bg: "bg-white/[0.015]",  text: "text-violet-300",  pill: "bg-violet-500/15 text-violet-300",   icon: CheckCircleIcon          },
  approval_required:    { border: "border-amber-500/[0.28]",   bg: "bg-amber-500/[0.05]",   text: "text-amber-300",   pill: "bg-amber-500/20 text-amber-200",     icon: LockClosedIcon           },
  accepted_risk:        { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-300",    pill: "bg-zinc-700/40 text-zinc-300",       icon: CheckCircleIcon          },
  blocked:              { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300",       icon: XCircleIcon              },
  resolved_simulated:   { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", icon: CheckCircleIcon          },
  closed:               { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       icon: CheckCircleIcon          },
};

const STATUS_LABEL: Record<RiskStatus, string> = {
  open: "Open", investigating: "Investigating",
  remediation_prepared: "Remediation prepared",
  simulation_ready: "Simulation ready",
  approval_required: "Approval required",
  accepted_risk: "Accepted risk",
  blocked: "Blocked",
  resolved_simulated: "Resolved · simulated",
  closed: "Closed",
};

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-rose-500/20 text-rose-200",
  high:     "bg-amber-500/15 text-amber-300",
  medium:   "bg-cyan-500/15 text-cyan-300",
  low:      "bg-zinc-700/40 text-zinc-300",
  info:     "bg-zinc-700/40 text-zinc-300",
};

const CATEGORY_ICON: Record<RiskCategory, typeof CloudIcon> = {
  security_finding:        ShieldExclamationIcon,
  release_blocker:         RocketLaunchIcon,
  integration_blocker:     CloudIcon,
  policy_violation:        LockClosedIcon,
  readiness_blocker:       ExclamationTriangleIcon,
  desktop_blocker:         ComputerDesktopIcon,
  scheduled_scan_failure:  ClockIcon,
  operational_drift:       CodeBracketIcon,
};

export default function RiskQueuePage() {
  const [report, setReport] = useState<RiskQueueLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/risks/queue", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: RiskQueueLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Risk queue unavailable.");
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
              "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="grid md:grid-cols-[1fr_auto] items-end gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
                <ShieldExclamationIcon className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                  Risk Queue · risk_review_only_no_execution
                </span>
              </span>
              {report?.generatedAt && (
                <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              Operational <span className="text-gradient">risk queue.</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              Every actionable risk derived from canonical signals. Status reflects canonical state — no fake "resolved" or "applied" without backing.
            </p>
          </div>

          {report && (
            <div className="hidden md:flex items-end gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
              <Stat label="Open" value={report.summary.open} tone={report.summary.open > 0 ? "text-amber-300" : "text-zinc-500"} />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Approval" value={report.summary.approvalRequired} tone={report.summary.approvalRequired > 0 ? "text-amber-300" : "text-zinc-500"} />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Blocked" value={report.summary.blocked} tone={report.summary.blocked > 0 ? "text-rose-300" : "text-zinc-500"} />
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing risk queue…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// queue unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && report.items.length === 0 && (
        <div className="rounded-2xl border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-6 mb-6">
          <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// queue clear</p>
          <p className="text-[14px] text-emerald-100 font-semibold">No actionable risks in the queue.</p>
        </div>
      )}

      {!loading && !error && report && report.items.length > 0 && (
        <div className="space-y-3 mb-10">
          {report.items.map((r) => {
            const v = STATUS_VISUAL[r.status];
            const StatusIcon = v.icon;
            const CatIcon = CATEGORY_ICON[r.category];
            return (
              <div key={r.id} className={`rounded-2xl border ${v.border} ${v.bg} p-5 hover:-translate-y-0.5 transition-all`}>
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center shrink-0`}>
                      <CatIcon className={`h-4.5 w-4.5 ${v.text}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-zinc-500">#{r.rank}</span>
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded inline-flex items-center gap-1 ${v.pill}`}>
                          <StatusIcon className="h-3 w-3" />
                          {STATUS_LABEL[r.status]}
                        </span>
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${SEVERITY_PILL[r.severity]}`}>
                          {r.severity}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                          {r.sourceMode.replace(/_/g, " ")}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">
                          owner: {r.ownerRole.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[14px] font-semibold text-white tracking-tight leading-snug">{r.title}</p>
                      <p className="text-[12.5px] text-zinc-300 leading-relaxed mt-0.5">{r.description}</p>

                      {r.suspectedCause && (
                        <p className="text-[11px] text-zinc-400 italic leading-snug mt-1.5">{r.suspectedCause}</p>
                      )}

                      <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] font-mono text-zinc-500">
                        <span>first seen {new Date(r.firstSeenAt).toLocaleTimeString()}</span>
                        {r.affectedSystem && <span>· affects {r.affectedSystem}</span>}
                        {r.evidenceRefs.length > 0 && <span>· {r.evidenceRefs.length} evidence ref{r.evidenceRefs.length === 1 ? "" : "s"}</span>}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={r.safeNextAction.href}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors shrink-0"
                  >
                    {r.safeNextAction.label}
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && report && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
          <CheckCircleIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// queue contract</p>
            <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
              safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
            </p>
            <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
              The queue is a projection of canonical state. Statuses can only progress through the existing approval/remediation engines — not from this page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="text-right min-w-[4rem]">
      <p className={`text-2xl font-bold tracking-tight leading-none ${tone}`}>{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
}
