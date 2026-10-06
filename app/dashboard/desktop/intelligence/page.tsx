"use client";

/**
 * /dashboard/desktop/intelligence — Desktop Intelligence Workstation.
 *
 * Operator's enriched review queue. Every row joins priority rank,
 * automation boundary classification, and approval readiness so the
 * operator can decide handoff before the desktop runtime is touched.
 * Pure read view — no execution ever happens here.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ComputerDesktopIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  XCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

type Status =
  | "ready_for_handoff"
  | "awaiting_simulation"
  | "policy_blocked"
  | "missing_evidence"
  | "blocked_by_pairing"
  | "blocked_by_config"
  | "disabled_local_execution";

type Severity = "critical" | "high" | "medium" | "low" | "info";

interface PairingLite {
  paired: boolean;
  signingKeyConfigured: boolean;
  binaryAvailable: boolean;
  signingStatus: "signed_notarized" | "signed" | "unsigned" | "preview";
  safeNextAction: { label: string; href: string };
  limitations: string[];
}

interface ItemLite {
  id: string;
  rank: number;
  title: string;
  summary: string;
  category: string;
  severity: Severity;
  sourceSystem: string;
  sourceMode: string;
  priorityScore: number;
  approvalReadiness?: string;
  automationClassification: string;
  status: Status;
  statusReason: string;
  expectedImpact: string;
  affectedSystems: string[];
  evidenceRefs: string[];
  limitations: string[];
  inspectRoute: { label: string; href: string };
  handoffRoute: { label: string; href: string };
}

interface ReportLite {
  generatedAt: string;
  pairing: PairingLite;
  items: ItemLite[];
  summary: {
    total: number;
    readyForHandoff: number;
    awaitingSimulation: number;
    policyBlocked: number;
    missingEvidence: number;
    blockedByPairing: number;
    blockedByConfig: number;
    disabledLocalExecution: number;
    bySeverity: Record<Severity, number>;
    byCategory: Record<string, number>;
  };
  safetyContract: "desktop_review_only_no_local_execution";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const STATUS_VISUAL: Record<Status, { border: string; bg: string; pill: string; icon: typeof CheckCircleIcon; label: string }> = {
  ready_for_handoff:        { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", pill: "bg-emerald-500/15 text-emerald-300",  icon: CheckCircleIcon,         label: "Ready for handoff" },
  awaiting_simulation:      { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    pill: "bg-cyan-500/15 text-cyan-300",         icon: ClockIcon,               label: "Awaiting simulation" },
  policy_blocked:           { border: "border-white/[0.18]",   bg: "bg-white/[0.04]",   pill: "bg-white/15 text-zinc-300",       icon: ExclamationTriangleIcon, label: "Policy blocked" },
  missing_evidence:         { border: "border-white/[0.18]",   bg: "bg-white/[0.04]",   pill: "bg-white/15 text-zinc-300",       icon: ExclamationTriangleIcon, label: "Missing evidence" },
  blocked_by_pairing:       { border: "border-white/[0.10]",  bg: "bg-white/[0.015]",  pill: "bg-violet-500/15 text-violet-300",     icon: ComputerDesktopIcon,     label: "Blocked — not paired" },
  blocked_by_config:        { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    pill: "bg-rose-500/15 text-rose-300",         icon: XCircleIcon,             label: "Blocked by config" },
  disabled_local_execution: { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    pill: "bg-rose-500/15 text-rose-300",         icon: LockClosedIcon,          label: "Disabled — local exec off" },
};

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-rose-500/15 text-rose-300",
  high:     "bg-white/15 text-zinc-300",
  medium:   "bg-cyan-500/15 text-cyan-300",
  low:      "bg-emerald-500/15 text-emerald-300",
  info:     "bg-zinc-700/40 text-zinc-300",
};

export default function DesktopIntelligencePage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/desktop/intelligence", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Desktop intelligence unavailable.");
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
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(139,92,246,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(45,212,191,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ComputerDesktopIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              Desktop Intelligence · desktop_review_only_no_local_execution
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Review on the <span className="text-gradient">desktop, not the cloud.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every item the workstation surfaces was scored by the priority engine, gated by the policy registry, and classified by the automation boundary detector. The web never executes — that boundary is locked in code.
        </p>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <PairingStat label="Paired session" value={report.pairing.paired ? "Connected" : "Not paired"} tone={report.pairing.paired ? "emerald" : "violet"} />
            <PairingStat label="Binary" value={report.pairing.binaryAvailable ? "Available" : "Preview"} tone={report.pairing.binaryAvailable ? "emerald" : "amber"} />
            <PairingStat label="Signing" value={report.pairing.signingStatus.replace(/_/g, " ")} tone={report.pairing.signingStatus === "signed_notarized" ? "emerald" : "amber"} />
            <PairingStat label="Ready for handoff" value={String(report.summary.readyForHandoff)} tone={report.summary.readyForHandoff > 0 ? "emerald" : "zinc"} />
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing desktop review queue…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-1">// workstation unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          {/* Recommended next action callout */}
          <div className="rounded-2xl border border-violet-500/15 bg-white/[0.015] p-5 mb-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-violet-300/80 uppercase tracking-[0.18em] mb-1">// recommended next step</p>
              <p className="text-[14px] text-white font-semibold leading-snug">{report.safeNextAction.label}</p>
            </div>
            <Link href={report.safeNextAction.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white hover:text-violet-100 border border-white/[0.12] hover:border-violet-500/50 bg-white/[0.025] rounded-md px-3 py-1.5 transition-colors">
              {report.safeNextAction.label}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>

          {/* Status rollup */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
            <StatusCard label="Ready" value={report.summary.readyForHandoff} tone="emerald" />
            <StatusCard label="Awaiting sim" value={report.summary.awaitingSimulation} tone="cyan" />
            <StatusCard label="Policy" value={report.summary.policyBlocked} tone="amber" />
            <StatusCard label="Evidence" value={report.summary.missingEvidence} tone="amber" />
            <StatusCard label="Pairing" value={report.summary.blockedByPairing} tone="violet" />
            <StatusCard label="Config" value={report.summary.blockedByConfig} tone="rose" />
            <StatusCard label="Local exec off" value={report.summary.disabledLocalExecution} tone="rose" />
          </div>

          {report.items.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
              <ShieldCheckIcon className="h-6 w-6 text-emerald-300 mx-auto mb-2" />
              <p className="text-[13px] text-zinc-300">No items currently pending desktop review.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-10">
              {report.items.map((it) => {
                const v = STATUS_VISUAL[it.status];
                const Icon = v.icon;
                return (
                  <div key={it.id} className={`rounded-2xl border ${v.border} ${v.bg} p-4 hover:-translate-y-0.5 transition-all`}>
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className={`shrink-0 w-9 h-9 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center`}>
                        <Icon className="h-4.5 w-4.5 text-white/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-mono text-zinc-500">#{it.rank}</span>
                          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill}`}>
                            {v.label}
                          </span>
                          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${SEVERITY_PILL[it.severity]}`}>
                            {it.severity}
                          </span>
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                            {it.category.replace(/_/g, " ")}
                          </span>
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                            {it.sourceMode.replace(/_/g, " ")}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500">score {Math.round(it.priorityScore)}</span>
                        </div>
                        <p className="text-[14px] font-semibold text-white tracking-tight">{it.title}</p>
                        <p className="text-[12.5px] text-zinc-300 leading-relaxed mt-0.5">{it.summary}</p>
                        <p className="text-[11px] text-zinc-400 italic leading-snug mt-1">{it.statusReason}</p>

                        <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] font-mono text-zinc-500">
                          <span>boundary: {it.automationClassification.replace(/_/g, " ")}</span>
                          {it.approvalReadiness && (
                            <span>readiness: {it.approvalReadiness.replace(/_/g, " ")}</span>
                          )}
                          {it.evidenceRefs.length > 0 && (
                            <span>evidence: {it.evidenceRefs[0]}{it.evidenceRefs.length > 1 ? ` +${it.evidenceRefs.length - 1}` : ""}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={it.inspectRoute.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors">
                          inspect
                          <ArrowRightIcon className="h-3 w-3" />
                        </Link>
                        {it.status === "ready_for_handoff" && (
                          <Link href={it.handoffRoute.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white hover:text-violet-100 border border-white/[0.12] hover:border-violet-500/50 bg-white/[0.025] rounded-md px-2.5 py-1.5 transition-colors">
                            {it.handoffRoute.label}
                            <ArrowRightIcon className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// workstation contract</p>
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

function StatusCard({ label, value, tone }: { label: string; value: number; tone: "emerald" | "cyan" | "amber" | "violet" | "rose" | "zinc" }) {
  const toneClass = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-300",
    cyan:    "border-cyan-500/[0.18] bg-cyan-500/[0.03] text-cyan-300",
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-300",
    violet:  "border-white/[0.06] bg-white/[0.015] text-violet-300",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-300",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-300",
  }[tone];
  return (
    <div className={`rounded-xl border ${toneClass} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-[20px] font-bold mt-1">{value}</p>
    </div>
  );
}

function PairingStat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "violet" | "zinc" }) {
  const toneClass = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
    violet:  "border-white/[0.06] bg-white/[0.015] text-white",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${toneClass} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[13px] font-semibold mt-1">{value}</p>
    </div>
  );
}
