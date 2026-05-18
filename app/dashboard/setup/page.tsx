"use client";

/**
 * /dashboard/setup
 *
 * Canonical 13-step setup wizard. Every step's status is derived from
 * canonical state — never a manually-persisted flag. The wizard
 * reviews; it never executes setup itself.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  MinusCircleIcon,
  DocumentTextIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";

type Status = "complete" | "in_progress" | "pending" | "blocked" | "skipped";

interface StepLite {
  id: string;
  label: string;
  description: string;
  status: Status;
  sourceMode: string;
  reason: string;
  route: { label: string; href: string };
  docsLink?: { label: string; href: string };
  blocker?: string;
  limitations: string[];
  evidenceRef: string;
}

interface ReportLite {
  generatedAt: string;
  steps: StepLite[];
  summary: { total: number; complete: number; inProgress: number; pending: number; blocked: number; skipped: number; completionRatio: number };
  safetyContract: "setup_review_only_no_execution";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

const STATUS_VISUAL: Record<Status, { border: string; bg: string; text: string; pill: string; icon: typeof CheckCircleIcon }> = {
  complete:    { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300", icon: CheckCircleIcon          },
  in_progress: { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300",       icon: ClockIcon                },
  pending:     { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300",     icon: ExclamationTriangleIcon  },
  blocked:     { border: "border-rose-500/[0.22]",    bg: "bg-rose-500/[0.04]",    text: "text-rose-300",    pill: "bg-rose-500/15 text-rose-300",       icon: XCircleIcon              },
  skipped:     { border: "border-zinc-700/30",        bg: "bg-white/[0.02]",       text: "text-zinc-400",    pill: "bg-zinc-700/40 text-zinc-300",       icon: MinusCircleIcon          },
};

const STATUS_LABEL: Record<Status, string> = {
  complete:    "Complete",
  in_progress: "In progress",
  pending:     "Pending",
  blocked:     "Blocked",
  skipped:     "Skipped",
};

export default function SetupPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/setup-wizard", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Setup wizard unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const progressPct = report ? Math.round(report.summary.completionRatio * 100) : 0;

  return (
    <div className="relative">
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
            <RocketLaunchIcon className="h-3.5 w-3.5 text-emerald-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              Setup wizard · setup_review_only_no_execution
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Get to your first <span className="text-gradient">real scan.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Thirteen canonical setup steps. Every completion is derived from real signals — never persisted as a manual flag. The wizard reviews; the underlying engines do the work.
        </p>

        {report && (
          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">progress</p>
              <p className="text-[12px] font-mono text-zinc-300">{report.summary.complete} / {report.summary.total} complete ({progressPct}%)</p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// composing setup status…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// wizard unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          {/* Next action callout */}
          <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.04] p-5 mb-8 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-violet-300/80 uppercase tracking-[0.18em] mb-1">// recommended next step</p>
              <p className="text-[14px] text-white font-semibold leading-snug">{report.safeNextAction.label}</p>
            </div>
            <Link href={report.safeNextAction.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-200 hover:text-violet-100 border border-violet-500/30 hover:border-violet-500/50 bg-violet-500/[0.06] rounded-md px-3 py-1.5 transition-colors">
              {report.safeNextAction.label}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>

          {/* Step list */}
          <div className="space-y-2 mb-10">
            {report.steps.map((s, idx) => {
              const v = STATUS_VISUAL[s.status];
              const Icon = v.icon;
              return (
                <div key={s.id} className={`rounded-2xl border ${v.border} ${v.bg} p-4 hover:-translate-y-0.5 transition-all`}>
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className={`shrink-0 w-9 h-9 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center`}>
                      <Icon className={`h-4.5 w-4.5 ${v.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-zinc-500">#{idx + 1}</span>
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill}`}>
                          {STATUS_LABEL[s.status]}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                          {s.sourceMode.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[14px] font-semibold text-white tracking-tight">{s.label}</p>
                      <p className="text-[12.5px] text-zinc-300 leading-relaxed mt-0.5">{s.description}</p>
                      <p className="text-[11px] text-zinc-400 italic leading-snug mt-1">{s.reason}</p>

                      {s.blocker && (
                        <div className="rounded-md border border-rose-500/[0.18] bg-rose-500/[0.04] p-2 mt-2">
                          <p className="text-[9px] font-mono text-rose-300/80 uppercase tracking-wider mb-0.5">// blocker</p>
                          <p className="text-[11px] text-zinc-200 font-mono">{s.blocker}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] font-mono text-zinc-500">
                        <span>evidence: {s.evidenceRef}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={s.route.href} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors">
                        {s.route.label}
                        <ArrowRightIcon className="h-3 w-3" />
                      </Link>
                      {s.docsLink && (
                        <Link href={s.docsLink.href} className="text-[10px] font-mono text-zinc-500 hover:text-white inline-flex items-center gap-1">
                          <DocumentTextIcon className="h-3 w-3" />
                          docs
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 mb-8 flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// wizard contract</p>
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
