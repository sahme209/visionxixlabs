"use client";

/**
 * /dashboard/automation-boundaries
 *
 * Operator-facing view of every action class Axiom can perform and
 * its hard-literal safety classification. This page is the public
 * face of the safety contract — anyone reviewing the platform can
 * see exactly what is read-only, preview-only, approval-gated, or
 * hard-blocked.
 *
 * Read-only. Declarative. No state machine, no toggles, no overrides.
 */

import { useEffect, useState } from "react";
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  EyeIcon,
  BeakerIcon,
  ComputerDesktopIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

type BoundaryClassification =
  | "readonly_allowed" | "preview_allowed" | "simulation_allowed"
  | "desktop_review_allowed" | "approval_required"
  | "disabled_until_policy" | "disabled_until_credentials"
  | "unsafe_never_automate";

interface BoundaryEntryLite {
  actionClass: string;
  classification: BoundaryClassification;
  label: string;
  description: string;
  reason: string;
  surface: string;
  evidenceRef: string;
}

interface BoundaryReportLite {
  generatedAt: string;
  entries: BoundaryEntryLite[];
  summary: {
    total: number; readonly: number; preview: number; simulation: number;
    desktopReview: number; approvalRequired: number;
    disabledUntilPolicy: number; disabledUntilCredentials: number;
    unsafeNeverAutomate: number;
  };
  safetyContract: "boundaries_declared_no_action_taken";
  limitations: string[];
}

const VISUAL: Record<BoundaryClassification, { border: string; bg: string; text: string; pill: string; icon: typeof ShieldCheckIcon }> = {
  readonly_allowed:            { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", icon: ShieldCheckIcon         },
  preview_allowed:             { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       icon: EyeIcon                  },
  simulation_allowed:          { border: "border-cyan-500/[0.18]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       icon: BeakerIcon               },
  desktop_review_allowed:      { border: "border-violet-500/[0.22]",  bg: "bg-violet-500/[0.04]",  text: "text-violet-300",  pill: "bg-violet-500/15 text-violet-300",   icon: ComputerDesktopIcon       },
  approval_required:           { border: "border-amber-500/[0.22]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: LockClosedIcon            },
  disabled_until_policy:       { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon   },
  disabled_until_credentials:  { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon   },
  unsafe_never_automate:       { border: "border-rose-500/[0.28]",    bg: "bg-rose-500/[0.05]",    text: "text-rose-300",    pill: "bg-rose-500/20 text-rose-200",       icon: XCircleIcon               },
};

const LABEL: Record<BoundaryClassification, string> = {
  readonly_allowed:            "Read-only · allowed",
  preview_allowed:             "Preview · allowed",
  simulation_allowed:          "Simulation · allowed",
  desktop_review_allowed:      "Desktop review · allowed",
  approval_required:           "Approval · required",
  disabled_until_policy:       "Disabled · until policy",
  disabled_until_credentials:  "Disabled · until credentials",
  unsafe_never_automate:       "Unsafe · never automate",
};

const ORDER: BoundaryClassification[] = [
  "unsafe_never_automate",
  "approval_required",
  "desktop_review_allowed",
  "simulation_allowed",
  "preview_allowed",
  "disabled_until_credentials",
  "disabled_until_policy",
  "readonly_allowed",
];

export default function AutomationBoundariesPage() {
  const [report, setReport] = useState<BoundaryReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/safety/automation-boundaries", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: BoundaryReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Automation boundaries unavailable.");
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

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ShieldExclamationIcon className="h-3.5 w-3.5 text-rose-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-rose-300">
              Automation boundaries · boundaries_declared_no_action_taken
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">declared {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          What Axiom can <span className="text-gradient">and cannot</span> automate.
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every action class is declared here with its hard-literal classification. The closed TypeScript union prevents unsafe actions from being added without explicit review — <span className="text-zinc-500">there is no "default to unsafe" path.</span>
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// loading boundary table…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// boundaries unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          {/* Summary ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <SummaryStat label="Total" value={report.summary.total} tone="text-white" />
            <SummaryStat label="Read-only" value={report.summary.readonly} tone="text-emerald-300" />
            <SummaryStat label="Approval req." value={report.summary.approvalRequired} tone="text-amber-300" />
            <SummaryStat label="Hard-blocked" value={report.summary.unsafeNeverAutomate} tone="text-rose-300" />
          </div>

          {/* Grouped by classification */}
          <div className="space-y-6 mb-10">
            {ORDER.map((cls) => {
              const v = VISUAL[cls];
              const Icon = v.icon;
              const entries = report.entries.filter((e) => e.classification === cls);
              if (entries.length === 0) return null;
              return (
                <section key={cls}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`h-4 w-4 ${v.text}`} />
                    <p className={`text-[11px] font-mono uppercase tracking-[0.18em] font-semibold ${v.text}`}>
                      // {LABEL[cls]} · {entries.length} action class{entries.length === 1 ? "" : "es"}
                    </p>
                  </div>
                  <div className="grid lg:grid-cols-2 gap-2">
                    {entries.map((e) => (
                      <div key={e.actionClass} className={`rounded-xl border ${v.border} ${v.bg} p-4`}>
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                          <p className="text-[13.5px] font-semibold text-white tracking-tight">{e.label}</p>
                          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${v.pill}`}>
                            {cls.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-[12px] text-zinc-300 leading-relaxed mb-2">{e.description}</p>
                        <p className="text-[11px] text-zinc-400 italic leading-snug mb-2">{e.reason}</p>
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-zinc-500">
                          <span>surface: {e.surface}</span>
                          <span className="ml-auto">evidence: {e.evidenceRef}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Contract footer */}
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// detector contract</p>
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

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}
