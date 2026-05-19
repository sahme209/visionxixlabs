"use client";

/**
 * /dashboard/runbooks — autonomous remediation runbooks.
 *
 * Reads /api/autonomy/runbooks, which derives proposals from the live
 * CloudTrail event tail. Each runbook lists a rootCauseHypothesis +
 * reversal + hardening action. Nothing executes — operators review and
 * push to Approval Packets.
 */

import { useCallback, useEffect, useState } from "react";
import {
  WrenchScrewdriverIcon,
  ArrowUturnLeftIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

type Severity = "critical" | "high" | "medium" | "low" | "info";
type ActionRisk = "safe_revert" | "policy_change" | "needs_human_triage";

interface RunbookAction {
  label: string;
  description: string;
  risk: ActionRisk;
  suggestedApi?: string;
  reviewHref: string;
}

interface Runbook {
  id: string;
  generatedAt: string;
  sourceEventId: string;
  eventName: string;
  eventTime?: string;
  severity: Severity;
  rootCauseHypothesis: string;
  affectedResource: string;
  reversal: RunbookAction;
  hardening: RunbookAction;
  confidence: number;
  evidenceRefs: string[];
}

interface Report {
  generatedAt: string;
  lookbackMinutes: number;
  totalEventsInspected: number;
  totalRunbooks: number;
  highOrCriticalCount: number;
  runbooks: Runbook[];
  durationMs: number;
  limitations: string[];
}

const SEV_TONE: Record<Severity, string> = {
  info: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  low: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  medium: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  high: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  critical: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

const RISK_TONE: Record<ActionRisk, string> = {
  safe_revert: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  policy_change: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  needs_human_triage: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const RISK_LABEL: Record<ActionRisk, string> = {
  safe_revert: "safe revert",
  policy_change: "policy change",
  needs_human_triage: "needs triage",
};

const LOOKBACK_OPTIONS = [
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
];

export default function RunbooksPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookback, setLookback] = useState(60);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");

  const load = useCallback((minutes: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/autonomy/runbooks?lookbackMinutes=${minutes}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Runbooks unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(lookback); }, [lookback, load]);

  const filtered = report?.runbooks.filter((r) => severityFilter === "all" || r.severity === severityFilter) ?? [];

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(124,58,237,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(16,185,129,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <WrenchScrewdriverIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              Remediation Runbooks · approval_only_no_execution
            </span>
          </span>
          {report && (
            <span className="text-[10px] font-mono text-zinc-500">
              {new Date(report.generatedAt).toLocaleTimeString()} · {report.durationMs}ms
            </span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          AGI proposes. <span className="text-gradient">Humans approve.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          For every high/critical CloudTrail event, Axiom auto-drafts a typed runbook with a reversal action and a
          hardening policy. Nothing executes — operators review and push to Approval Packets.
        </p>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <ClockIcon className="h-4 w-4 text-zinc-500" />
          {LOOKBACK_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setLookback(o.value)}
              className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition ${
                lookback === o.value
                  ? "bg-violet-500/15 text-violet-200 border-violet-500/30"
                  : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
              }`}
            >
              {o.label}
            </button>
          ))}
          <button
            onClick={() => load(lookback)}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {report && (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Events inspected" value={report.totalEventsInspected.toLocaleString()} tone="zinc" />
            <Stat label="Runbooks drafted" value={report.totalRunbooks.toLocaleString()} tone="violet" icon={WrenchScrewdriverIcon} />
            <Stat
              label="High / critical"
              value={report.highOrCriticalCount.toLocaleString()}
              tone={report.highOrCriticalCount > 0 ? "rose" : "emerald"}
              icon={ExclamationTriangleIcon}
            />
            <Stat label="Lookback" value={`${report.lookbackMinutes}m`} tone="zinc" />
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">
          // walking CloudTrail + drafting runbooks…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Filter:</span>
            {(["all", "critical", "high", "medium"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition ${
                  severityFilter === s
                    ? "bg-violet-500/15 text-violet-200 border-violet-500/30"
                    : "bg-white/[0.02] text-zinc-400 border-white/[0.06] hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
              No runbooks drafted in this window. {report.totalEventsInspected === 0 && "(No CloudTrail events returned — check IAM permissions for cloudtrail:LookupEvents.)"}
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {filtered.map((rb) => (
                <div key={rb.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEV_TONE[rb.severity]}`}>
                          {rb.severity}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                          confidence {Math.round(rb.confidence * 100)}%
                        </span>
                        {rb.eventTime && (
                          <span className="text-[10px] font-mono text-zinc-500">{new Date(rb.eventTime).toLocaleTimeString()}</span>
                        )}
                      </div>
                      <p className="text-[15px] font-semibold text-white">{rb.eventName}</p>
                      <p className="text-[12px] text-zinc-400 mt-1">{rb.rootCauseHypothesis}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {/* Reversal */}
                    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <ArrowUturnLeftIcon className="h-3.5 w-3.5 text-emerald-300" />
                        <p className="text-[10px] font-mono text-emerald-300/80 uppercase tracking-wider">Reversal</p>
                        <span className={`text-[8.5px] font-mono uppercase tracking-wider px-1 py-px rounded border ${RISK_TONE[rb.reversal.risk]} ml-auto`}>
                          {RISK_LABEL[rb.reversal.risk]}
                        </span>
                      </div>
                      <p className="text-[12px] font-semibold text-white">{rb.reversal.label}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{rb.reversal.description}</p>
                      {rb.reversal.suggestedApi && (
                        <code className="inline-block text-[10px] font-mono text-cyan-300 bg-black/40 border border-white/[0.06] rounded px-1.5 py-0.5 mt-1.5">
                          {rb.reversal.suggestedApi}
                        </code>
                      )}
                    </div>

                    {/* Hardening */}
                    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <ShieldCheckIcon className="h-3.5 w-3.5 text-violet-300" />
                        <p className="text-[10px] font-mono text-violet-300/80 uppercase tracking-wider">Hardening</p>
                        <span className={`text-[8.5px] font-mono uppercase tracking-wider px-1 py-px rounded border ${RISK_TONE[rb.hardening.risk]} ml-auto`}>
                          {RISK_LABEL[rb.hardening.risk]}
                        </span>
                      </div>
                      <p className="text-[12px] font-semibold text-white">{rb.hardening.label}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{rb.hardening.description}</p>
                      {rb.hardening.suggestedApi && (
                        <code className="inline-block text-[10px] font-mono text-cyan-300 bg-black/40 border border-white/[0.06] rounded px-1.5 py-0.5 mt-1.5">
                          {rb.hardening.suggestedApi}
                        </code>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 flex-wrap text-[10px] font-mono text-zinc-500">
                    <span>{rb.evidenceRefs.join(" · ")}</span>
                    <a
                      href={rb.reversal.reviewHref}
                      className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200"
                    >
                      Send to Approval Packets →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {report.limitations.length > 0 && (
            <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.03] p-4 mb-8">
              <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-2">// notes</p>
              {report.limitations.map((l, i) => <p key={i} className="text-[12px] text-zinc-300">· {l}</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({
  label, value, tone, icon: Icon,
}: { label: string; value: string; tone: "emerald" | "amber" | "rose" | "violet" | "zinc"; icon?: typeof WrenchScrewdriverIcon }) {
  const cls = {
    emerald: "border-emerald-500/[0.18] bg-emerald-500/[0.03] text-emerald-200",
    amber:   "border-amber-500/[0.18] bg-amber-500/[0.03] text-amber-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    violet:  "border-violet-500/[0.18] bg-violet-500/[0.03] text-violet-200",
    zinc:    "border-white/[0.06] bg-white/[0.02] text-zinc-200",
  }[tone];
  return (
    <div className={`rounded-xl border ${cls} p-3`}>
      <p className="text-[9px] font-mono uppercase tracking-wider opacity-70">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {Icon && <Icon className="h-4 w-4 opacity-80" />}
        <p className="text-[20px] font-bold">{value}</p>
      </div>
    </div>
  );
}
