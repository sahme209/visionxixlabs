"use client";

/**
 * /dashboard/root-causes
 *
 * Operator-facing root cause grouping view. Merges related risks into
 * groups so the operator can resolve N risks with one action where
 * possible. Every group is labeled "suspected" — never proven.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  PuzzlePieceIcon,
  CloudIcon,
  ServerStackIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

type Confidence = "low" | "medium" | "high";
type Pattern = "same_provider_blocked" | "same_missing_config" | "same_policy_violation" | "same_integration_failure" | "same_readiness_blocker" | "same_severity_cluster" | "single_finding";

interface GroupLite {
  id: string;
  title: string;
  suspectedCause: string;
  pattern: Pattern;
  confidence: Confidence;
  relatedCount: number;
  relatedSignalIds: string[];
  affectedSystems: string[];
  sourceMode: string;
  whyItMatters: string;
  evidenceRefs: string[];
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

interface ReportLite {
  generatedAt: string;
  groups: GroupLite[];
  summary: { totalGroups: number; totalSignalsCovered: number; singletons: number; highConfidence: number; mediumConfidence: number; lowConfidence: number };
  safetyContract: "grouping_only_no_resolution";
  limitations: string[];
}

const CONFIDENCE_VISUAL: Record<Confidence, { border: string; bg: string; text: string; pill: string }> = {
  high:   { border: "border-emerald-500/[0.22]", bg: "bg-emerald-500/[0.04]", text: "text-emerald-300", pill: "bg-emerald-500/15 text-emerald-300" },
  medium: { border: "border-cyan-500/[0.22]",    bg: "bg-cyan-500/[0.04]",    text: "text-cyan-300",    pill: "bg-cyan-500/15 text-cyan-300"       },
  low:    { border: "border-amber-500/[0.18]",   bg: "bg-amber-500/[0.04]",   text: "text-amber-300",   pill: "bg-amber-500/15 text-amber-300"     },
};

const PATTERN_ICON: Record<Pattern, typeof PuzzlePieceIcon> = {
  same_provider_blocked:    CloudIcon,
  same_missing_config:      ServerStackIcon,
  same_policy_violation:    LockClosedIcon,
  same_integration_failure: ExclamationTriangleIcon,
  same_readiness_blocker:   ClockIcon,
  same_severity_cluster:    PuzzlePieceIcon,
  single_finding:           PuzzlePieceIcon,
};

const PATTERN_LABEL: Record<Pattern, string> = {
  same_provider_blocked:    "Same provider · blocked",
  same_missing_config:      "Same missing config",
  same_policy_violation:    "Same policy violation",
  same_integration_failure: "Same integration failure",
  same_readiness_blocker:   "Same readiness blocker",
  same_severity_cluster:    "Severity cluster",
  single_finding:           "Single finding",
};

export default function RootCausesPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/intelligence/root-causes", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Root cause groups unavailable.");
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
                <PuzzlePieceIcon className="h-3.5 w-3.5 text-violet-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
                  Root causes · grouping_only_no_resolution
                </span>
              </span>
              {report?.generatedAt && (
                <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mt-3 mb-3">
              Suspected <span className="text-gradient">root causes.</span>
            </h1>
            <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
              Related risks merged into groups so one action resolves many. Every cause is labeled <em className="not-italic text-zinc-200 font-semibold">suspected</em> — never claimed as proven without operator verification.
            </p>
          </div>

          {report && (
            <div className="hidden md:flex items-end gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-sm px-5 py-4">
              <Stat label="Groups" value={report.summary.totalGroups} tone="text-white" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Covered" value={report.summary.totalSignalsCovered} tone="text-emerald-300" />
              <div className="w-px h-9 bg-white/[0.08]" />
              <Stat label="Singletons" value={report.summary.singletons} tone="text-zinc-400" />
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// grouping related risks…</p>
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// groups unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && report.groups.length === 0 && (
        <div className="rounded-2xl border border-emerald-500/[0.22] bg-emerald-500/[0.04] p-6 mb-6">
          <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// nothing to group</p>
          <p className="text-[14px] text-emerald-100 font-semibold">No related-risk patterns detected in this snapshot.</p>
          <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
            {report.summary.singletons} singleton signal{report.summary.singletons === 1 ? "" : "s"} in the queue. Open the Risk Queue to review each.
          </p>
        </div>
      )}

      {!loading && !error && report && report.groups.length > 0 && (
        <div className="space-y-3 mb-10">
          {report.groups.map((g) => {
            const v = CONFIDENCE_VISUAL[g.confidence];
            const Icon = PATTERN_ICON[g.pattern];
            return (
              <div key={g.id} className={`rounded-2xl border ${v.border} ${v.bg} p-5 hover:-translate-y-0.5 transition-all`}>
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-lg border ${v.border} ${v.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4.5 w-4.5 ${v.text}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${v.pill}`}>
                          {g.confidence} confidence
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">{PATTERN_LABEL[g.pattern]}</span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300">
                          {g.relatedCount} signal{g.relatedCount === 1 ? "" : "s"}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                          {g.sourceMode.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[14px] font-semibold text-white tracking-tight leading-snug">{g.title}</p>
                      <p className="text-[12.5px] text-zinc-300 leading-relaxed mt-0.5 italic">{g.suspectedCause}</p>
                      <p className="text-[12px] text-zinc-400 leading-relaxed mt-2">{g.whyItMatters}</p>

                      <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] font-mono text-zinc-500">
                        <span>affects: {g.affectedSystems.join(", ")}</span>
                        {g.evidenceRefs.length > 0 && <span>· {g.evidenceRefs.length} evidence</span>}
                      </div>

                      {g.limitations.length > 0 && (
                        <div className="rounded-md border border-amber-500/[0.18] bg-amber-500/[0.04] p-2 mt-2">
                          <p className="text-[9px] font-mono text-amber-300/80 uppercase tracking-wider mb-0.5">// limitation</p>
                          <p className="text-[10px] text-zinc-300 leading-snug">{g.limitations[0]}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Link
                    href={g.safeNextAction.href}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-200 hover:text-white border border-white/[0.08] hover:border-white/[0.2] rounded-md px-2.5 py-1.5 transition-colors shrink-0"
                  >
                    {g.safeNextAction.label}
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
            <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// grouper contract</p>
            <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
              safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
            </p>
            <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
              {report.limitations.join(" ")}
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
