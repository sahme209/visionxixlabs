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
import { PageIntro } from "@/components/dashboard/PageIntro";

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
  medium: "bg-white/10 text-zinc-300 border-white/20",
  high: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  critical: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

const RISK_TONE: Record<ActionRisk, string> = {
  safe_revert: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  policy_change: "bg-violet-500/15 text-violet-300 border-white/[0.12]",
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
  const [staging, setStaging] = useState<string | null>(null);
  const [staged, setStaged] = useState<Set<string>>(new Set());

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

  async function stage(rb: Runbook) {
    setStaging(rb.id);
    try {
      const r = await fetch("/api/autonomy/runbooks/stage", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runbook: rb }),
      });
      const j = (await r.json()) as { ok?: boolean };
      if (j.ok) {
        setStaged((prev) => {
          const next = new Set(prev);
          next.add(rb.id);
          return next;
        });
      }
    } finally {
      setStaging(null);
    }
  }

  const filtered = report?.runbooks.filter((r) => severityFilter === "all" || r.severity === severityFilter) ?? [];

  return (
    <div className="relative">
      <PageIntro
        kicker={`Automation · runbooks${report ? ` · ${new Date(report.generatedAt).toLocaleTimeString()}` : ""}`}
        title={<>AGI proposes. <span className="text-zinc-500">Humans approve.</span></>}
        description="For every high/critical CloudTrail event, Axiom auto-drafts a typed runbook with a reversal action and a hardening policy. Nothing executes — operators review and push to Approval Packets."
        helps="See drafted remediation runbooks, the events that triggered them, and the reversal/hardening steps proposed."
        connectFirst="AWS connector with CloudTrail access. Azure + GCP equivalents land as those connectors mature."
        engineers={["Incident Engineer", "Security Engineer", "Cloud Engineer"]}
        requiresApproval="Every runbook execution. Drafting is automatic; execution is human-gated via Approval Packets."
        actions={[
          { label: "View approvals", href: "/dashboard/approvals" },
          { label: "Manage cloud connectors", href: "/dashboard/connectors" },
        ]}
        safetyNote="Drafts only · approval_only_no_execution contract · reversible by design"
      />

      <div className="mb-4 flex items-center gap-2 flex-wrap">
          <ClockIcon className="h-4 w-4 text-zinc-500" />
          {LOOKBACK_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setLookback(o.value)}
              className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition ${
                lookback === o.value
                  ? "bg-violet-500/15 text-white border-white/[0.12]"
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
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
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

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">
          // walking CloudTrail + drafting runbooks…
        </div>
      )}
      {!loading && error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
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
                    ? "bg-violet-500/15 text-white border-white/[0.12]"
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
                    {staged.has(rb.id) ? (
                      <a href="/dashboard/runbooks/queue" className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200">
                        Queued ✓ — open queue →
                      </a>
                    ) : (
                      <button
                        onClick={() => stage(rb)}
                        disabled={staging === rb.id}
                        className="inline-flex items-center gap-1 text-zinc-300 hover:text-white disabled:opacity-50"
                      >
                        {staging === rb.id ? "Staging…" : "Stage for approval →"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {report.limitations.length > 0 && (
            <div className="rounded-2xl border border-white/[0.18] bg-white/[0.03] p-4 mb-8">
              <p className="text-[10px] font-mono text-zinc-300/80 uppercase tracking-[0.18em] mb-2">// notes</p>
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
    amber:   "border-white/[0.18] bg-white/[0.03] text-zinc-200",
    rose:    "border-rose-500/[0.18] bg-rose-500/[0.03] text-rose-200",
    violet:  "border-white/[0.06] bg-white/[0.015] text-white",
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
