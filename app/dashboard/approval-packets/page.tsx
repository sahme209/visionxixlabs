"use client";

/**
 * /dashboard/approval-packets
 *
 * Operator-ready approval packets. One packet per approval-eligible
 * decision, with the canonical decision context bundled: risk
 * summary, simulation summary, policy decision, rollback plan,
 * verification checklist, affected systems, expected impact,
 * evidence refs, desktop eligibility, approval readiness state.
 *
 * Approving still routes through the existing approval queue —
 * this page never executes anything.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  LockClosedIcon,
  ComputerDesktopIcon,
  BeakerIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

type ApprovalReadiness =
  | "ready_for_review" | "missing_evidence" | "simulation_required"
  | "policy_blocked"   | "desktop_review_recommended"
  | "blocked_by_config" | "disabled_execution";

type ApprovalRisk = "low" | "medium" | "high" | "critical";

interface EvidenceRefLite { ref: string; label: string }

interface PacketLite {
  id: string;
  rank: number;
  requestedAction: string;
  sourceSystem: string;
  sourceMode: string;
  risk: ApprovalRisk;
  riskSummary: string;
  simulationSummary?: string;
  policyDecision: { allowed: boolean; requiresApproval: boolean; reason: string };
  rollbackPlan: { available: boolean; summary: string };
  verificationChecklist: { available: boolean; summary: string };
  affectedSystems: string[];
  expectedImpact: string;
  readiness: ApprovalReadiness;
  readinessReason: string;
  desktopReviewEligible: boolean;
  evidence: EvidenceRefLite[];
  limitations: string[];
  reviewRoute: { label: string; href: string };
  linkedPriorityId?: string;
  linkedGraphNodeIds: string[];
}

interface ReportLite {
  generatedAt: string;
  packets: PacketLite[];
  summary: {
    total: number; readyForReview: number; simulationRequired: number;
    policyBlocked: number; desktopReviewRecommended: number;
    missingEvidence: number; blockedByConfig: number;
  };
  safetyContract: "approval_only_no_execution";
  limitations: string[];
}

const READINESS_VISUAL: Record<ApprovalReadiness, { border: string; bg: string; text: string; pill: string; icon: typeof ShieldCheckIcon }> = {
  ready_for_review:           { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", icon: CheckCircleIcon       },
  desktop_review_recommended: { border: "border-white/[0.10]",  bg: "bg-white/[0.015]",  text: "text-violet-300",  pill: "bg-violet-500/15 text-violet-300",   icon: ComputerDesktopIcon   },
  simulation_required:        { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       icon: BeakerIcon            },
  missing_evidence:           { border: "border-white/[0.22]",   bg: "bg-white/[0.04]",   text: "text-zinc-300",   pill: "bg-white/15 text-zinc-300",     icon: ExclamationTriangleIcon },
  policy_blocked:             { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300",       icon: LockClosedIcon         },
  blocked_by_config:          { border: "border-white/[0.18]",   bg: "bg-white/[0.04]",   text: "text-zinc-300",   pill: "bg-white/15 text-zinc-300",     icon: ExclamationTriangleIcon },
  disabled_execution:         { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       icon: XCircleIcon             },
};

const READINESS_LABEL: Record<ApprovalReadiness, string> = {
  ready_for_review:           "Ready for review",
  desktop_review_recommended: "Desktop review recommended",
  simulation_required:        "Simulation required",
  missing_evidence:           "Missing evidence",
  policy_blocked:             "Policy blocked",
  blocked_by_config:          "Blocked by config",
  disabled_execution:         "Execution disabled",
};

const RISK_PILL: Record<ApprovalRisk, string> = {
  critical: "bg-rose-500/20 text-rose-200",
  high:     "bg-white/15 text-zinc-300",
  medium:   "bg-cyan-500/15 text-cyan-300",
  low:      "bg-zinc-700/40 text-zinc-300",
};

export default function ApprovalPacketsPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/intelligence/approval-packets", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Approval packets unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
                <LockClosedIcon className="h-3.5 w-3.5 text-zinc-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
                  Approval packets · approval_only_no_execution
                </span>
              </span>
              {report?.generatedAt && (
                <span className="text-[10px] font-mono text-zinc-500">generated {new Date(report.generatedAt).toLocaleTimeString()}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              Approval-ready <span className="text-gradient">packets.</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              Every packet bundles the canonical decision context — risk + simulation + policy + rollback + verification + evidence. <span className="text-zinc-500">Approving still routes through the existing audited approval queue.</span>
            </p>
          </div>

          {report && (
            <div className="hidden md:flex items-end gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
              <Stat label="Ready" value={report.summary.readyForReview} tone="text-emerald-300" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Sim needed" value={report.summary.simulationRequired} tone="text-cyan-300" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Blocked" value={report.summary.policyBlocked + report.summary.blockedByConfig + report.summary.missingEvidence} tone={(report.summary.policyBlocked + report.summary.blockedByConfig + report.summary.missingEvidence) > 0 ? "text-zinc-300" : "text-zinc-500"} />
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing approval packets…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-1">// packets unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && report.packets.length === 0 && (
        <div className="rounded-2xl border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-6 mb-6">
          <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// queue empty</p>
          <p className="text-[14px] text-emerald-100 font-semibold">No approval-eligible decisions in the queue.</p>
          <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">No critical/high security findings, no pending approvals, no unsimulated remediation. Use the Operating Loop and Priority Engine to keep this true.</p>
        </div>
      )}

      {!loading && !error && report && report.packets.length > 0 && (
        <div className="space-y-3 mb-10">
          {report.packets.map((pkt) => {
            const v = READINESS_VISUAL[pkt.readiness];
            const Icon = v.icon;
            const isExpanded = expanded.has(pkt.id);
            return (
              <div key={pkt.id} className={`rounded-2xl border ${v.border} ${v.bg} hover:-translate-y-0.5 transition-all overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => toggle(pkt.id)}
                  className="w-full text-left p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-9 h-9 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center`}>
                      <Icon className={`h-4.5 w-4.5 ${v.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-zinc-500">#{pkt.rank}</span>
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill}`}>
                          {READINESS_LABEL[pkt.readiness]}
                        </span>
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${RISK_PILL[pkt.risk]}`}>
                          {pkt.risk} risk
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                          {pkt.sourceMode.replace(/_/g, " ")}
                        </span>
                        {pkt.desktopReviewEligible && (
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 inline-flex items-center gap-1">
                            <ComputerDesktopIcon className="h-3 w-3" />
                            desktop-eligible
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{isExpanded ? "−" : "+"} packet detail</span>
                      </div>
                      <p className="text-[14px] font-semibold text-white tracking-tight">{pkt.requestedAction}</p>
                      <p className="text-[12.5px] text-zinc-300 leading-relaxed mt-0.5">{pkt.riskSummary}</p>
                      <p className="text-[11px] text-zinc-500 mt-1.5 italic leading-snug">{pkt.readinessReason}</p>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 space-y-3">
                    {/* Policy decision */}
                    <div className="rounded-md border border-rose-500/[0.18] bg-rose-500/[0.04] p-3">
                      <p className="text-[10px] font-mono text-rose-300/80 uppercase tracking-wider mb-1">// policy decision</p>
                      <p className="text-[12px] text-zinc-200 font-semibold leading-snug">
                        allowed: <code className="font-mono text-[11px] bg-black/30 border border-white/[0.06] rounded px-1">{String(pkt.policyDecision.allowed)}</code>
                        {" · "}requiresApproval: <code className="font-mono text-[11px] bg-black/30 border border-white/[0.06] rounded px-1">{String(pkt.policyDecision.requiresApproval)}</code>
                      </p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">{pkt.policyDecision.reason}</p>
                    </div>

                    {pkt.simulationSummary && (
                      <div className="rounded-md border border-cyan-500/[0.18] bg-cyan-500/[0.04] p-3">
                        <p className="text-[10px] font-mono text-cyan-300/80 uppercase tracking-wider mb-1">// simulation summary</p>
                        <p className="text-[12px] text-zinc-200 leading-relaxed">{pkt.simulationSummary}</p>
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// rollback plan</p>
                        <p className="text-[11px] text-zinc-300 leading-snug">
                          <span className={pkt.rollbackPlan.available ? "text-emerald-300" : "text-zinc-300"}>
                            {pkt.rollbackPlan.available ? "Available" : "Not yet generated"}
                          </span>{" "}· {pkt.rollbackPlan.summary}
                        </p>
                      </div>
                      <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// verification checklist</p>
                        <p className="text-[11px] text-zinc-300 leading-snug">
                          <span className={pkt.verificationChecklist.available ? "text-emerald-300" : "text-zinc-300"}>
                            {pkt.verificationChecklist.available ? "Available" : "Not yet generated"}
                          </span>{" "}· {pkt.verificationChecklist.summary}
                        </p>
                      </div>
                    </div>

                    {pkt.affectedSystems.length > 0 && (
                      <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// affected systems</p>
                        <div className="flex flex-wrap gap-1.5">
                          {pkt.affectedSystems.map((s, i) => (
                            <span key={i} className="text-[10px] font-mono text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-md border border-white/[0.06] bg-white/[0.015] p-3">
                      <p className="text-[10px] font-mono text-violet-300/80 uppercase tracking-wider mb-1">// expected impact</p>
                      <p className="text-[12px] text-zinc-200 leading-relaxed">{pkt.expectedImpact}</p>
                    </div>

                    {pkt.evidence.length > 0 && (
                      <div>
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// evidence refs</p>
                        <div className="flex flex-wrap gap-1.5">
                          {pkt.evidence.map((e, i) => (
                            <span key={i} className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5" title={e.ref}>
                              {e.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {pkt.limitations.length > 0 && (
                      <div className="rounded-md border border-white/[0.18] bg-white/[0.04] p-2.5">
                        <p className="text-[10px] font-mono text-zinc-300/80 uppercase tracking-wider mb-1">// limitations</p>
                        <ul className="space-y-0.5">
                          {pkt.limitations.slice(0, 2).map((l, i) => (
                            <li key={i} className="text-[11px] text-zinc-300 leading-snug">{l}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="text-[11px] text-zinc-500 inline-flex items-center gap-1.5">
                        <EyeIcon className="h-3 w-3" />
                        Review only — approving routes through the audited queue
                      </p>
                      <Link
                        href={pkt.reviewRoute.href}
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors"
                      >
                        {pkt.reviewRoute.label}
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

      {/* Safety contract footer */}
      {!loading && !error && report && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// packet engine contract</p>
            <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
              safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
            </p>
            <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
              This view bundles canonical decision context for review only. Approval flips state in the existing audited engine; nothing here applies Terraform, executes CLI, mutates cloud, or runs on desktop.
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
