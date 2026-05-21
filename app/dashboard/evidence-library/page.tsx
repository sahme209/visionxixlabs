"use client";

/**
 * /dashboard/evidence-library
 *
 * Evidence Lifecycle V2 view. Aggregates every evidence record Axiom
 * can surface from canonical state. Type filter pills + retention
 * indicators + linked-object refs. Read-only.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  DocumentTextIcon,
  CloudIcon,
  ShieldExclamationIcon,
  ServerStackIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  LockClosedIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
  ClockIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

type EvidenceType =
  | "source_posture" | "scan_result" | "security_finding" | "risk_signal"
  | "remediation_candidate" | "simulation_result" | "policy_decision"
  | "approval_decision" | "desktop_handoff" | "trust_control"
  | "readiness_check" | "audit_event" | "integration_health";

type Retention = "retained_default" | "retained_extended" | "ephemeral_session" | "pending_persistence" | "purged";
type SourceMode = "live" | "partial_live" | "preview" | "foundation" | "planned" | "blocked" | "disabled" | "unknown";

interface RecordLite {
  id: string;
  type: EvidenceType;
  title: string;
  summary: string;
  sourceSystem: string;
  sourceMode: SourceMode;
  createdAt: string;
  linkedObjectType?: string;
  linkedObjectId?: string;
  retentionStatus: Retention;
  exportable: boolean;
  limitations: string[];
  evidenceRef: string;
}

interface ReportLite {
  generatedAt: string;
  records: RecordLite[];
  summary: { total: number; byType: Record<EvidenceType, number>; exportable: number; ephemeral: number; retained: number; pendingPersistence: number };
  safetyContract: "evidence_library_read_only";
  limitations: string[];
}

const TYPE_ICON: Record<EvidenceType, typeof CloudIcon> = {
  source_posture:         CloudIcon,
  scan_result:            CheckCircleIcon,
  security_finding:       ShieldExclamationIcon,
  risk_signal:            ShieldExclamationIcon,
  remediation_candidate:  WrenchScrewdriverIcon,
  simulation_result:      BeakerIcon,
  policy_decision:        LockClosedIcon,
  approval_decision:      LockClosedIcon,
  desktop_handoff:        ComputerDesktopIcon,
  trust_control:          ShieldCheckIcon,
  readiness_check:        DocumentTextIcon,
  audit_event:            DocumentTextIcon,
  integration_health:     ServerStackIcon,
};

const TYPE_LABEL: Record<EvidenceType, string> = {
  source_posture:         "Source posture",
  scan_result:            "Scan result",
  security_finding:       "Security finding",
  risk_signal:            "Risk signal",
  remediation_candidate:  "Remediation candidate",
  simulation_result:      "Simulation result",
  policy_decision:        "Policy decision",
  approval_decision:      "Approval decision",
  desktop_handoff:        "Desktop handoff",
  trust_control:          "Trust control",
  readiness_check:        "Readiness check",
  audit_event:            "Audit event",
  integration_health:     "Integration health",
};

const RETENTION_TONE: Record<Retention, { pill: string }> = {
  retained_default:    { pill: "bg-emerald-500/15 text-emerald-300" },
  retained_extended:   { pill: "bg-cyan-500/15 text-cyan-300"       },
  ephemeral_session:   { pill: "bg-amber-500/15 text-amber-300"     },
  pending_persistence: { pill: "bg-amber-500/15 text-amber-300"     },
  purged:              { pill: "bg-rose-500/15 text-rose-300"       },
};

const RETENTION_LABEL: Record<Retention, string> = {
  retained_default:    "Retained · default",
  retained_extended:   "Retained · extended",
  ephemeral_session:   "Ephemeral",
  pending_persistence: "Pending · persistence",
  purged:              "Purged",
};

export default function EvidenceLibraryPage() {
  const [report, setReport] = useState<ReportLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | EvidenceType>("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/evidence/library", { credentials: "include" })
      .then((r) => r.json())
      .then((json: { ok?: boolean; data?: ReportLite; error?: { userMessage?: string } }) => {
        if (cancelled) return;
        if (json.ok && json.data) setReport(json.data);
        else setError(json.error?.userMessage ?? "Evidence library unavailable.");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = report?.records.filter((r) => filter === "all" || r.type === filter) ?? [];
  const presentTypes = report ? Array.from(new Set(report.records.map((r) => r.type))) : [];

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
            <DocumentTextIcon className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
              Evidence library
            </span>
          </span>
          {report?.generatedAt && (
            <span className="text-[10px] font-mono text-zinc-500">last sync {new Date(report.generatedAt).toLocaleTimeString()}</span>
          )}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          What Axiom can <span className="text-gradient">prove.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every evidence record across canonical state. Redacted. Tenant-scoped. Linked to an operational object the operator can audit.
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em]">// loading evidence library…</p>
        </div>
      )}
      {!loading && error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <p className="text-[11px] font-mono text-amber-300/80 uppercase tracking-[0.18em] mb-1">// library unavailable</p>
          <p className="text-[13px] text-zinc-300">{error}</p>
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <SummaryStat label="Total records" value={report.summary.total} tone="text-white" />
            <SummaryStat label="Retained" value={report.summary.retained} tone="text-emerald-300" />
            <SummaryStat label="Ephemeral" value={report.summary.ephemeral} tone="text-amber-300" />
            <SummaryStat label="Exportable" value={report.summary.exportable} tone="text-cyan-300" />
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                filter === "all"
                  ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12]"
              }`}
            >
              All ({report.summary.total})
            </button>
            {presentTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                  filter === t
                    ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                    : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.12]"
                }`}
              >
                {TYPE_LABEL[t]} ({report.summary.byType[t]})
              </button>
            ))}
          </div>

          {/* Records */}
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-10">
              <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-[0.18em] mb-1">// nothing matches filter</p>
              <p className="text-[13px] text-zinc-300">No evidence records of this type yet.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-10">
              {visible.map((r) => {
                const Icon = TYPE_ICON[r.type];
                const tone = RETENTION_TONE[r.retentionStatus];
                return (
                  <div key={r.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:-translate-y-0.5 transition-all p-5">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-9 h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] flex items-center justify-center">
                        <Icon className="h-4.5 w-4.5 text-zinc-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-zinc-300">
                            {TYPE_LABEL[r.type]}
                          </span>
                          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${tone.pill}`}>
                            {RETENTION_LABEL[r.retentionStatus]}
                          </span>
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-300">
                            {r.sourceMode.replace(/_/g, " ")}
                          </span>
                          {r.exportable && (
                            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                              exportable
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(r.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[13.5px] font-semibold text-white tracking-tight leading-snug">{r.title}</p>
                        <p className="text-[12px] text-zinc-300 leading-relaxed mt-0.5">{r.summary}</p>

                        <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] font-mono text-zinc-500">
                          <span>source: {r.sourceSystem}</span>
                          {r.linkedObjectType && <span>· linked: {r.linkedObjectType}/{r.linkedObjectId}</span>}
                          <span className="ml-auto">evidence: {r.evidenceRef}</span>
                        </div>

                        {r.limitations.length > 0 && (
                          <div className="rounded-md border border-amber-500/[0.18] bg-amber-500/[0.04] p-2 mt-2">
                            <p className="text-[9px] font-mono text-amber-300/80 uppercase tracking-wider mb-0.5">// limitation</p>
                            <p className="text-[10px] text-zinc-300 leading-snug">{r.limitations[0]}</p>
                          </div>
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
              <p className="text-[11px] font-mono text-emerald-300/80 uppercase tracking-[0.18em] mb-1">// library contract</p>
              <p className="text-[13px] text-emerald-100 font-semibold leading-snug">
                safetyContract = <code className="font-mono text-[12px] bg-black/30 border border-white/[0.06] rounded px-1.5 py-px">{report.safetyContract}</code>
              </p>
              <p className="text-[12px] text-zinc-300 leading-relaxed mt-1">
                {report.limitations.join(" ")} Export still routes through the existing audited /api/trust/export endpoint — this view never bundles or downloads on its own.
              </p>
              <div className="mt-3">
                <Link href="/dashboard/trust" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-200 hover:text-emerald-100 border border-emerald-500/30 bg-emerald-500/[0.06] rounded-md px-3 py-1.5 transition-colors">
                  Open Trust Center to export
                  <ArrowRightIcon className="h-3 w-3" />
                </Link>
              </div>
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
