"use client";

/**
 * /dashboard/next-actions
 *
 * Next-Best-Action view. Fetches /api/intelligence/next-actions and
 * renders the ranked list of safe operator actions classified by
 * literal safetyLevel. Mutation actions are never emitted by the
 * engine — the page banner makes the contract explicit.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BoltIcon,
  ShieldCheckIcon,
  EyeIcon,
  BeakerIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

type SafetyLevel = "safe_readonly" | "safe_review" | "safe_preview" | "approval_required" | "blocked_by_config" | "blocked_by_policy" | "disabled";
type ActionType = string;
type Urgency = "now" | "this_week" | "this_month" | "scheduled";

interface NextActionItemLite {
  id: string;
  rank: number;
  title: string;
  description: string;
  actionType: ActionType;
  safetyLevel: SafetyLevel;
  urgency: Urgency;
  reasonSummary: string;
  expectedOutcome: string;
  reversible: true;
  canRunNow: boolean;
  blockedReason?: string;
  sourceSystem: string;
  sourceMode: string;
  linkedPriorityId?: string;
  route: { label: string; href: string };
  evidenceRefs: string[];
  limitations: string[];
}

interface NextActionReportLite {
  generatedAt: string;
  items: NextActionItemLite[];
  summary: {
    total: number;
    canRunNow: number;
    approvalRequired: number;
    blockedByConfig: number;
    blockedByPolicy: number;
    bySafetyLevel: Record<SafetyLevel, number>;
  };
  safetyContract: "no_mutation_actions_emitted";
  limitations: string[];
}

const SAFETY_VISUAL: Record<SafetyLevel, { border: string; bg: string; text: string; pill: string; icon: typeof ShieldCheckIcon }> = {
  safe_readonly:     { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", icon: ShieldCheckIcon         },
  safe_review:       { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       icon: EyeIcon                  },
  safe_preview:      { border: "border-violet-500/[0.22]",  bg: "bg-violet-500/[0.04]",  text: "text-violet-300",  pill: "bg-violet-500/15 text-violet-300",   icon: BeakerIcon               },
  approval_required: { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: LockClosedIcon           },
  blocked_by_config: { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon  },
  blocked_by_policy: { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300",       icon: XCircleIcon              },
  disabled:          { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       icon: XCircleIcon              },
};

const SAFETY_LABEL: Record<SafetyLevel, string> = {
  safe_readonly:     "Safe · read-only",
  safe_review:       "Safe · review",
  safe_preview:      "Safe · preview",
  approval_required: "Approval required",
  blocked_by_config: "Blocked · config",
  blocked_by_policy: "Blocked · policy",
  disabled:          "Disabled",
};

export default function NextActionsPage() {
  const [report, setReport] = useState<NextActionReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/intelligence/next-actions", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: NextActionReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Next-best-action report unavailable.");
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
                <BoltIcon className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                  Next-best actions · no_mutation_actions_emitted
                </span>
              </span>
              {report?.generatedAt && (
                <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              What I should <span className="text-gradient">do next.</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              Ranked safe actions derived from priorities. Every action carries a literal safetyLevel — mutation actions are never produced. <span className="text-zinc-500">Reversible by construction.</span>
            </p>
          </div>

          {report && (
            <div className="hidden md:flex items-end gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
              <Stat label="Can run now" value={report.summary.canRunNow} tone="text-emerald-300" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Approval" value={report.summary.approvalRequired} tone="text-amber-300" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Blocked" value={report.summary.blockedByConfig + report.summary.blockedByPolicy} tone={(report.summary.blockedByConfig + report.summary.blockedByPolicy) > 0 ? "text-rose-300" : "text-zinc-500"} />
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing next-best actions…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// next-actions unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {/* Action rows */}
      {!loading && !error && report && (
        <div className="space-y-3 mb-10">
          {report.items.map((a) => {
            const v = SAFETY_VISUAL[a.safetyLevel];
            const Icon = v.icon;
            return (
              <div key={a.id} className={`rounded-2xl border ${v.border} ${v.bg} p-5 hover:-translate-y-0.5 transition-all`}>
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4.5 w-4.5 ${v.text}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-zinc-500">#{a.rank}</span>
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill}`}>
                          {SAFETY_LABEL[a.safetyLevel]}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">
                          {a.urgency.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[14px] font-semibold text-white tracking-tight">{a.title}</p>
                      <p className="text-[12.5px] text-zinc-300 leading-relaxed mt-0.5">{a.description}</p>
                    </div>
                  </div>
                  <Link
                    href={a.route.href}
                    className={`inline-flex items-center gap-1.5 text-[12px] font-medium rounded-md px-2.5 py-1.5 transition-colors shrink-0 ${
                      a.canRunNow
                        ? "text-emerald-200 hover:text-emerald-100 border border-emerald-500/30 bg-emerald-500/[0.06] hover:border-emerald-500/50"
                        : "text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2]"
                    }`}
                  >
                    {a.route.label}
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </div>

                <div className="rounded-md border border-white/[0.06] bg-black/20 p-3 mt-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// expected outcome</p>
                  <p className="text-[12px] text-zinc-300 leading-relaxed">{a.expectedOutcome}</p>
                </div>

                {a.blockedReason && (
                  <div className="rounded-md border border-amber-500/[0.18] bg-amber-500/[0.04] p-2.5 mt-3">
                    <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider mb-1">// blocked reason</p>
                    <p className="text-[11px] text-zinc-300 leading-snug">{a.blockedReason}</p>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px] font-mono text-zinc-500">
                  <span>source: {a.sourceSystem}</span>
                  <span>· mode: {a.sourceMode.replace(/_/g, " ")}</span>
                  {a.linkedPriorityId && <span>· from priority: {a.linkedPriorityId}</span>}
                  <span className="ml-auto">reversible · true</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Safety contract footer */}
      {!loading && !error && report && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// engine safety contract</p>
            <p className="text-[13px] text-emerald-100 font-semibold leading-snug mb-1">
              safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
            </p>
            <p className="text-[12px] text-zinc-300 leading-relaxed">
              The mapping from priority → action is a closed set with no mutation entries. Approval, blocked, and review paths surface to the operator; nothing here can apply a Terraform plan, run a CLI mutation, or execute on desktop.
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
